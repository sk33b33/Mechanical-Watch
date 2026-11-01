import { describe, expect, it } from "vitest";
import { angleForIndex, CAROUSEL, cardOpacity, clampSpeed, displayAngle, flickVelocity, frontIndex, hoverOffset, isLocked, magnetStrength, ringRadius, slotStep, snapTarget, stepRing, type RingState } from "./carouselMath";

/** Runs the ring until it locks (or 30 s pass), at 60 frames per second. */
function spinDown(start: RingState, count: number): { state: RingState; seconds: number } {
  let state = start;
  let seconds = 0;
  while (!isLocked(state, count) && seconds < 30) {
    state = stepRing(state, count, 1 / 60);
    seconds += 1 / 60;
  }
  return { state, seconds };
}

describe("carousel slots", () => {
  it("cards stand 2 pi / n apart and card i is at the front when the ring is at -i steps", () => {
    expect(slotStep(8)).toBeCloseTo(Math.PI / 4, 12);
    expect(slotStep(0)).toBe(0);
    for (const i of [0, 1, 4, 7]) expect(frontIndex(angleForIndex(i, 8), 8)).toBe(i);
  });

  it("the front card is the nearest to the front, wrapping around the ring", () => {
    const step = slotStep(6);
    expect(frontIndex(0.4 * step, 6)).toBe(0);
    expect(frontIndex(-0.6 * step, 6)).toBe(1);
    expect(frontIndex(0.6 * step, 6)).toBe(5);
    expect(frontIndex(-7 * step, 6)).toBe(1); // a full turn and one more
    expect(frontIndex(0, 0)).toBe(-1);
  });

  it("snaps to the nearest slot, and picks the way round that is nearest to where the ring is", () => {
    const step = slotStep(5);
    expect(snapTarget(0.3 * step, 5)).toBeCloseTo(0, 12);
    expect(snapTarget(-0.7 * step, 5)).toBeCloseTo(-step, 12);
    expect(angleForIndex(1, 5, -10 * Math.PI)).toBeCloseTo(-step - 10 * Math.PI, 9);
  });
});

describe("spinning and locking", () => {
  it("a ring at rest on a slot stays locked and does not drift", () => {
    const start: RingState = { angle: angleForIndex(3, 7), velocity: 0 };
    expect(isLocked(start, 7)).toBe(true);
    const after = stepRing(start, 7, 5);
    expect(after.angle).toBeCloseTo(start.angle, 12);
    expect(after.velocity).toBe(0);
  });

  it("any flick, either way, comes to rest locked on a slot, and does not take forever", () => {
    for (const count of [2, 3, 5, 8, 13]) {
      for (const speed of [-12, -7.3, -2.5, -0.8, -0.1, 0.1, 0.8, 2.5, 7.3, 12]) {
        const { state, seconds } = spinDown({ angle: 0.37, velocity: speed }, count);
        expect(isLocked(state, count), `n=${String(count)} v=${String(speed)}`).toBe(true);
        expect(Math.abs(state.angle - snapTarget(state.angle, count))).toBeLessThan(CAROUSEL.settleAngle);
        expect(seconds, `n=${String(count)} v=${String(speed)}`).toBeLessThan(10);
      }
    }
  });

  it("spins the way it was flicked: the ring moves on in that direction first", () => {
    const right = stepRing({ angle: 0, velocity: 6 }, 8, 0.2);
    const left = stepRing({ angle: 0, velocity: -6 }, 8, 0.2);
    expect(right.angle).toBeGreaterThan(0.5);
    expect(left.angle).toBeLessThan(-0.5);
  });

  it("a fast flick spins past several cards before it settles, a slow one only to a neighbour", () => {
    const fast = spinDown({ angle: 0, velocity: 11 }, 10);
    const slow = spinDown({ angle: 0, velocity: 1.6 }, 10);
    const cards = (s: RingState): number => Math.abs(Math.round(s.angle / slotStep(10)));
    expect(cards(fast.state)).toBeGreaterThanOrEqual(4);
    expect(cards(slow.state)).toBeLessThanOrEqual(2);
  });

  it("slows gradually rather than stopping short: the speed only falls, never rises, until the magnet takes over", () => {
    let state: RingState = { angle: 0, velocity: 10 };
    let previous = Math.abs(state.velocity);
    for (let i = 0; i < 60; i += 1) {
      state = stepRing(state, 12, 1 / 60);
      if (Math.abs(state.velocity) > CAROUSEL.captureSpeed) {
        expect(Math.abs(state.velocity)).toBeLessThanOrEqual(previous + 1e-12);
        previous = Math.abs(state.velocity);
      }
    }
  });

  it("gives the same result however the time is cut up", () => {
    const whole = stepRing({ angle: 0.2, velocity: 5 }, 9, 0.9);
    let pieces: RingState = { angle: 0.2, velocity: 5 };
    for (let i = 0; i < 9; i += 1) pieces = stepRing(pieces, 9, 0.1);
    expect(pieces.angle).toBeCloseTo(whole.angle, 6);
    expect(pieces.velocity).toBeCloseTo(whole.velocity, 6);
  });

  it("one card, or none, cannot spin", () => {
    expect(stepRing({ angle: 1, velocity: 5 }, 1, 1)).toEqual({ angle: 0, velocity: 0 });
    expect(stepRing({ angle: 1, velocity: 5 }, 0, 1)).toEqual({ angle: 0, velocity: 0 });
  });

  it("the magnet is off in a fast spin and fully on when slow", () => {
    expect(magnetStrength(CAROUSEL.captureSpeed * 2)).toBe(0);
    expect(magnetStrength(0)).toBe(1);
    expect(magnetStrength(-CAROUSEL.captureSpeed / 2)).toBeCloseTo(0.5, 12);
    expect(clampSpeed(99)).toBe(CAROUSEL.maxSpeed);
    expect(clampSpeed(-99)).toBe(-CAROUSEL.maxSpeed);
  });
});

