import { describe, expect, it } from "vitest";
import { millimetres as mm } from "@/units/length";
import { radiansPerSecond, rpmToRadPerSecond } from "@/units/angularVelocity";
import { degrees } from "@/units/angle";
import { analyzeMovement } from "@/analysis/analyzeMovement";
import { createTeachingMovement } from "@/app/teachingMovement";
import {
  addCoupling,
  addGear,
  addGearMesh,
  addShaft,
  createMovement,
  setNominalTimeDrive,
  setPrescribedDrive,
  updateGear,
  updateShaft,
  type Movement,
} from "@/domain/movement";
import { createShaft, fixedAt, type Shaft } from "@/domain/shaft";
import { createGear, type Gear } from "@/domain/gear";
import { createGearMesh } from "@/domain/gearMesh";
import { createFrictionClutch } from "@/domain/coupling";
import { removeEntity } from "@/domain/editing";
import { solveGearTrain } from "./solveGearTrain";
import { solvePlacement } from "./solvePlacement";
import { formatPeriod, nominalHandAngularVelocity, periodSeconds, readHand } from "./timeDisplay";

// Nominal-time drive: these tests check exact nominal speeds; the default balance drive is tested separately.
const movement = setNominalTimeDrive(createTeachingMovement());
const byName = <T extends { name: string }>(r: Record<string, T>, name: string): T => {
  const found = Object.values(r).find((x) => x.name === name);
  if (found === undefined) throw new Error(`no ${name}`);
  return found;
};
const shaft = (m: Movement, name: string): Shaft => byName(m.shafts, name);
const gear = (m: Movement, name: string): Gear => byName(m.gears, name);
const omega = (m: Movement, name: string, mode: "RUNNING" | "HAND_SETTING" = "RUNNING", setting?: number): number => {
  const solution = solveGearTrain(m, mode === "RUNNING" ? { mode } : { mode, settingAngularVelocity: radiansPerSecond(setting ?? 0) });
  const w = solution.shaftAngularVelocity.get(shaft(m, name).id);
  if (w === undefined) throw new Error(`${name} unpowered`);
  return w;
};
const issuesOf = (m: Movement, severity?: string): string[] =>
  analyzeMovement(m).issues.filter((i) => severity === undefined || i.severity === severity).map((i) => i.id.split(":").slice(0, 2).join(":"));

describe("time display definitions (ASM-0014)", () => {
  it("defines nominal hand rates as one turn per 12 h, 1 h and 1 min, clockwise from the dial", () => {
    expect(periodSeconds(nominalHandAngularVelocity("HOURS"))).toBeCloseTo(43200, 9);
    expect(periodSeconds(nominalHandAngularVelocity("MINUTES"))).toBeCloseTo(3600, 9);
    expect(periodSeconds(nominalHandAngularVelocity("SECONDS"))).toBeCloseTo(60, 9);
    expect(nominalHandAngularVelocity("MINUTES")).toBeGreaterThan(0);
  });

  it("reads hand angles as dial values and formats periods", () => {
    expect(readHand("HOURS", (2 * Math.PI * 3) / 12)).toBeCloseTo(3);
    expect(readHand("MINUTES", -Math.PI / 2)).toBeCloseTo(45);
    expect(formatPeriod(nominalHandAngularVelocity("HOURS"))).toBe("1 rev per 12.000 h");
    expect(formatPeriod(radiansPerSecond(0))).toBe("stationary");
  });
});

