import { describe, expect, it } from "vitest";
import { millimetres as mm } from "@/units/length";
import { degrees, radians } from "@/units/angle";
import { radiansPerSecond } from "@/units/angularVelocity";
import { addGearMesh, updateKeylessWorks, type Movement } from "@/domain/movement";
import { createGearMesh } from "@/domain/gearMesh";
import { removeEntity } from "@/domain/editing";
import { stemBodyId } from "@/domain/keyless";
import { crossedMeshSpeedRatio } from "@/math/gearMath";
import { createTeachingMovement } from "@/app/teachingMovement";
import { createSimulationState, stepSimulation } from "@/simulation/simulationState";
import { nominalHandAngularVelocity } from "./timeDisplay";
import { solvePlacement } from "./solvePlacement";
import { solveGearTrain, windingCrownSense, handsForwardCrownSense, type SolveOptions } from "./solveGearTrain";
import { summarizeKeyless, clockPositionFromDial } from "./keylessSummary";

const movement = createTeachingMovement();
const keyless = Object.values(movement.keylessWorks)[0];
if (keyless === undefined) throw new Error("teaching movement has no keyless works");
const byName = <T extends { name: string }>(items: Record<string, T>, name: string): T => {
  const found = Object.values(items).find((i) => i.name === name);
  if (found === undefined) throw new Error(name);
  return found;
};
const shaftOmega = (m: Movement, name: string, options: SolveOptions = { mode: "RUNNING" }): number | undefined =>
  solveGearTrain(m, options).shaftAngularVelocity.get(byName(m.shafts, name).id);
const crown = (omega: number): number => omega; // readability: crown angular velocity in rad/s
const wind = (omega: number): SolveOptions => ({ mode: "WINDING", crownAngularVelocity: radiansPerSecond(crown(omega)) });
const set = (omega: number): SolveOptions => ({ mode: "CROWN_SETTING", crownAngularVelocity: radiansPerSecond(crown(omega)) });

describe("right-angle stem mesh (ASM-0019)", () => {
  type V = [number, number, number];
  const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const scale = (k: number, a: V): V => [k * a[0], k * a[1], k * a[2]];

  it("property: surface velocities agree at the contact for the derived sense (independent 3D check)", () => {
    let seed = 7;
    const next = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let i = 0; i < 200; i += 1) {
      const zp = 6 + Math.floor(next() * 20);
      const zw = 10 + Math.floor(next() * 60);
      const m = 0.05 + next() * 0.1;
      const R = (m * zw) / 2;
      const r = (m * zp) / 2;
      const theta = next() * 2 * Math.PI;
      const u: V = [Math.cos(theta), Math.sin(theta), 0];
      const C: V = [next() * 10 - 5, next() * 10 - 5, next() - 0.5];
      const side = next() < 0.5 ? 1 : -1;
      const P = [C[0] + R * u[0], C[1] + R * u[1], C[2]] as V; // contact on the crown side of the wheel axis
      const pinionCentre: V = [P[0], P[1], P[2] + side * r];
      const omegaPinion = next() * 4 - 2;
      const omegaWheel = omegaPinion * crossedMeshSpeedRatio(zp, zw, side);
      const vWheel = scale(omegaWheel, cross([0, 0, 1], sub(P, C)));
      const vPinion = scale(omegaPinion, cross(u, sub(P, pinionCentre)));
      for (let k = 0; k < 3; k += 1) expect(vWheel[k]).toBeCloseTo(vPinion[k] ?? Number.NaN, 12);
    }
  });

  it("the ratio magnitude is z_driving / z_driven either way", () => {
    expect(crossedMeshSpeedRatio(12, 20, 1)).toBeCloseTo(0.6, 15);
    expect(crossedMeshSpeedRatio(20, 12, -1)).toBeCloseTo(-20 / 12, 15);
  });
});

