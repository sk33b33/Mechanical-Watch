import { describe, expect, it } from "vitest";
import { millimetres } from "@/units/length";
import { degrees } from "@/units/angle";
import { rpmToRadPerSecond, radiansPerSecond } from "@/units/angularVelocity";
import {
  createMovement,
  addShaft,
  addGear,
  addGearMesh,
  setPrescribedDrive,
  updateGear,
  updateShaft,
  type Movement,
} from "@/domain/movement";
import { createShaft, fixedAt } from "@/domain/shaft";
import { createGear, type CreateGearParams } from "@/domain/gear";
import { createGearMesh } from "@/domain/gearMesh";
import { RULE_IDS } from "@/reference/ruleIds";
import { ASSUMPTIONS } from "@/reference/assumptions";
import { validateMovement } from "./validateMovement";
import { declaredLevelStatus, type ValidationIssue } from "./validationIssue";

interface Options {
  centreDistanceMm?: number;
  gearB?: Partial<CreateGearParams>;
  meshed?: boolean;
}

function twoGears({ centreDistanceMm = 7, gearB = {}, meshed = true }: Options = {}): Movement {
  const shaftA = createShaft("A", fixedAt(millimetres(0), millimetres(0)));
  const shaftB = createShaft("B", fixedAt(millimetres(centreDistanceMm), millimetres(0)));
  const a = createGear({
    name: "A",
    toothCount: 60,
    module: millimetres(0.2),
    thickness: millimetres(0.2),
    shaftId: shaftA.id,
  });
  const b = createGear({
    name: "B",
    toothCount: 10,
    module: millimetres(0.2),
    thickness: millimetres(0.2),
    shaftId: shaftB.id,
    ...gearB,
  });
  let movement = createMovement("Sandbox", true);
  movement = addShaft(movement, shaftA);
  movement = addShaft(movement, shaftB);
  movement = addGear(movement, a);
  movement = addGear(movement, b);
  if (meshed) movement = addGearMesh(movement, createGearMesh(a.id, b.id));
  return setPrescribedDrive(movement, shaftA.id, rpmToRadPerSecond(60));
}

const rules = (movement: Movement): string[] => validateMovement(movement).map((i) => i.rule);
const errors = (movement: Movement): ValidationIssue[] =>
  validateMovement(movement).filter((i) => i.severity === "error" || i.severity === "blocker");