describe("teaching movement at nominal time", () => {
  it("validates with no errors or warnings", () => {
    // Info only: bearing clearances not judged, the prescribed drive, the escapement's declared model level, the drop clearance (ASM-0036), the derived escape-tooth draw (ASM-0039), the derived fork acting length (ASM-0041), the suggested ruby-pin width (ASM-0042), the derived guard-point clearance (ASM-0043), the derived horn clearance (ASM-0045), the moonphase disc's implied lunation period (ASM-0047), the date complication's implied jump period (ASM-0048), the month complication's correction schedule (ASM-0049) and the leap-year complication's drive model/reference Geneva figures (ASM-0050).
    const info = ["BRG-005", "SIM-003", "ESC-001", "ESC-002", "ESC-107", "ESC-108", "ESC-109", "ESC-110", "ESC-111", "ESC-113", "BAL-002", "SPR-002", "MOON-002", "DATE-003", "MONTH-002", "YEAR-002"];
    expect(issuesOf(movement).filter((id) => !info.some((rule) => id.startsWith(rule)))).toEqual([]);
  });

  it("drives every hand at its nominal rate and direction", () => {
    for (const [name, hand] of [["Hour wheel", "HOURS"], ["Cannon pinion", "MINUTES"], ["Fourth arbor", "SECONDS"]] as const) {
      expect(omega(movement, name)).toBeCloseTo(nominalHandAngularVelocity(hand), 12);
    }
  });

  it("derives the rest of the going train from the gearing (REF-ENG §5.3)", () => {
    expect(periodSeconds(radiansPerSecond(omega(movement, "Barrel")))).toBeCloseTo(6 * 3600, 6);
    expect(periodSeconds(radiansPerSecond(omega(movement, "Escape arbor")))).toBeCloseTo(6, 9);
    expect(omega(movement, "Centre arbor")).toBeCloseTo(omega(movement, "Cannon pinion"), 15);
  });

  it("places the coaxial cannon pinion and hour wheel on the centre axis", () => {
    const positions = solvePlacement(movement).shaftPositions;
    const centre = positions.get(shaft(movement, "Centre arbor").id);
    expect(positions.get(shaft(movement, "Cannon pinion").id)).toEqual(centre);
    expect(positions.get(shaft(movement, "Hour wheel").id)).toEqual(centre);
  });
});

describe("hand setting through the friction clutch (REF-ENG §8, ASM-0015)", () => {
  const setting = (2 * Math.PI) / 60; // minutes hand turned once per real minute

  it("moves the hands while the going train keeps its running speed", () => {
    expect(omega(movement, "Cannon pinion", "HAND_SETTING", setting)).toBeCloseTo(setting, 15);
    expect(omega(movement, "Hour wheel", "HAND_SETTING", setting)).toBeCloseTo(setting / 12, 15);
    expect(omega(movement, "Centre arbor", "HAND_SETTING", setting)).toBeCloseTo(nominalHandAngularVelocity("MINUTES"), 15);
    expect(omega(movement, "Fourth arbor", "HAND_SETTING", setting)).toBeCloseTo(nominalHandAngularVelocity("SECONDS"), 15);
  });

  it("reports the hands as not settable without an isolating clutch (SET-001)", () => {
    const clutch = Object.values(movement.couplings)[0];
    if (clutch === undefined) throw new Error("no clutch");
    const m = removeEntity(movement, clutch.id).movement;
    expect(issuesOf(m, "warning")).toContain("SET-001:NO_ISOLATING_CLUTCH");
    expect(solveGearTrain(m, { mode: "HAND_SETTING", settingAngularVelocity: radiansPerSecond(setting) }).setting)
      .toEqual({ status: "UNAVAILABLE", reason: "NO_ISOLATING_CLUTCH" });
  });

  it("reports when setting would turn a prescribed drive shaft (SET-001)", () => {
    const m = setPrescribedDrive(movement, shaft(movement, "Minute wheel").id, rpmToRadPerSecond(1));
    expect(issuesOf(m, "warning")).toContain("SET-001:WOULD_TURN_DRIVE");
  });
});

