import { describe, expect, it } from "vitest";
import { isForwardTick, secondsStep, TICK_SOUND } from "./tickSound";

describe("second-hand tick (ASM-0084, decorative)", () => {
  it("reads the dial second from the seconds-hand angle: 0-59, wrapping once a turn", () => {
    expect(secondsStep(0)).toBe(0);
    expect(secondsStep((2 * Math.PI) / 60 + 1e-6)).toBe(1);
    expect(secondsStep(Math.PI)).toBe(30);
    expect(secondsStep(2 * Math.PI - 1e-6)).toBe(59);
    expect(secondsStep(2 * Math.PI)).toBe(0);
    expect(secondsStep(-1e-6)).toBe(59);
  });

  it("ticks on exactly the next second, including 59 → 0", () => {
    expect(isForwardTick(10, 11, 1)).toBe(true);
    expect(isForwardTick(59, 0, 1)).toBe(true);
  });

  it("does not tick on a jump, a repeat or a backward move (setting the hands, reset, set-to-browser-time)", () => {
    expect(isForwardTick(10, 10, 1)).toBe(false);
    expect(isForwardTick(10, 12, 1)).toBe(false);
    expect(isForwardTick(10, 9, 1)).toBe(false);
    expect(isForwardTick(0, 59, 1)).toBe(false);
  });

  it("is muted faster than real time (the ticks would run together) but plays at real time and slower", () => {
    expect(TICK_SOUND.maxPlaybackRate).toBe(1);
    expect(isForwardTick(10, 11, 0.1)).toBe(true);
    expect(isForwardTick(10, 11, 10)).toBe(false);
    expect(isForwardTick(10, 11, 60)).toBe(false);
  });
});
