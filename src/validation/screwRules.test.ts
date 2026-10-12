import { describe, expect, it } from "vitest";
import { millimetres as mm } from "@/units/length";
import { vec2 } from "@/math/vec2";
import { addScrew, updateScrew, type Movement } from "@/domain/movement";
import { createScrew } from "@/domain/screw";
import type { FrameId } from "@/domain/frame";
import { removeEntity } from "@/domain/editing";
import { createTeachingMovement } from "@/app/teachingMovement";
import { validateMovement } from "./validateMovement";

const teaching = createTeachingMovement();
const screw = Object.values(teaching.screws).find((s) => s.name === "Mainplate screw 1");
if (screw === undefined) throw new Error("teaching movement is missing an expected screw");
const found = (m: Movement, prefix: string): string[] =>
  validateMovement(m).filter((i) => i.rule.startsWith(prefix)).map((i) => `${i.rule}:${i.severity}:${i.id.split(":")[1] ?? ""}`);
const edit = (patch: Parameters<typeof updateScrew>[2]): Movement => updateScrew(teaching, screw.id, patch);

describe("screw rules", () => {
  it("the teaching movement's own screws report no errors (SCREW-001, SCREW-002)", () => {
    expect(found(teaching, "SCREW-001")).toEqual([]);
    expect(found(teaching, "SCREW-002")).toEqual([]);
  });

  it("SCREW-001: position must be finite", () => {
    expect(found(edit({ position: vec2(mm(Number.NaN), mm(0)) }), "SCREW-001")).toContain("SCREW-001:error:its position must be finite");
    expect(found(edit({ position: vec2(mm(0), mm(Number.NaN)) }), "SCREW-001")).toContain("SCREW-001:error:its position must be finite");
  });

  it("SCREW-001: diameter must be a positive, finite length", () => {
    expect(found(edit({ diameter: mm(0) }), "SCREW-001")).toContain("SCREW-001:error:its diameter must be a positive length");
    expect(found(edit({ diameter: mm(-1) }), "SCREW-001")).toContain("SCREW-001:error:its diameter must be a positive length");
    expect(found(edit({ diameter: mm(Number.NaN) }), "SCREW-001")).toContain("SCREW-001:error:its diameter must be a positive length");
  });

  it("SCREW-001: the referenced frame must exist", () => {
    const dangling = createScrew({ ...screw, name: "Dangling screw", frameId: "nonexistent-frame" as FrameId });
    expect(found(addScrew(teaching, dangling), "SCREW-001")).toContain("SCREW-001:error:it does not reference an existing frame");
  });

  it("SCREW-001: removing the frame cascades to remove its own screws (src/domain/editing.ts)", () => {
    const { movement } = removeEntity(teaching, screw.frameId);
    expect(movement.screws[screw.id]).toBeUndefined();
  });

  it("SCREW-002: a screw placed outside its frame's outline is flagged", () => {
    const outside = edit({ position: vec2(mm(1000), mm(1000)) });
    expect(found(outside, "SCREW-002")).toContain("SCREW-002:error:outside-outline");
  });

  it("SCREW-002: a screw within its frame's outline reports no error", () => {
    expect(validateMovement(teaching).filter((i) => i.rule === "SCREW-002" && i.entityIds.includes(screw.id))).toEqual([]);
  });

  it("several screws are each checked independently", () => {
    const second = createScrew({ ...screw, name: "Second screw" });
    expect(found(addScrew(teaching, second), "SCREW-001")).toEqual([]);
  });
});