describe("teaching movement keyless works", () => {
  it("places both wheels on the stem line with the stem one pitch radius above each", () => {
    const summary = summarizeKeyless(movement, keyless, solvePlacement(movement));
    expect(summary.winding?.planOffset).toBeCloseTo(0, 12);
    expect(summary.setting?.planOffset).toBeCloseTo(0, 12);
    expect(summary.winding?.heightError).toBeCloseTo(0, 12);
    expect(summary.setting?.heightError).toBeCloseTo(0, 12);
    expect(clockPositionFromDial(keyless.stemDirection)).toBeCloseTo(3, 12);
  });

  it("running: the click holds the ratchet, the crown is still, the setting wheel idles with the minute wheel", () => {
    const solution = solveGearTrain(movement);
    expect(solution.conflicts).toEqual([]);
    // Only the pallet arbor and balance staff, which oscillate under the escapement, are outside the gear train.
    expect(solution.unreachableShaftIds.map((id) => movement.shafts[id]?.name).sort()).toEqual(["Balance staff", "Pallet arbor"]);
    for (const name of ["Barrel arbor", "Crown wheel"]) expect(shaftOmega(movement, name)).toBe(0);
    expect(solution.stemAngularVelocity.get(stemBodyId(keyless.id, "STEM"))).toBe(0);
    const minuteWheel = shaftOmega(movement, "Minute wheel") ?? Number.NaN;
    expect(shaftOmega(movement, "Setting wheel")).toBeCloseTo(-(30 / 16) * minuteWheel, 15);
    expect(solution.stemPosition).toBe("WINDING");
  });

  it("winds clockwise seen from the crown: the arbor turns the way the drum runs (ASM-0018)", () => {
    // The crown wheel is above the stem (s = −1), so a clockwise crown (negative about the outward stem direction) winds.
    expect(windingCrownSense(movement)).toBe(-1);
    const options = wind(-2 * Math.PI);
    const solution = solveGearTrain(movement, options);
    expect(solution.winding.status).toBe("WINDING");
    const arbor = shaftOmega(movement, "Barrel arbor", options) ?? Number.NaN;
    const drum = shaftOmega(movement, "Barrel") ?? Number.NaN;
    // winding pinion 14 → crown wheel 20 → ratchet 40: 14/40 of the crown's speed.
    expect(Math.abs(arbor)).toBeCloseTo(2 * Math.PI * (14 / 40), 12);
    expect(Math.sign(arbor)).toBe(Math.sign(drum));
    // Winding changes nothing else: the drum and the hands keep running (no spring model, ASM-0007).
    expect(shaftOmega(movement, "Barrel", options)).toBe(drum);
    expect(shaftOmega(movement, "Cannon pinion", options)).toBeCloseTo(nominalHandAngularVelocity("MINUTES"), 15);
    expect(solution.conflicts).toEqual([]);
  });

  it("turned the other way, the ratchet teeth slip and nothing is wound", () => {
    const solution = solveGearTrain(movement, wind(2 * Math.PI));
    expect(solution.winding.status).toBe("SLIPPING");
    expect(solution.stemAngularVelocity.get(stemBodyId(keyless.id, "STEM"))).toBe(2 * Math.PI);
    expect(solution.stemAngularVelocity.get(stemBodyId(keyless.id, "WINDING_PINION"))).toBe(0);
    expect(shaftOmega(movement, "Barrel arbor", wind(2 * Math.PI))).toBe(0);
  });

  it("pulled out, the crown sets the hands through the setting train while the going train keeps time", () => {
    const options = set(2 * Math.PI);
    const solution = solveGearTrain(movement, options);
    expect(solution.setting.status).toBe("ACTIVE");
    expect(solution.stemPosition).toBe("SETTING");
    // sliding pinion 20 → setting wheel 16 → minute wheel 30 → cannon pinion 10: 20/16 · 16/30 · 30/10 = 2.
    expect(shaftOmega(movement, "Cannon pinion", options)).toBeCloseTo(2 * 2 * Math.PI, 12);
    expect(shaftOmega(movement, "Hour wheel", options)).toBeCloseTo((2 * 2 * Math.PI) / 12, 12);
    expect(shaftOmega(movement, "Centre arbor", options)).toBeCloseTo(nominalHandAngularVelocity("MINUTES"), 15);
    expect(shaftOmega(movement, "Fourth arbor", options)).toBeCloseTo(nominalHandAngularVelocity("SECONDS"), 15);
    expect(shaftOmega(movement, "Barrel arbor", options)).toBe(0);
    expect(handsForwardCrownSense(movement)).toBe(1);
    expect(solution.conflicts).toEqual([]);
  });

  it("the crown pulled out but not turned leaves the hands running, and the stem idles", () => {
    const solution = solveGearTrain(movement, { mode: "CROWN_SETTING" });
    expect(shaftOmega(movement, "Cannon pinion", { mode: "CROWN_SETTING" })).toBeCloseTo(nominalHandAngularVelocity("MINUTES"), 15);
    expect(solution.conflicts).toEqual([]);
    expect(solution.stemAngularVelocity.get(stemBodyId(keyless.id, "STEM"))).not.toBe(0);
  });

  it("without a declared mainspring the winding direction is unknown, and the ratchet stays held", () => {
    const spring = Object.values(movement.couplings).find((c) => c.kind === "MAINSPRING");
    if (spring === undefined) throw new Error("no mainspring");
    const m = removeEntity(movement, spring.id).movement;
    const solution = solveGearTrain(m, wind(1));
    expect(solution.winding).toEqual({ status: "UNAVAILABLE", reason: "NO_MAINSPRING" });
    expect(shaftOmega(m, "Barrel arbor", wind(1))).toBe(0);
    expect(windingCrownSense(m)).toBeNull();
  });

  it("without the setting-wheel mesh the crown cannot reach the hands", () => {
    const mesh = Object.values(movement.gearMeshes).find((g) => g.drivingGearId === keyless.settingWheelGearId);
    if (mesh === undefined) throw new Error("no setting mesh");
    const m = removeEntity(movement, mesh.id).movement;
    expect(solveGearTrain(m, set(1)).setting).toEqual({ status: "UNAVAILABLE", reason: "CROWN_NOT_CONNECTED" });
    expect(handsForwardCrownSense(m)).toBeNull();
  });

  it("a ratchet turned by the running train conflicts with the click", () => {
    const ratchet = byName(movement.gears, "Ratchet wheel");
    const m = addGearMesh(movement, createGearMesh(byName(movement.gears, "Cannon pinion").id, ratchet.id));
    const conflicts = solveGearTrain(m).conflicts;
    expect(conflicts.some((c) => c.via.kind === "KEYLESS" && c.via.part === "CLICK")).toBe(true);
  });

  it("a stem level with a wheel's mid-plane cannot engage it (no right-angle contact)", () => {
    const m = updateKeylessWorks(movement, keyless.id, { stemHeight: mm(1.1) }); // level with the crown wheel
    expect(solveGearTrain(m, wind(1)).winding).toEqual({ status: "UNAVAILABLE", reason: "RATCHET_NOT_CONNECTED" });
  });

  it("the simulation turns the stem while winding", () => {
    const solution = solveGearTrain(movement, wind(-1));
    const next = stepSimulation(createSimulationState(movement), solution, 0.5);
    // −0.5 rad, stored normalized to [0, 2π).
    expect(next.stemAngle[stemBodyId(keyless.id, "STEM")]).toBeCloseTo(2 * Math.PI - 0.5, 12);
    expect(next.stemAngle[stemBodyId(keyless.id, "WINDING_PINION")]).toBeCloseTo(2 * Math.PI - 0.5, 12);
  });
});

describe("dial clock positions (ASM-0014)", () => {
  it("maps plan directions to the dial's clock", () => {
    expect(clockPositionFromDial(degrees(180))).toBeCloseTo(3, 12);
    expect(clockPositionFromDial(degrees(0))).toBeCloseTo(9, 12);
    expect(clockPositionFromDial(degrees(90))).toBeCloseTo(0, 12);
    expect(clockPositionFromDial(radians(-Math.PI / 2))).toBeCloseTo(6, 12);
  });
});
