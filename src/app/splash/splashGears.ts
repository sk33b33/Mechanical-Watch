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
