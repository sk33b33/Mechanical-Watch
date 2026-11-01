import { describe, expect, it } from "vitest";
import { createTeachingMovement } from "@/app/teachingMovement";
import { createMovement, setDialColour, setHourMarkerLume } from "@/domain/movement";
import { movementPortrait, portraitHandAngle, PORTRAIT_TIME } from "./movementPortrait";

const teaching = createTeachingMovement();

describe("a saved movement's portrait for the carousel (ASM-0097)", () => {
  const portrait = movementPortrait(teaching);

  it("draws the teaching movement's dial: twelve markers on a ring, its windows, and its three hands", () => {
    expect(portrait).not.toBeNull();
    if (portrait === null) return;
    expect(portrait.markers).toHaveLength(12);
    for (const m of portrait.markers) expect(Math.hypot(m.x, m.y)).toBeGreaterThan(0.7);
    expect(portrait.markers.filter((m) => m.shape === "TRIANGLE_DOWN")).toHaveLength(1);
    expect(portrait.windows.length).toBeGreaterThan(0);
    expect(portrait.hands.map((h) => h.kind).sort()).toEqual(["HOURS", "MINUTES", "SECONDS"]);
  });

  it("puts 12 o'clock at the top and 3 o'clock on the right, as the dial is read", () => {
    if (portrait === null) throw new Error("no portrait");
    const triangle = portrait.markers.find((m) => m.shape === "TRIANGLE_DOWN");
    expect(triangle?.y).toBeLessThan(-0.7);
    expect(Math.abs(triangle?.x ?? 1)).toBeLessThan(1e-9);
    // Marker 3 is the one nearest the right-hand side.
    const rightmost = [...portrait.markers].sort((a, b) => b.x - a.x)[0];
    expect(rightmost?.x).toBeGreaterThan(0.7);
    expect(Math.abs(rightmost?.y ?? 1)).toBeLessThan(1e-6);
  });

  it("shows the colours the design chose, and lume instead of the hour marker colour when it is on", () => {
    const plain = movementPortrait(teaching);
    const red = movementPortrait(setDialColour(setDialColour(teaching, "dial", "#336699"), "hourMarkers", "#aa2200"));
    expect(plain?.dialColour).not.toBe("#336699");
    expect(red?.dialColour).toBe("#336699");
    expect(red?.markerTop).toBe("#aa2200");
    const lume = movementPortrait(setHourMarkerLume(setDialColour(teaching, "hourMarkers", "#aa2200"), true));
    expect(lume?.lume).toBe(true);
    expect(lume?.markerTop).not.toBe("#aa2200");
    expect(lume?.markerMetal).toBe(red?.markerMetal);
  });

  it("points the hands at the same time for every design", () => {
    expect(PORTRAIT_TIME).toEqual({ hours: 10, minutes: 10, seconds: 35 });
    expect(portraitHandAngle("SECONDS")).toBeCloseTo((35 / 60) * 2 * Math.PI, 12);
    expect(portraitHandAngle("MINUTES")).toBeCloseTo(((10 + 35 / 60) / 60) * 2 * Math.PI, 12);
    expect(portraitHandAngle("HOURS")).toBeCloseTo(((10 + 10 / 60 + 35 / 3600) / 12) * 2 * Math.PI, 12);
  });

  it("has no portrait for a movement with no dial", () => {
    expect(movementPortrait(createMovement("Empty", false))).toBeNull();
  });
});
