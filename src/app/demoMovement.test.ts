import { describe, expect, it } from "vitest";
import { analyzeMovement } from "@/analysis/analyzeMovement";
import { createDemoMovement } from "./demoMovement";

describe("demo movement", () => {
  it("is a flagged teaching demo that satisfies its declared level", () => {
    const movement = createDemoMovement();
    const { issues, placement, train } = analyzeMovement(movement);
    expect(movement.isTeachingDemo).toBe(true);
    expect(issues.filter((i) => i.severity !== "info")).toEqual([]);
    expect(placement.failures).toEqual([]);
    expect(train.unreachableShaftIds).toEqual([]);
  });
});
