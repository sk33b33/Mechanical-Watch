import type { AssumptionId } from "@/reference/assumptions";

/**
 * The carousel of saved movements (follow-up 53): pure motion and layout maths, with no DOM, so it is deterministic and
 * testable. It is presentation only (L0 visual, ASM-0004, ASM-0097): the carousel decides how a ring of cards looks and
 * moves, never anything about a movement.
 *
 * Model: n cards stand on a ring, `step = 2 pi / n` apart. The ring has an angle; a card's place on screen is its own
 * ring angle plus that angle (0 is the front, facing the viewer, positive turns towards the viewer's right). Card i sits at
 * the front when `angle = -i * step` (modulo a full turn).
 *
 * Motion is a simple damped one: the ring's spin decays by friction, and as it slows a magnet (a spring and a damper
 * towards the nearest slot) takes over, so the ring comes to rest with a card locked at the front. It is a feel, not a
 * physics model of anything.
 */
export const CAROUSEL = {
  /** Spin decays as e^(-friction t): about a second to lose two thirds of its speed. */
  friction: 1.15,
  /** Spring constant (1/s^2) of the magnet towards the nearest slot. */
  magnetStiffness: 36,
  /** Damping (1/s) of the magnet: about critical for the stiffness, so the lock does not wobble. */
  magnetDamping: 12,
  /** Below this spin speed (rad/s) the magnet is fully on; above it, it fades out so a fast spin is free. */
  captureSpeed: 2.2,
  /** The fastest spin a flick can give (rad/s). */
  maxSpeed: 12,
  /** The ring counts as locked when this close (radians) to a slot and this slow (rad/s). */
  settleAngle: 1e-4,
  settleSpeed: 1e-3,
  /** Radians of ring turned per pixel dragged. */
  dragRadiansPerPixel: 0.0045,
  /** Only the last this-many seconds of a drag set the flick's speed. */
  flickWindowSeconds: 0.1,
  /** A press shorter than this (ms) and moving less than this (px) is a tap, not a drag. */
  tapMaxMilliseconds: 450,
  tapMaxMovePixels: 8,
  /** Cards hover this far (px) up and down, one full cycle per this many seconds, each offset in phase from the next. */
  hoverAmplitudePixels: 8,
  hoverPeriodSeconds: 3.4,
  hoverPhasePerCard: 1.7,
  /** The longest step (s) the motion is integrated in; longer frames are split. */
  maxSubstep: 1 / 120,
  assumption: "ASM-0097" satisfies AssumptionId,
} as const;

export interface RingState {
  /** Ring angle, radians. Unbounded (it keeps counting turns); use `frontIndex` to read which card is in front. */
  readonly angle: number;
  /** Spin, radians per second. */
  readonly velocity: number;
}

/** Angle between neighbouring cards. */
export function slotStep(count: number): number {
  return count <= 0 ? 0 : (2 * Math.PI) / count;
}

/** The ring angle at which card `index` is at the front and nearest to `near`. */
export function angleForIndex(index: number, count: number, near = 0): number {
  const step = slotStep(count);
  if (step === 0) return 0;
  const base = -index * step;
  const turns = Math.round((near - base) / (2 * Math.PI));
  return base + turns * 2 * Math.PI;
}

/** The index of the card nearest the front at this ring angle. */
export function frontIndex(angle: number, count: number): number {
  if (count <= 0) return -1;
  const step = slotStep(count);
  const raw = Math.round(-angle / step);
  return ((raw % count) + count) % count;
}

/** The nearest slot's ring angle (continuous: not wrapped to one turn). */
export function snapTarget(angle: number, count: number): number {
  const step = slotStep(count);
  return step === 0 ? 0 : -Math.round(-angle / step) * step;
}

/** The magnet's strength, 0 (a fast spin, free) to 1 (slow enough to lock). */
export function magnetStrength(velocity: number): number {
  return Math.min(1, Math.max(0, 1 - Math.abs(velocity) / CAROUSEL.captureSpeed));
}

/** A spin speed limited to what a flick may give. */
export function clampSpeed(velocity: number): number {
  return Math.max(-CAROUSEL.maxSpeed, Math.min(CAROUSEL.maxSpeed, velocity));
}

/** Advances the ring by `seconds`: friction, then the magnet as it slows; locks exactly once it has settled. */
export function stepRing(state: RingState, count: number, seconds: number): RingState {
  if (count <= 1) return { angle: 0, velocity: 0 };
  let { angle, velocity } = state;
  let remaining = Math.max(0, seconds);
  while (remaining > 0) {
    const dt = Math.min(remaining, CAROUSEL.maxSubstep);
    remaining -= dt;
    velocity *= Math.exp(-CAROUSEL.friction * dt);
    const strength = magnetStrength(velocity);
    const error = angle - snapTarget(angle, count);
    velocity += (-CAROUSEL.magnetStiffness * strength * error - CAROUSEL.magnetDamping * strength * velocity) * dt;
    velocity = clampSpeed(velocity);
    angle += velocity * dt;
    const target = snapTarget(angle, count);
    if (Math.abs(angle - target) < CAROUSEL.settleAngle && Math.abs(velocity) < CAROUSEL.settleSpeed) {
      return { angle: target, velocity: 0 };
    }
  }
  return { angle, velocity };
}

/** Whether the ring is at rest locked on a slot. */
export function isLocked(state: RingState, count: number): boolean {
  return count <= 1 || (state.velocity === 0 && Math.abs(state.angle - snapTarget(state.angle, count)) < CAROUSEL.settleAngle);
}

export interface DragSample { readonly time: number; readonly angle: number }

/** The spin a drag leaves the ring with, from its recent samples (times in seconds): the slope over the last window. */
export function flickVelocity(samples: readonly DragSample[], releasedAt: number): number {
  const recent = samples.filter((s) => releasedAt - s.time <= CAROUSEL.flickWindowSeconds);
  const first = recent[0];
  const last = recent[recent.length - 1];
  if (first === undefined || last === undefined || last.time - first.time < 1e-3) return 0;
  // A drag that was held still before letting go is not a flick.
  if (releasedAt - last.time > CAROUSEL.flickWindowSeconds / 2) return 0;
  return clampSpeed((last.angle - first.angle) / (last.time - first.time));
}

/** The ring's radius so that neighbouring cards of `cardWidth` (plus `gap`) just fit side by side on it. */
export function ringRadius(count: number, cardWidth: number, gap: number): number {
  if (count <= 1) return 0;
  return (cardWidth + gap) / (2 * Math.sin(Math.PI / count));
}

/** How far a card hovers from its resting height (px, positive down) at time `seconds`; cards are out of step with each other. */
export function hoverOffset(index: number, seconds: number): number {
  const phase = index * CAROUSEL.hoverPhasePerCard;
  return CAROUSEL.hoverAmplitudePixels * Math.sin(((2 * Math.PI) / CAROUSEL.hoverPeriodSeconds) * seconds + phase);
}

/** A card's displayed angle about the front, wrapped to (-pi, pi]. */
export function displayAngle(index: number, count: number, angle: number): number {
  const raw = index * slotStep(count) + angle;
  const wrapped = ((((raw + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
  return wrapped === -Math.PI ? Math.PI : wrapped;
}

/** A card's opacity from its displayed angle: full at the front, fading towards the sides, none once it is behind the ring. */
export function cardOpacity(displayed: number): number {
  const front = Math.cos(displayed);
  if (front <= 1e-9) return 0;
  return 0.25 + 0.75 * front;
}