describe("time-display rules", () => {
  it("TIME-002: a wrong ratio in the going train is reported with the resulting period", () => {
    // 12 leaves instead of 10 on the fourth pinion: the fourth arbor moves (mesh constraint) and runs slow.
    const m = updateGear(movement, gear(movement, "Fourth pinion").id, { toothCount: 12 });
    const issue = analyzeMovement(m).issues.find((i) => i.rule === "TIME-002");
    expect(issue?.message).toContain("72.0000 s");
    expect(issue?.message).toContain("should be 60.0000 s");
  });

  it("TIME-002 and GEAR-004: motion works must keep 1/12 and a shared centre distance", () => {
    const m = updateGear(movement, gear(movement, "Hour wheel").id, { toothCount: 36 });
    const ids = issuesOf(m, "error");
    expect(ids).toContain("TIME-002:HOURS-vs-MINUTES");
    expect(ids).toContain("GEAR-004:centre-distance");
  });

  it("TIME-002: hands that turn in opposite directions are reported", () => {
    let m = createMovement("Two hands", true);
    const a = createShaft("Minutes", fixedAt(mm(0), mm(0)));
    const b = createShaft("Hours", fixedAt(mm(0), mm(0)));
    const ga = createGear({ name: "Ga", toothCount: 10, module: mm(0.1), thickness: mm(0.2), shaftId: a.id });
    const gb = createGear({ name: "Gb", toothCount: 120, module: mm(0.1), thickness: mm(0.2), shaftId: b.id });
    m = addShaft(m, { ...a, hand: "MINUTES" });
    m = addShaft(m, { ...b, hand: "HOURS" });
    m = addGear(m, ga);
    m = addGear(m, gb);
    const direct = createGearMesh(ga.id, gb.id);
    m = addGearMesh(m, direct);
    m = updateShaft(m, b.id, { placement: { kind: "MESH_POLAR", referenceShaftId: a.id, meshId: direct.id, angle: degrees(0) } });
    m = setNominalTimeDrive(m);
    const issue = analyzeMovement(m).issues.find((i) => i.rule === "TIME-002");
    expect(issue?.message).toContain("opposite way");
  });

  it("TIME-001: only one shaft may carry each hand", () => {
    const m = updateShaft(movement, shaft(movement, "Third arbor").id, { hand: "SECONDS" });
    expect(issuesOf(m, "error")).toContain("TIME-001:duplicate-SECONDS");
  });

  it("TIME-003: nominal time needs a minutes hand", () => {
    const m = updateShaft(movement, shaft(movement, "Cannon pinion").id, { hand: null });
    expect(issuesOf(m, "error")).toContain("TIME-003:no-minutes-hand");
  });

  it("TIME-004: a prescribed drive reports hand rates relative to nominal", () => {
    const m = setPrescribedDrive(movement, shaft(movement, "Centre arbor").id, rpmToRadPerSecond(1));
    const info = analyzeMovement(m).issues.find((i) => i.rule === "TIME-004");
    expect(info?.message).toContain("60.000× nominal");
  });
});

describe("couplings and supports", () => {
  it("CPL-001: a clutch between non-coaxial arbors is rejected (and over-constrains the train)", () => {
    const m = addCoupling(movement, createFrictionClutch("Bad", shaft(movement, "Centre arbor").id, shaft(movement, "Third arbor").id));
    const ids = issuesOf(m, "error");
    expect(ids).toContain("CPL-001:not-coaxial");
    expect(ids).toContain("ASSY-001:over-constrained");
  });

  it("SUP-001: a carried part must be coaxial", () => {
    const m = updateShaft(movement, shaft(movement, "Hour wheel").id, { placement: fixedAt(mm(0), mm(0)) });
    expect(issuesOf(m, "error")).toContain("SUP-001:carried-not-coaxial");
  });

  it("SUP-002: a stud must lie within its frame", () => {
    const m = updateShaft(movement, shaft(movement, "Minute wheel").id, { placement: fixedAt(mm(40), mm(0)) });
    expect(issuesOf(m, "error")).toContain("SUP-002:stud-outside");
  });

  it("carried and stud-mounted parts need no bearings of their own", () => {
    expect(issuesOf(movement, "error").some((id) => id.startsWith("BRG-001"))).toBe(false);
  });

  it("removing the centre arbor removes its clutch and leaves the coaxial parts reported, not re-placed", () => {
    const { movement: m } = removeEntity(movement, shaft(movement, "Centre arbor").id);
    expect(Object.values(m.couplings).filter((c) => c.kind === "FRICTION_CLUTCH")).toHaveLength(0);
    expect(shaft(m, "Hour wheel").placement.kind).toBe("COAXIAL");
    expect(solvePlacement(m).failures.map((f) => f.reason)).toContain("MISSING_REFERENCE");
  });

  it("a coaxial placement cycle is reported", () => {
    let m = updateShaft(movement, shaft(movement, "Centre arbor").id, {
      placement: { kind: "COAXIAL", referenceShaftId: shaft(movement, "Hour wheel").id },
    });
    m = setNominalTimeDrive(m);
    expect(solvePlacement(m).failures.some((f) => f.reason === "CIRCULAR_REFERENCE")).toBe(true);
  });
});
