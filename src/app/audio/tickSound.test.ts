import { describe, expect, it } from "vitest";
import { createTeachingMovement } from "@/app/teachingMovement";
import { AppStore } from "@/app/store";
import { createMovement } from "@/domain/movement";
import { beatIndex, isForwardBeat, modelBeatHertz, TICK_SOUND } from "./tickSound";

describe("watch tick on the escapement beat (ASM-0084, decorative)", () => {
  it("takes its rate from the model: the teaching movement beats 5 times a second (18,000 an hour)", () => {
    expect(modelBeatHertz(new AppStore(createTeachingMovement()))).toBeCloseTo(5, 3);
  });

  it("is silent for a movement with no escapement", () => {
    expect(modelBeatHertz(new AppStore(createMovement("No escapement", false)))).toBeNull();
  });

  it("numbers beats from simulated time", () => {
    expect(beatIndex(0, 5)).toBe(0);
    expect(beatIndex(0.199, 5)).toBe(0);
    expect(beatIndex(0.2, 5)).toBe(1);
    expect(beatIndex(1, 5)).toBe(5);
  });

  it("ticks on the next beat, and on a slow frame that spans a few", () => {
    expect(isForwardBeat(4, 5, 1)).toBe(true);
    expect(isForwardBeat(4, 7, 1)).toBe(true);
  });

  it("does not tick on a repeat, a backward move or a jump (setting the hands, reset, set-to-browser-time)", () => {
    expect(isForwardBeat(5, 5, 1)).toBe(false);
    expect(isForwardBeat(5, 4, 1)).toBe(false);
    expect(isForwardBeat(5, 5 + TICK_SOUND.maxBeatsPerFrame + 1, 1)).toBe(false);
    expect(isForwardBeat(5, 100000, 1)).toBe(false);
  });

  it("is muted faster than real time (the ticks would run together) but plays at real time and slower", () => {
    expect(TICK_SOUND.maxPlaybackRate).toBe(1);
    expect(isForwardBeat(4, 5, 0.1)).toBe(true);
    expect(isForwardBeat(4, 5, 10)).toBe(false);
    expect(isForwardBeat(4, 5, 60)).toBe(false);
  });
});