describe("flicks from a drag", () => {
  it("the speed is the slope of the last moments of the drag, with its sign", () => {
    const samples = [{ time: 0.00, angle: 0 }, { time: 0.05, angle: 0.1 }, { time: 0.10, angle: 0.3 }];
    expect(flickVelocity(samples, 0.10)).toBeCloseTo(3, 9);
    expect(flickVelocity(samples.map((s) => ({ ...s, angle: -s.angle })), 0.10)).toBeCloseTo(-3, 9);
  });

  it("a drag held still before release, or too short to tell, is not a flick", () => {
    const samples = [{ time: 0.0, angle: 0 }, { time: 0.05, angle: 0.4 }];
    expect(flickVelocity(samples, 0.5)).toBe(0);
    expect(flickVelocity([{ time: 0.0, angle: 0 }], 0.01)).toBe(0);
    expect(flickVelocity([], 0.01)).toBe(0);
  });

  it("very fast drags are limited", () => {
    expect(flickVelocity([{ time: 0, angle: 0 }, { time: 0.02, angle: 5 }], 0.03)).toBe(CAROUSEL.maxSpeed);
  });
});

describe("ring layout and hover", () => {
  it("the radius makes neighbouring cards touch edge to edge; it grows with the number of cards", () => {
    const width = 200;
    for (const n of [3, 6, 12]) {
      const r = ringRadius(n, width, 0);
      expect(2 * r * Math.sin(Math.PI / n)).toBeCloseTo(width, 9);
    }
    expect(ringRadius(12, 200, 20)).toBeGreaterThan(ringRadius(6, 200, 20));
    expect(ringRadius(1, 200, 20)).toBe(0);
  });

  it("cards hover up and down by the declared amount, each out of step with its neighbour, and never stray further", () => {
    let low = Infinity;
    let high = -Infinity;
    for (let t = 0; t < 10; t += 0.01) {
      const h = hoverOffset(0, t);
      low = Math.min(low, h);
      high = Math.max(high, h);
    }
    expect(high).toBeCloseTo(CAROUSEL.hoverAmplitudePixels, 1);
    expect(low).toBeCloseTo(-CAROUSEL.hoverAmplitudePixels, 1);
    expect(hoverOffset(0, 1)).not.toBeCloseTo(hoverOffset(1, 1), 3);
  });

  it("only the front of the ring shows: opaque at the front, fading to the sides, nothing behind", () => {
    expect(cardOpacity(0)).toBe(1);
    expect(cardOpacity(Math.PI / 2)).toBe(0);
    expect(cardOpacity(Math.PI)).toBe(0);
    expect(cardOpacity(Math.PI / 3)).toBeGreaterThan(cardOpacity(Math.PI / 2.2));
    expect(cardOpacity(-0.7)).toBeCloseTo(cardOpacity(0.7), 12);
  });

  it("a card's displayed angle wraps to the front-centred range", () => {
    expect(displayAngle(0, 4, 0)).toBe(0);
    expect(displayAngle(1, 4, 0)).toBeCloseTo(Math.PI / 2, 12);
    expect(displayAngle(3, 4, 0)).toBeCloseTo(-Math.PI / 2, 12);
    expect(displayAngle(2, 4, 0)).toBeCloseTo(Math.PI, 12);
    expect(displayAngle(0, 4, 7 * Math.PI)).toBeCloseTo(Math.PI, 12);
  });
});
