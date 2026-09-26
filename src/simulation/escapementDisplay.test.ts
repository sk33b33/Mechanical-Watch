import { setNominalTimeDrive } from "@/domain/movement";
import { describe, expect, it } from "vitest";
import { radiansPerSecond } from "@/units/angularVelocity";
import { radians, toDegrees } from "@/units/angle";
import { hertz, toBeatsPerHour } from "@/units/frequency";
import { createTeachingMovement } from "@/app/teachingMovement";
import { analyzeMovement } from "@/analysis/analyzeMovement";
import { solveGearTrain } from "@/kinematics/solveGearTrain";
import { escapementDisplay } from "./escapementDisplay";

// Nominal-time drive: these tests check exact nominal speeds; the default balance drive is tested separately.
const movement = setNominalTimeDrive(createTeachingMovement());
const running = analyzeMovement(movement).train;
const idOf = (name: string): keyof typeof movement.shafts => {
  const s = Object.values(movement.shafts).find((x) => x.name === name);
  if (s === undefined) throw new Error(name);
  return s.id;
};

describe("escapement display (ASM-0023)", () => {
  it("derives 18 000 beats per hour from the running train", () => {
    const d = escapementDisplay(movement, running, running, 0.05);
    expect(toBeatsPerHour(d?.beatFrequency ?? hertz(Number.NaN))).toBeCloseTo(18000, 6);
  });

  it("holds back every running arbor by the same time lag, so the train ticks as one", () => {
    const t = 0.07; // between the dead points at 0 and 0.2 s (5 beats per second)
    const d = escapementDisplay(movement, running, running, t);
    if (d === null) throw new Error("no escapement");
    const lag = (name: string): number => {
      const w = running.shaftAngularVelocity.get(idOf(name)) ?? Number.NaN;
      return (d.shaftAngleOffset.get(idOf(name)) ?? Number.NaN) / w;
    };
    expect(lag("Fourth arbor")).toBeCloseTo(lag("Escape arbor"), 12);
    expect(lag("Cannon pinion")).toBeCloseTo(lag("Escape arbor"), 12);
    expect(Math.abs(lag("Escape arbor"))).toBeLessThanOrEqual(0.1 + 1e-12);
    // The oscillating arbors are not in the running train at all.
    expect(d.shaftAngleOffset.has(idOf("Balance staff"))).toBe(false);
  });

  it("while the crown sets the hands, the hands move freely and the going train still ticks", () => {
    const setting = solveGearTrain(movement, { mode: "CROWN_SETTING", crownAngularVelocity: radiansPerSecond(2 * Math.PI) });
    const d = escapementDisplay(movement, running, setting, 0.07);
    expect(d?.shaftAngleOffset.has(idOf("Cannon pinion"))).toBe(false);
    expect(d?.shaftAngleOffset.has(idOf("Fourth arbor"))).toBe(true);
  });

  it("the balance swings at the declared amplitude", () => {
    // Balance at 2.5 Hz: a quarter period (0.1 s) after a dead point it is at full amplitude.
    expect(toDegrees(escapementDisplay(movement, running, running, 0.1)?.balanceAngle ?? radians(Number.NaN))).toBeCloseTo(270, 9);
  });

  it("with no drive nothing ticks and the balance rests", () => {
    const stopped = { ...movement, drive: null };
    const train = analyzeMovement(stopped).train;
    const d = escapementDisplay(stopped, train, train, 0.3);
    expect(d?.beatFrequency).toBeNull();
    expect(d?.balanceAngle).toBe(0);
  });
});
