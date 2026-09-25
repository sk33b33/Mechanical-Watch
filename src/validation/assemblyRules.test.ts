import { describe, expect, it } from "vitest";
import { millimetres as mm, toMillimetres } from "@/units/length";
import { vec2 } from "@/math/vec2";
import {
  updateFrame,
  updateGear,
  updateJewel,
  updateShaft,
  type Movement,
} from "@/domain/movement";
import type { Gear } from "@/domain/gear";
import type { Shaft } from "@/domain/shaft";
import type { Frame } from "@/domain/frame";
import type { Jewel } from "@/domain/jewel";
import { createDemoMovement } from "@/app/demoMovement";
import { endshake, shaftSupport, sideShake } from "@/assembly/assemblyGeometry";
import { validateMovement } from "./validateMovement";
import type { ValidationIssue } from "./validationIssue";

function byName<T extends { name: string }>(items: Record<string, T>, name: string): T {
  const found = Object.values(items).find((i) => i.name === name);
  if (found === undefined) throw new Error(`no entity named ${name}`);
  return found;
}
const gear = (m: Movement, name: string): Gear => byName(m.gears, name);
const shaft = (m: Movement, name: string): Shaft => byName(m.shafts, name);
const frame = (m: Movement, name: string): Frame => byName(m.frames, name);
const jewel = (m: Movement, name: string): Jewel => byName(m.jewels, name);

const blocking = (m: Movement): ValidationIssue[] =>
  validateMovement(m).filter((i) => i.severity === "error" || i.severity === "blocker");
const variants = (m: Movement): string[] => blocking(m).map((i) => `${i.rule}:${i.id.split(":")[1] ?? ""}`);

const demo = createDemoMovement();

describe("bearing geometry (REF-ENG §12)", () => {
  it("reports side shake and endshake as unknown, naming the missing inputs", () => {
    const a = shaft(demo, "Arbor A");
    const support = shaftSupport(demo, a.id);
    const lower = sideShake(a, "LOWER", support.lower);
    expect(lower.status).toBe("UNKNOWN");
    expect(lower.status === "UNKNOWN" ? lower.missing : []).toEqual(["lower pivot diameter", "Arbor A lower jewel bore"]);
    const end = endshake(demo, a, support);
    expect(end.status === "UNKNOWN" ? end.missing : []).toEqual(["shoulder span"]);
  });

  it("computes side shake as bore − pivot diameter once both are given (ASM-0013)", () => {
    const a = shaft(demo, "Arbor A");
    let m = updateShaft(demo, a.id, { pivotDiameter: { LOWER: mm(0.1), UPPER: null } });
    m = updateJewel(m, jewel(m, "Arbor A lower jewel").id, { boreDiameter: mm(0.11) });
    const s = sideShake(shaft(m, "Arbor A"), "LOWER", shaftSupport(m, a.id).lower);
    expect(s.status === "KNOWN" ? toMillimetres(s.value) : Number.NaN).toBeCloseTo(0.01, 12);
  });

  it("computes endshake from the frames' inner faces and the shoulder span (ASM-0011)", () => {
    const a = shaft(demo, "Arbor A");
    // Mainplate top at 1.0 mm, bridge underside at 3.0 mm: 2.0 mm inner span.
    const m = updateShaft(demo, a.id, { shoulderSpan: mm(1.98) });
    const e = endshake(m, shaft(m, "Arbor A"), shaftSupport(m, a.id));
    expect(e.status === "KNOWN" ? toMillimetres(e.value) : Number.NaN).toBeCloseTo(0.02, 12);
  });
});

