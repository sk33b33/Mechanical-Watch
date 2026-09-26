import { describe, expect, it } from "vitest";
import { hertz } from "@/units/frequency";
import { toRpm } from "@/units/angularVelocity";
import {
  kilogramSquareMetres,
  micronewtonMillimetresPerRadian,
  milligramSquareCentimetres,
  newtonMetresPerRadian,
  toMicronewtonMillimetresPerRadian,
} from "@/units/rotational";
import { minutesHandShaftId, setNominalTimeDrive, updateEscapement, type Movement } from "@/domain/movement";
import { createTeachingMovement } from "@/app/teachingMovement";
import { analyzeMovement } from "@/analysis/analyzeMovement";
import { validateMovement } from "@/validation/validateMovement";
import { dailyRateSeconds, escapeSpeedFromBalance, naturalFrequency, stiffnessForFrequency } from "./balance";
import { summarizeBalance } from "./balanceSummary";
import { nominalHandAngularVelocity } from "./timeDisplay";

describe("simplified dynamic balance (ASM-0024)", () => {
  it("f = √(k/I) / 2π", () => {
    const I = milligramSquareCentimetres(10);
    const k = newtonMetresPerRadian(1e-9 * (2 * Math.PI * 2.5) ** 2);
    expect(naturalFrequency(I, k)).toBeCloseTo(2.5, 12);
  });

  it("is unknown without both inputs, and refuses non-positive ones", () => {
    expect(naturalFrequency(null, micronewtonMillimetresPerRadian(246.7))).toBeNull();
    expect(naturalFrequency(milligramSquareCentimetres(10), null)).toBeNull();
    expect(naturalFrequency(kilogramSquareMetres(0), newtonMetresPerRadian(1))).toBeNull();
    expect(naturalFrequency(kilogramSquareMetres(1), newtonMetresPerRadian(-1))).toBeNull();
  });

  it("property: the stiffness for a frequency gives that frequency back", () => {
    let seed = 3;
    const next = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let i = 0; i < 200; i += 1) {
      const I = milligramSquareCentimetres(1 + next() * 50);
      const f = hertz(1 + next() * 5);
      expect(naturalFrequency(I, stiffnessForFrequency(I, f))).toBeCloseTo(f, 12);
    }
  });

  it("the escape wheel advances one tooth per balance period (ASM-0021)", () => {
    expect(toRpm(escapeSpeedFromBalance(hertz(2.5), 15))).toBeCloseTo(10, 12);
  });

  it("daily rate: a balance fast by 1 part in 100 000 gains 0.864 s a day", () => {
    expect(dailyRateSeconds(hertz(2.5 * (1 + 1e-5)), hertz(2.5))).toBeCloseTo(0.864, 9);
    expect(dailyRateSeconds(hertz(2.5), hertz(2.5))).toBe(0);
  });
});

describe("teaching movement governed by its balance", () => {
  const movement = createTeachingMovement();
  const escapement = Object.values(movement.escapements)[0];
  if (escapement === undefined) throw new Error("no escapement");
  const minutes = minutesHandShaftId(movement);
  const kNominal = 1e-9 * (2 * Math.PI * 2.5) ** 2; // stiffness for 2.5 Hz with 10 mg·cm²
  const expectedRatio = Math.sqrt(micronewtonMillimetresPerRadian(246.7) / kNominal);

  it("defaults to the balance drive", () => {
    expect(movement.drive?.kind).toBe("BALANCE");
  });

  it("runs the hands clockwise at nominal speed × f / f_nominal", () => {
    const omega = analyzeMovement(movement).train.shaftAngularVelocity.get(minutes ?? ("" as never));
    expect(omega).toBeGreaterThan(0);
    expect((omega ?? Number.NaN) / nominalHandAngularVelocity("MINUTES")).toBeCloseTo(expectedRatio, 12);
  });

  it("predicts about 7 s a day slow, and the stiffness nominal time would need", () => {
    const s = summarizeBalance(movement, escapement);
    expect(s.nominalFrequency).toBeCloseTo(2.5, 12);
    expect(s.dailyRate).toBeCloseTo((expectedRatio - 1) * 86400, 9);
    expect(s.dailyRate).toBeCloseTo(-7.0, 1);
    expect(toMicronewtonMillimetresPerRadian(s.stiffnessForNominal ?? newtonMetresPerRadian(Number.NaN))).toBeCloseTo(246.7401, 3);
    const info = validateMovement(movement).find((i) => i.rule === "BAL-002");
    expect(info?.message).toContain("-7.0 s/day");
    expect(info?.validationLevel).toBe("L3_SIMPLIFIED_DYNAMIC");
    expect(info?.references).toContain("ASM-0024");
  });

  it("under nominal time the same balance is reported as what it would do", () => {
    const info = validateMovement(setNominalTimeDrive(movement)).find((i) => i.rule === "BAL-002");
    expect(info?.message).toContain("If the balance governed");
  });

  it("BAL-001: the balance cannot govern without a stiffness, and nothing is driven", () => {
    const m: Movement = updateEscapement(movement, escapement.id, { balance: { ...escapement.balance, hairspringStiffness: null } });
    const issues = validateMovement(m).filter((i) => i.rule === "BAL-001").map((i) => i.id.split(":")[1]);
    expect(issues).toContain("cannot-govern");
    // Only the click's hold (zero) remains: nothing turns.
    expect([...analyzeMovement(m).train.shaftAngularVelocity.values()].every((w) => w === 0)).toBe(true);
  });

  it("BAL-001: an entered inertia must be positive", () => {
    const m = updateEscapement(movement, escapement.id, { balance: { ...escapement.balance, inertia: kilogramSquareMetres(-1) } });
    expect(validateMovement(m).some((i) => i.rule === "BAL-001" && i.id.includes("inertia"))).toBe(true);
  });
});
