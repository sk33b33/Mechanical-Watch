import { describe, expect, it } from "vitest";
import { degrees } from "@/units/angle";
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
import { dailyRateSeconds, escapeSpeedFromBalance, isochronismAdjustedRate, naturalFrequency, stiffnessForFrequency, temperatureAdjustedRate } from "./balance";
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

describe("isochronism-adjusted rate (ASM-0034)", () => {
  it("is unchanged when the coefficient is unknown (ASM-0024 baseline stands)", () => {
    expect(isochronismAdjustedRate(-7, null, degrees(200), degrees(270))).toBe(-7);
  });

  it("adds zero at the reference amplitude itself", () => {
    expect(isochronismAdjustedRate(-7, 2, degrees(270), degrees(270))).toBeCloseTo(-7, 12);
  });

  it("is linear in the amplitude deviation from the reference, in the declared units (s/day per radian)", () => {
    const coefficient = 3; // s/day per radian
    const reference = degrees(270);
    const amplitude = degrees(260);
    const expected = -7 + coefficient * (amplitude - reference);
    expect(isochronismAdjustedRate(-7, coefficient, amplitude, reference)).toBeCloseTo(expected, 12);
    // A lower amplitude than the reference: the adjustment has the sign of -coefficient.
    expect(isochronismAdjustedRate(-7, coefficient, amplitude, reference)).toBeLessThan(-7);
  });

  it("a negative coefficient flips the sign of the adjustment", () => {
    const reference = degrees(270);
    const lower = degrees(260);
    const higher = degrees(280);
    expect(isochronismAdjustedRate(0, -1, lower, reference)).toBeGreaterThan(0);
    expect(isochronismAdjustedRate(0, -1, higher, reference)).toBeLessThan(0);
  });
});

describe("temperature-adjusted rate (ASM-0046, SRC-0040)", () => {
  it("is unchanged when the coefficient is unknown (ASM-0024 baseline stands)", () => {
    expect(temperatureAdjustedRate(-7, null, 5)).toBe(-7);
  });

  it("defaults the reference to the cited 20°C middle temperature (SRC-0040)", () => {
    expect(temperatureAdjustedRate(-7, 2, 20)).toBeCloseTo(-7, 12);
  });

  it("is linear in the temperature deviation from the reference, in the declared units (s/day per °C)", () => {
    const coefficient = -1.5;
    expect(temperatureAdjustedRate(-7, coefficient, 5)).toBeCloseTo(-7 + coefficient * (5 - 20), 12);
    expect(temperatureAdjustedRate(-7, coefficient, 35)).toBeCloseTo(-7 + coefficient * (35 - 20), 12);
  });

  it("an explicit reference temperature overrides the 20°C default", () => {
    expect(temperatureAdjustedRate(0, 2, 10, 10)).toBeCloseTo(0, 12);
    expect(temperatureAdjustedRate(0, 2, 15, 10)).toBeCloseTo(10, 12);
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

  it("BAL-001: an entered isochronism coefficient must be finite", () => {
    const m = updateEscapement(movement, escapement.id, { balance: { ...escapement.balance, isochronismCoefficient: Number.NaN } });
    expect(validateMovement(m).some((i) => i.rule === "BAL-001" && i.id.includes("isochronism-coefficient"))).toBe(true);
  });

  it("BAL-002: with no isochronism or temperature coefficient declared, says both are not declared (ASM-0034, ASM-0046)", () => {
    const info = validateMovement(movement).find((i) => i.rule === "BAL-002");
    expect(info?.message).toContain("amplitude dependence and temperature dependence are not declared (ASM-0034, ASM-0046)");
    expect(info?.references).not.toContain("ASM-0034");
    expect(info?.references).not.toContain("ASM-0046");
  });

  it("BAL-002: a declared coefficient with no predicted amplitude says there is nothing to apply it to", () => {
    const m = updateEscapement(movement, escapement.id, { balance: { ...escapement.balance, isochronismCoefficient: 2 } });
    const info = validateMovement(m).find((i) => i.rule === "BAL-002");
    expect(info?.message).toContain("isochronism coefficient is declared (ASM-0034), but no amplitude is predicted");
    expect(info?.references).toContain("ASM-0034");
  });

  it("BAL-002: a declared coefficient with a predicted amplitude adjusts the reported rate", () => {
    // Give the energy chain what it needs to predict an amplitude: Q and escapement efficiency.
    const withLosses = updateEscapement(movement, escapement.id, {
      escapementEfficiency: 0.4,
      balance: { ...escapement.balance, isochronismCoefficient: 2, qualityFactor: 150 },
    });
    const info = validateMovement(withLosses).find((i) => i.rule === "BAL-002");
    expect(info?.message).toContain("With the declared isochronism coefficient (ASM-0034) applied");
    expect(info?.message).toMatch(/s\/day fully wound, [+-]?\d+\.\d s\/day let down/);
    expect(info?.references).toContain("ASM-0034");
  });

  it("BAL-001: an entered temperature coefficient must be finite", () => {
    const m = updateEscapement(movement, escapement.id, { balance: { ...escapement.balance, temperatureCoefficient: Number.NaN } });
    expect(validateMovement(m).some((i) => i.rule === "BAL-001" && i.id.includes("temperature-coefficient"))).toBe(true);
  });

  it("BAL-002: a declared temperature coefficient reports the rate at the usual 5°C-35°C range (ASM-0046, SRC-0040)", () => {
    const m = updateEscapement(movement, escapement.id, { balance: { ...escapement.balance, temperatureCoefficient: -1.5 } });
    const baseline = summarizeBalance(m, { ...escapement, balance: { ...escapement.balance, temperatureCoefficient: -1.5 } }).dailyRate ?? Number.NaN;
    const info = validateMovement(m).find((i) => i.rule === "BAL-002");
    expect(info?.message).toContain("With the declared temperature coefficient (ASM-0046) applied across the usual 5°C-35°C range");
    expect(info?.references).toContain("ASM-0046");
    const atLow = temperatureAdjustedRate(baseline, -1.5, 5);
    const atHigh = temperatureAdjustedRate(baseline, -1.5, 35);
    expect(info?.message).toContain(`${atLow >= 0 ? "+" : ""}${atLow.toFixed(1)} s/day at 5°C`);
    expect(info?.message).toContain(`${atHigh >= 0 ? "+" : ""}${atHigh.toFixed(1)} s/day at 35°C`);
  });
});
