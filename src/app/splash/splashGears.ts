import { metres, type Length } from "@/units/length";
import { meshCentreDistance, meshSpeedRatio } from "@/math/gearMath";

/**
 * The splash screen's backdrop: a short train of meshing gears drawn as glowing outlines.
 *
 * It is decoration (L0 visual, ASM-0004): simple trapezoidal teeth, not involute, and no part of
 * the movement model. It does reuse the project's own gear relations, so what turns on the splash
 * obeys them: centre distance a = m (z1 + z2) / 2 and speed ratio ω2/ω1 = -z1/z2 (REF-ENG §5.2,
 * §5.3, `src/math/gearMath.ts`), and the teeth interlock (see `meshedAngle`).
 */

/** One gear of the splash train. Positions are in module units, so the layout scales to any canvas. */
export interface SplashGear {
  readonly teeth: number;
  /** Centre, in module units, relative to the first gear. */
  readonly x: number;
  readonly y: number;
  /** Index of the gear this one meshes with (always an earlier gear), or null for the driver. */
  readonly drivenBy: number | null;
  /** Direction, in radians, from the driving gear's centre to this one; unused for the driver. */
  readonly directionFromDriver: number;
  readonly spokes: number;
}

/** Module used while laying the train out; the canvas scale converts module units to pixels. */
const LAYOUT_MODULE = metres(1);

/** The teeth counts and the direction of each mesh (degrees, screen y down), chosen for the composition. */
const TRAIN_SPEC: readonly { teeth: number; drivenBy: number | null; directionDegrees: number; spokes: number }[] = [
  { teeth: 60, drivenBy: null, directionDegrees: 0, spokes: 5 },
  { teeth: 36, drivenBy: 0, directionDegrees: -32, spokes: 5 },
  { teeth: 20, drivenBy: 1, directionDegrees: -95, spokes: 0 },
  { teeth: 44, drivenBy: 0, directionDegrees: 168, spokes: 5 },
  { teeth: 16, drivenBy: 3, directionDegrees: 235, spokes: 0 },
  { teeth: 28, drivenBy: 1, directionDegrees: 38, spokes: 5 },
];

export function splashGearTrain(): SplashGear[] {
  const gears: SplashGear[] = [];
  for (const spec of TRAIN_SPEC) {
    const direction = (spec.directionDegrees * Math.PI) / 180;
    if (spec.drivenBy === null) {
      gears.push({ teeth: spec.teeth, x: 0, y: 0, drivenBy: null, directionFromDriver: 0, spokes: spec.spokes });
      continue;
    }
    const driver = gears[spec.drivenBy];
    if (driver === undefined) throw new Error("splash gear train: a gear is driven by one that does not exist yet");
    const distance: Length = meshCentreDistance(LAYOUT_MODULE, driver.teeth, spec.teeth);
    gears.push({
      teeth: spec.teeth,
      x: driver.x + distance * Math.cos(direction),
      y: driver.y + distance * Math.sin(direction),
      drivenBy: spec.drivenBy,
      directionFromDriver: direction,
      spokes: spec.spokes,
    });
  }
  return gears;
}

/**
 * The angle of a driven gear, given its driver's angle, so their teeth interlock.
 * `direction` is the angle from the driver's centre to the driven gear's. When a driver tooth
 * points straight at the driven gear, the driven gear has a gap there; from then on it turns at
 * -z1/z2 times the driver (`meshSpeedRatio`). Tooth k of a gear at angle θ is at θ + 2πk/z.
 */
export function meshedAngle(driverAngle: number, driverTeeth: number, drivenTeeth: number, direction: number): number {
  const ratio = meshSpeedRatio(driverTeeth, drivenTeeth);
  return direction + Math.PI - Math.PI / drivenTeeth + ratio * (driverAngle - direction);
}

