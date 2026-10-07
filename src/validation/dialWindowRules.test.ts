import { describe, expect, it } from "vitest";
import { millimetres as mm } from "@/units/length";
import { vec2 } from "@/math/vec2";
import { addDialWindow, updateDialWindow, type Movement } from "@/domain/movement";
import { createDialWindow } from "@/domain/dialWindow";
import type { DialId } from "@/domain/dial";
import { removeEntity } from "@/domain/editing";
import { createTeachingMovement } from "@/app/teachingMovement";
import { validateMovement } from "./validateMovement";

const teaching = createTeachingMovement();
const win = Object.values(teaching.dialWindows)[0];
if (win === undefined) throw new Error("teaching movement has no dial window");
const found = (m: Movement, prefix: string): string[] =>
  validateMovement(m).filter((i) => i.rule.startsWith(prefix)).map((i) => `${i.rule}:${i.severity}:${i.id.split(":")[1] ?? ""}`);
const edit = (patch: Parameters<typeof updateDialWindow>[2]): Movement => updateDialWindow(teaching, win.id, patch);

describe("dial window rules", () => {
  it("the teaching movement's own four dial windows report no errors (DIALWIN-001, DIALWIN-002)", () => {
    expect(found(teaching, "DIALWIN-001")).toEqual([]);
    expect(validateMovement(teaching).filter((i) => i.rule === "DIALWIN-002" && i.severity === "error")).toEqual([]);
  });

  it("DIALWIN-001: radius must be a positive, finite length", () => {
    expect(found(edit({ radius: mm(0) }), "DIALWIN-001")).toContain("DIALWIN-001:error:its radius must be a positive length");
    expect(found(edit({ radius: mm(Number.NaN) }), "DIALWIN-001")).toContain("DIALWIN-001:error:its radius must be a positive length");
    expect(found(edit({ radius: mm(-1) }), "DIALWIN-001")).toContain("DIALWIN-001:error:its radius must be a positive length");
  });

  it("DIALWIN-001: centre must be finite", () => {
    expect(found(edit({ centre: vec2(mm(Number.NaN), mm(0)) }), "DIALWIN-001")).toContain("DIALWIN-001:error:its centre must be finite");
    expect(found(edit({ centre: vec2(mm(0), mm(Number.NaN)) }), "DIALWIN-001")).toContain("DIALWIN-001:error:its centre must be finite");
  });

  it("DIALWIN-001: the referenced complication must exist", () => {
    expect(found(removeEntity(teaching, win.complicationId).movement, "DIALWIN-001")).toContain("DIALWIN-001:error:it does not reference an existing complication");
  });

  it("DIALWIN-001: the referenced dial must exist (a dangling reference, distinct from the cascade-delete below)", () => {
    const dangling = createDialWindow({ ...win, name: "Dangling window", dialId: "nonexistent-dial" as DialId });
    expect(found(addDialWindow(teaching, dangling), "DIALWIN-001")).toContain("DIALWIN-001:error:it does not reference an existing dial");
  });

  it("DIALWIN-001: removing the dial cascades to remove its own windows (src/domain/editing.ts)", () => {
    const { movement } = removeEntity(teaching, win.dialId);
    expect(movement.dialWindows[win.id]).toBeUndefined();
  });

  it("DIALWIN-002: a window placed far from its complication's own disc is flagged as not overlapping", () => {
    const farAway = edit({ centre: vec2(mm(1000), mm(1000)) });
    expect(found(farAway, "DIALWIN-002")).toContain("DIALWIN-002:error:no-overlap");
  });

  it("DIALWIN-002: a window that does overlap its complication's own disc reports no error", () => {
    expect(validateMovement(teaching).filter((i) => i.rule === "DIALWIN-002" && i.entityIds.includes(win.id))).toEqual([]);
  });

  it("several dial windows are each checked independently", () => {
    const second = createDialWindow({ ...win, name: "Second window" });
    expect(found(addDialWindow(teaching, second), "DIALWIN-001")).toEqual([]);
  });
});