describe("validateMovement", () => {
  it("reports no errors for a correctly meshed, correctly placed pair", () => {
    expect(errors(twoGears())).toHaveLength(0);
  });

  it("always states that the drive is prescribed, not an energy source (SIM-003, ASM-0007)", () => {
    const info = validateMovement(twoGears()).find((i) => i.rule === "SIM-003");
    expect(info?.severity).toBe("info");
    expect(info?.references).toContain("ASM-0007");
  });

  it("GEAR-001: flags non-positive and non-integer tooth counts, including an empty field", () => {
    for (const toothCount of [0, -3, 6.5, Number.NaN]) {
      expect(rules(twoGears({ gearB: { toothCount } }))).toContain("GEAR-001");
    }
  });

  it("GEAR-002: flags a non-positive module", () => {
    expect(rules(twoGears({ gearB: { module: millimetres(0) } }))).toContain("GEAR-002");
  });

  it("GEAR-003: flags mismatched modules", () => {
    expect(rules(twoGears({ gearB: { module: millimetres(0.3) } }))).toContain("GEAR-003");
  });

  it("GEAR-003: flags a pressure angle declared on one gear only", () => {
    expect(rules(twoGears({ gearB: { pressureAngle: degrees(20) } }))).toContain("GEAR-003");
  });

  it("GEAR-003: flags mismatched profile models", () => {
    expect(rules(twoGears({ gearB: { profileModel: "INVOLUTE_PROFILE" } }))).toContain("GEAR-003");
  });

  it("GEAR-004: flags a centre distance that does not match the model", () => {
    const issue = validateMovement(twoGears({ centreDistanceMm: 9 })).find((i) => i.rule === "GEAR-004");
    expect(issue?.severity).toBe("error");
    expect(issue?.references).toEqual(expect.arrayContaining(["REF-ENG §5.2", "ASM-0008"]));
  });

  it("SHAFT-001: flags a non-finite shaft placement", () => {
    const movement = twoGears();
    const [firstShaftId] = Object.keys(movement.shafts) as (keyof Movement["shafts"])[];
    if (firstShaftId === undefined) throw new Error("no shaft");
    const broken = updateShaft(movement, firstShaftId, { placement: fixedAt(millimetres(Number.NaN), millimetres(0)) });
    expect(rules(broken)).toContain("SHAFT-001");
  });

  it("ASSY-002: overlapping pitch circles of unmeshed gears are an error", () => {
    const issues = validateMovement(twoGears({ centreDistanceMm: 1, meshed: false }));
    const overlap = issues.find((i) => i.rule === "ASSY-002");
    expect(overlap?.severity).toBe("error");
    expect(overlap?.validationLevel).toBe("L1_GEOMETRIC");
  });

  it("ASSY-002: overlap of only the visualized tooth tips is a visual-level warning (ASM-0005)", () => {
    // Pitch radii 6 mm + 1 mm = 7 mm; visual tip radii 6.2 + 1.2 = 7.4 mm.
    const issues = validateMovement(twoGears({ centreDistanceMm: 7.2, meshed: false }));
    const overlap = issues.find((i) => i.rule === "ASSY-002");
    expect(overlap?.severity).toBe("warning");
    expect(overlap?.validationLevel).toBe("L0_VISUAL");
    expect(overlap?.references).toContain("ASM-0005");
  });

  it("KIN-001: warns about shafts unreachable from the driving shaft", () => {
    const movement = addShaft(twoGears(), createShaft("C", fixedAt(millimetres(50), millimetres(50))));
    const issue = validateMovement(movement).find((i) => i.rule === "KIN-001");
    expect(issue?.severity).toBe("warning");
  });

  it("KIN-001: says so when no drive is set", () => {
    const movement = { ...twoGears(), drive: null };
    const info = validateMovement(movement).find((i) => i.id.startsWith("KIN-001:no-drive"));
    expect(info?.severity).toBe("info");
  });

  it("SIM-001: flags a non-finite drive", () => {
    const movement = twoGears();
    const drive = movement.drive;
    if (drive?.kind !== "PRESCRIBED") throw new Error("expected a prescribed drive");
    const broken: Movement = { ...movement, drive: { ...drive, angularVelocity: radiansPerSecond(Number.NaN) } };
    expect(rules(broken)).toContain("SIM-001");
  });

  it("produces identical, deterministic issue IDs across runs", () => {
    const movement = twoGears({ centreDistanceMm: 9 });
    expect(validateMovement(movement).map((i) => i.id)).toEqual(
      validateMovement(movement).map((i) => i.id),
    );
  });

  it("only emits registered rule IDs and assumption references", () => {
    const movement = twoGears({ centreDistanceMm: 7.2, meshed: false, gearB: { toothCount: 0 } });
    for (const i of validateMovement(movement)) {
      expect(RULE_IDS).toContain(i.rule);
      for (const ref of i.references.filter((r) => r.startsWith("ASM-"))) {
        expect(Object.keys(ASSUMPTIONS)).toContain(ref);
      }
    }
  });
});

describe("declaredLevelStatus", () => {
  it("is satisfied when nothing blocks the declared level", () => {
    const movement = twoGears();
    expect(declaredLevelStatus("L2_KINEMATIC", validateMovement(movement)).satisfied).toBe(true);
  });

  it("is not satisfied when an error at or below the declared level exists", () => {
    const movement = twoGears({ centreDistanceMm: 9 });
    expect(declaredLevelStatus("L2_KINEMATIC", validateMovement(movement)).satisfied).toBe(false);
  });

  it("ignores errors above the declared level and never reports a different level", () => {
    const movement = twoGears({ centreDistanceMm: 9 });
    const status = declaredLevelStatus("L0_VISUAL", validateMovement(movement));
    expect(status.satisfied).toBe(true);
    expect(status.declared).toBe("L0_VISUAL");
  });

  it("does not let a visual-only warning block a geometric level", () => {
    const movement = twoGears({ centreDistanceMm: 7.2, meshed: false });
    expect(declaredLevelStatus("L1_GEOMETRIC", validateMovement(movement)).satisfied).toBe(true);
  });

  it("reflects an edit that makes a gear invalid", () => {
    const movement = twoGears();
    const [gearId] = Object.keys(movement.gears) as (keyof Movement["gears"])[];
    if (gearId === undefined) throw new Error("no gear");
    const edited = updateGear(movement, gearId, { toothCount: 0 });
    expect(declaredLevelStatus("L2_KINEMATIC", validateMovement(edited), [gearId]).satisfied).toBe(false);
  });
});