/** Every gear's angle for a given angle of the first (driving) gear. */
export function splashGearAngles(train: readonly SplashGear[], driverAngle: number): number[] {
  const angles: number[] = [];
  for (const gear of train) {
    if (gear.drivenBy === null) {
      angles.push(driverAngle);
      continue;
    }
    const driver = train[gear.drivenBy];
    const driverGearAngle = angles[gear.drivenBy];
    if (driver === undefined || driverGearAngle === undefined) throw new Error("splash gear train: driver missing");
    angles.push(meshedAngle(driverGearAngle, driver.teeth, gear.teeth, gear.directionFromDriver));
  }
  return angles;
}

/** Tooth proportions as fractions of the module (decorative; not a standard tooth form). */
export const SPLASH_TOOTH = { addendum: 1, dedendum: 1.25, tipWidthFraction: 0.28, rootWidthFraction: 0.5 } as const;

export interface Point { readonly x: number; readonly y: number }

/**
 * The outline of a gear of `teeth` teeth at `angle`, in module units about its own centre:
 * four points per tooth (root-left, tip-left, tip-right, root-right) on the dedendum and addendum circles.
 */
export function gearOutline(teeth: number, angle: number): Point[] {
  const pitch = teeth / 2;
  const tip = pitch + SPLASH_TOOTH.addendum;
  const root = pitch - SPLASH_TOOTH.dedendum;
  const step = (2 * Math.PI) / teeth;
  const points: Point[] = [];
  for (let k = 0; k < teeth; k += 1) {
    const centre = angle + k * step;
    const at = (radius: number, offset: number): Point => ({
      x: radius * Math.cos(centre + offset),
      y: radius * Math.sin(centre + offset),
    });
    points.push(
      at(root, -SPLASH_TOOTH.rootWidthFraction * step),
      at(tip, -SPLASH_TOOTH.tipWidthFraction * step),
      at(tip, SPLASH_TOOTH.tipWidthFraction * step),
      at(root, SPLASH_TOOTH.rootWidthFraction * step),
    );
  }
  return points;
}

/** The bounding box of the whole train (module units), for fitting it to a canvas. */
export function splashTrainBounds(train: readonly SplashGear[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const g of train) {
    const reach = g.teeth / 2 + SPLASH_TOOTH.addendum;
    minX = Math.min(minX, g.x - reach);
    minY = Math.min(minY, g.y - reach);
    maxX = Math.max(maxX, g.x + reach);
    maxY = Math.max(maxY, g.y + reach);
  }
  return { minX, minY, maxX, maxY };
}

/** `?splash=off` skips the splash screen (for automated tests, embedding and screenshots). */
export function splashDisabled(search: string): boolean {
  return new URLSearchParams(search).get("splash") === "off";
}

/**
 * Tilt-to-look-around (follow-up 44). A phone's orientation sensor reports the tilt `gamma` (about its long
 * axis, left to right) and `beta` (front to back) in degrees. The first reading is taken as "level" whatever the
 * way the phone is held, and tilting from it pans the view over the scene, which is larger than the screen: the
 * decorative complication parts (`SPLASH_PARTS`) wait just beyond its edges. Screen rotation swaps the axes.
 */
export const TILT = {
  /** A tilt this far from level (degrees) pans the view as far as it goes. */
  fullTiltDegrees: 22,
  /** Hand tremor below this (degrees) is ignored. */
  deadZoneDegrees: 1.5,
  /** The farthest the view pans, as a fraction of the screen's width and height. */
  panFraction: 0.46,
  /** The same for a mouse pointer, which only nudges the view (no tilt to reach the parts with). */
  pointerPanFraction: 0.06,
} as const;

export interface TiltReading { readonly gamma: number; readonly beta: number }

function shaped(delta: number): number {
  const magnitude = Math.abs(delta);
  if (magnitude <= TILT.deadZoneDegrees) return 0;
  const scaled = Math.min(1, (magnitude - TILT.deadZoneDegrees) / (TILT.fullTiltDegrees - TILT.deadZoneDegrees));
  return Math.sign(delta) * scaled;
}