describe("assembly rules", () => {
  it("the demo reports clearances as not judged, with every value unknown (BRG-005)", () => {
    const info = validateMovement(demo).find((i) => i.rule === "BRG-005");
    expect(info?.severity).toBe("info");
    expect(info?.message).toContain("0 computed, 9 unknown");
  });

  it("BRG-001: a shaft without an upper bearing is unsupported", () => {
    const upper = jewel(demo, "Arbor B upper jewel");
    const m = { ...demo, jewels: Object.fromEntries(Object.entries(demo.jewels).filter(([id]) => id !== upper.id)) };
    expect(variants(m)).toContain("BRG-001:unsupported");
  });

  it("BRG-001: the bridge must sit above the mainplate", () => {
    const m = updateFrame(demo, frame(demo, "Train bridge").id, { zBottom: mm(0.5) });
    expect(variants(m)).toContain("BRG-001:frame-order");
  });

  it("BRG-002: bearings must lie inside their frame, and follow their shaft when it moves", () => {
    const a = shaft(demo, "Arbor A");
    const m = updateShaft(demo, a.id, { placement: { kind: "FIXED", position: vec2(mm(-9), mm(-2)) } });
    const outside = blocking(m).filter((i) => i.rule === "BRG-002");
    // Arbor A's upper jewel leaves the bridge; B and C move with it through their mesh constraints.
    expect(outside.map((i) => i.entityIds[0])).toContain(jewel(m, "Arbor A upper jewel").id);
    expect(outside.every((i) => i.entityIds.some((id) => id === frame(m, "Train bridge").id))).toBe(true);
  });

  it("BRG-003: a pivot that is not smaller than its bore has no running clearance", () => {
    const a = shaft(demo, "Arbor A");
    let m = updateShaft(demo, a.id, { pivotDiameter: { LOWER: mm(0.1), UPPER: null } });
    m = updateJewel(m, jewel(m, "Arbor A lower jewel").id, { boreDiameter: mm(0.1) });
    expect(variants(m)).toContain("BRG-003:no-clearance-LOWER");
  });

  it("BRG-003: a non-positive dimension is an input error, not a clearance", () => {
    const m = updateJewel(demo, jewel(demo, "Arbor A lower jewel").id, { boreDiameter: mm(-0.1) });
    const withPivot = updateShaft(m, shaft(m, "Arbor A").id, { pivotDiameter: { LOWER: mm(0.1), UPPER: null } });
    expect(variants(withPivot)).toContain("BRG-003:input-LOWER");
  });

  it("BRG-004: a shoulder span longer than the inner span leaves no endshake", () => {
    const m = updateShaft(demo, shaft(demo, "Arbor A").id, { shoulderSpan: mm(2.5) });
    expect(variants(m)).toContain("BRG-004:no-endshake");
  });

  it("FRAME-001: a frame needs a positive thickness", () => {
    const m = updateFrame(demo, frame(demo, "Mainplate").id, { thickness: mm(0) });
    expect(blocking(m).some((i) => i.rule === "FRAME-001")).toBe(true);
  });

  it("GEAR-101: meshed gears at different heights cannot engage", () => {
    const m = updateGear(demo, gear(demo, "Pinion B").id, { zCentre: mm(2.6) });
    expect(variants(m)).toContain("GEAR-101:axial-engagement");
  });

  it("GEAR-102: a gear needs a positive thickness", () => {
    const m = updateGear(demo, gear(demo, "Wheel C").id, { thickness: mm(0) });
    expect(variants(m)).toContain("GEAR-102:axial");
  });

  it("ASSY-002: two gears on one arbor cannot share axial space", () => {
    const m = updateGear(demo, gear(demo, "Wheel B").id, { zCentre: mm(1.4) });
    expect(variants(m)).toContain("ASSY-002:same-arbor");
  });

  it("ASSY-002: unmeshed gears only collide when they are at the same height", () => {
    // Moving Wheel B down puts it level with Wheel A, whose pitch circle it overlaps.
    const m = updateGear(demo, gear(demo, "Wheel B").id, { zCentre: mm(1.4) });
    expect(variants(m)).toContain("ASSY-002:pitch-overlap");
    // At its designed height the same plan-view overlap is not a collision.
    expect(variants(demo)).not.toContain("ASSY-002:pitch-overlap");
  });

  it("ASSY-002: a wheel inside a frame slab collides with it (no recesses modeled, ASM-0010)", () => {
    const m = updateGear(demo, gear(demo, "Wheel C").id, { zCentre: mm(3.2) });
    const hit = blocking(m).find((i) => i.id.startsWith("ASSY-002:gear-frame"));
    expect(hit?.references).toContain("ASM-0010");
  });

  it("ASSY-002: a wheel may not cross another shaft's arbor", () => {
    // 60 teeth at module 0.15 mm: pitch radius 4.5 mm, but Arbor B is 4.2 mm away.
    const m = updateGear(demo, gear(demo, "Wheel C").id, { toothCount: 60 });
    expect(variants(m)).toContain("ASSY-002:gear-arbor");
  });

  it("a movement without frames is a free sandbox: no bearing rules apply", () => {
    const m = { ...demo, frames: {}, jewels: {} };
    expect(validateMovement(m).some((i) => i.rule.startsWith("BRG"))).toBe(false);
  });
});