/**
 * The view input, each axis in [-1, 1] (+x: tilted to the user's right, +y: tilted towards the user's bottom edge
 * down), from a reading, the "level" reading and the screen's rotation angle (0, 90, 180 or 270 degrees).
 */
export function tiltInput(reading: TiltReading, level: TiltReading, screenAngleDegrees: number): { x: number; y: number } {
  const dg = reading.gamma - level.gamma;
  const db = reading.beta - level.beta;
  const turns = ((Math.round(screenAngleDegrees / 90) % 4) + 4) % 4;
  const [x, y] =
    turns === 0 ? [dg, db] :
    turns === 1 ? [db, -dg] :
    turns === 2 ? [-dg, -db] :
    [-db, dg];
  return { x: shaped(x), y: shaped(y) };
}

/**
 * Complication parts drawn beyond the screen edges, in the same glowing outline as the gears (decorative only,
 * L0 visual, ASM-0004: shapes of real complication parts, not the movement's own). `ax`, `ay` place the centre as a
 * fraction of the screen's width and height from its centre; `radius` is a fraction of the shorter side.
 */
export interface SplashPart {
  readonly kind: "MOON" | "DATE_STAR" | "MONTH_STAR" | "BALANCE" | "YEAR_COUNTER" | "SEASON";
  readonly ax: number;
  readonly ay: number;
  readonly radius: number;
  /** Slow turn of the part (radians per second); the balance swings instead and the counter stays still. */
  readonly spin: number;
}

export const SPLASH_PARTS: readonly SplashPart[] = [
  { kind: "MOON", ax: -0.78, ay: -0.3, radius: 0.2, spin: 0.05 },
  { kind: "DATE_STAR", ax: 0.78, ay: -0.3, radius: 0.17, spin: -0.04 },
  { kind: "MONTH_STAR", ax: -0.8, ay: 0.36, radius: 0.15, spin: 0.045 },
  { kind: "BALANCE", ax: 0.78, ay: 0.4, radius: 0.17, spin: 0 },
  { kind: "YEAR_COUNTER", ax: 0.04, ay: -0.78, radius: 0.12, spin: 0 },
  { kind: "SEASON", ax: 0.0, ay: 0.8, radius: 0.12, spin: 0.03 },
];

/** Whether a part (a circle of `radiusPx` about its centre) overlaps the screen once the view is panned by `pan`. */
export function partOnScreen(part: SplashPart, width: number, height: number, pan: { x: number; y: number }): boolean {
  const radiusPx = part.radius * Math.min(width, height);
  const cx = width / 2 + part.ax * width + pan.x;
  const cy = height / 2 + part.ay * height + pan.y;
  return cx + radiusPx > 0 && cx - radiusPx < width && cy + radiusPx > 0 && cy - radiusPx < height;
}

/**
 * The lit part of a moon of `phase` (0 new, 0.5 full, 1 new again) as a polygon about the icon's centre, for the
 * decorative moon wheel waiting off screen (waxing lit on the left, waning on the right, the Southern Hemisphere
 * look the dial itself uses, ASM-0072). Bounded by the lit limb and a half-ellipse terminator, so its area is
 * the usual (1 - cos 2 pi p) / 2 of the disc. Empty for a new moon.
 */
export function moonLitPoints(phase: number, radius: number, samples = 24): Point[] {
  const wrapped = ((phase % 1) + 1) % 1;
  if (wrapped === 0) return [];
  const side = wrapped <= 0.5 ? -1 : 1;
  const terminator = side * radius * Math.cos(2 * Math.PI * wrapped);
  const points: Point[] = [];
  for (let i = 0; i <= samples; i += 1) {
    const t = -Math.PI / 2 + (Math.PI * i) / samples;
    points.push({ x: side * radius * Math.cos(t), y: radius * Math.sin(t) });
  }
  for (let i = 0; i <= samples; i += 1) {
    const t = Math.PI / 2 - (Math.PI * i) / samples;
    points.push({ x: terminator * Math.cos(t), y: radius * Math.sin(t) });
  }
  return points;
}
