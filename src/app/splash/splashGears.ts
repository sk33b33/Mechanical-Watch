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

/**
 * The teeth counts and the direction of each mesh (degrees, screen y down), chosen for the composition. The first
 * `SPLASH_CORE_COUNT` gears are the hand-composed centrepiece shown on arrival; the rest (follow-up 51) carry the
 * train out in every direction so that a full tilt, which pans the view well past the centrepiece, still has gears
 * to look at instead of an empty screen. The tests check the field leaves no hole wider than `FIELD_GAP_FRACTION`.
 */
const TRAIN_SPEC: readonly { teeth: number; drivenBy: number | null; directionDegrees: number; spokes: number }[] = [
  { teeth: 60, drivenBy: null, directionDegrees: 0, spokes: 5 },
  { teeth: 36, drivenBy: 0, directionDegrees: -32, spokes: 5 },
  { teeth: 20, drivenBy: 1, directionDegrees: -95, spokes: 0 },
  { teeth: 44, drivenBy: 0, directionDegrees: 168, spokes: 5 },
  { teeth: 16, drivenBy: 3, directionDegrees: 235, spokes: 0 },
  { teeth: 28, drivenBy: 1, directionDegrees: 38, spokes: 5 },
  { teeth: 18, drivenBy: 5, directionDegrees: -51, spokes: 0 },
  { teeth: 36, drivenBy: 0, directionDegrees: -86, spokes: 5 },
  { teeth: 32, drivenBy: 7, directionDegrees: -122, spokes: 5 },
  { teeth: 56, drivenBy: 6, directionDegrees: -68, spokes: 5 },
  { teeth: 44, drivenBy: 4, directionDegrees: -66, spokes: 5 },
  { teeth: 44, drivenBy: 0, directionDegrees: 38, spokes: 5 },
  { teeth: 52, drivenBy: 5, directionDegrees: 23, spokes: 5 },
  { teeth: 16, drivenBy: 4, directionDegrees: -167, spokes: 0 },
  { teeth: 56, drivenBy: 3, directionDegrees: 134, spokes: 5 },
  { teeth: 48, drivenBy: 14, directionDegrees: -165, spokes: 5 },
  { teeth: 64, drivenBy: 9, directionDegrees: -35, spokes: 5 },
  { teeth: 28, drivenBy: 9, directionDegrees: 35, spokes: 5 },
  { teeth: 48, drivenBy: 12, directionDegrees: 10, spokes: 5 },
  { teeth: 44, drivenBy: 10, directionDegrees: -100, spokes: 5 },
  { teeth: 16, drivenBy: 15, directionDegrees: -108, spokes: 0 },
  { teeth: 18, drivenBy: 20, directionDegrees: -49, spokes: 0 },
  { teeth: 48, drivenBy: 21, directionDegrees: -128, spokes: 5 },
  { teeth: 36, drivenBy: 22, directionDegrees: -35, spokes: 5 },
  { teeth: 16, drivenBy: 13, directionDegrees: 134, spokes: 0 },
  { teeth: 14, drivenBy: 0, directionDegrees: 107, spokes: 0 },
  { teeth: 36, drivenBy: 11, directionDegrees: 38, spokes: 5 },
  { teeth: 24, drivenBy: 25, directionDegrees: 153, spokes: 0 },
  { teeth: 44, drivenBy: 8, directionDegrees: -28, spokes: 5 },
  { teeth: 56, drivenBy: 28, directionDegrees: -29, spokes: 5 },
];

/** How many of the first gears form the centrepiece the view is centred on. */
export const SPLASH_CORE_COUNT = 6;

/**
 * The train as laid out for a screen held upright (`portrait`) or on its side: the same train turned a quarter turn,
 * so the long way of the field follows the long way of the screen. Every mesh keeps its centre distance and its
 * interlock (`meshedAngle` takes the turned direction).
 */
export function splashGearTrain(portrait = false): SplashGear[] {
  const gears: SplashGear[] = [];
  const turn = portrait ? Math.PI / 2 : 0;
  for (const spec of TRAIN_SPEC) {
    const direction = (spec.directionDegrees * Math.PI) / 180 + turn;
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
export function splashTrainBounds(train: readonly SplashGear[], count = train.length): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const g of train.slice(0, count)) {
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
 * Tilt-to-look-around (follow-up 44, reworked in follow-up 51). A phone's orientation sensor reports three Euler
 * angles, `alpha`, `beta` and `gamma` in degrees (W3C Device Orientation: rotate about z, then x, then y). The first
 * reading is taken as "level" whatever the way the phone is held, and tilting from it pans the view over the scene,
 * which is larger than the screen: the decorative complication parts (`SPLASH_PARTS`) wait just beyond its edges.
 * Screen rotation swaps the axes.
 *
 * Euler angles are not continuous: with the phone standing nearly upright (beta near 90 degrees) a small movement can
 * flip gamma and alpha by large amounts at once, which made the view jump. So the angles are turned into a rotation
 * matrix first, the rotation from the "level" pose to the current one is taken, and the view follows that rotation's
 * components about the device's own axes, which vary smoothly with how the phone is really moved.
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
  /** The gear layer pans this fraction of the view (the parts beyond the edges pan the whole of it, so they come in faster). */
  gearsPanShare: 0.8,
  /** Natural frequency (rad/s) of the critically damped spring the pan follows its target with: about 0.5 s to settle. */
  springOmega: 9,
} as const;

export interface TiltReading { readonly gamma: number; readonly beta: number; readonly alpha?: number }

type Matrix3 = readonly [readonly [number, number, number], readonly [number, number, number], readonly [number, number, number]];

const DEGREES = Math.PI / 180;

const multiply = (a: Matrix3, b: Matrix3): Matrix3 => {
  const cell = (r: 0 | 1 | 2, c: 0 | 1 | 2): number => a[r][0] * b[0][c] + a[r][1] * b[1][c] + a[r][2] * b[2][c];
  return [[cell(0, 0), cell(0, 1), cell(0, 2)], [cell(1, 0), cell(1, 1), cell(1, 2)], [cell(2, 0), cell(2, 1), cell(2, 2)]];
};

/** The device-to-earth rotation of a reading: Rz(alpha) Rx(beta) Ry(gamma), the order the W3C specification defines. */
export function orientationMatrix(reading: TiltReading): Matrix3 {
  const a = (reading.alpha ?? 0) * DEGREES;
  const b = reading.beta * DEGREES;
  const g = reading.gamma * DEGREES;
  const rz: Matrix3 = [[Math.cos(a), -Math.sin(a), 0], [Math.sin(a), Math.cos(a), 0], [0, 0, 1]];
  const rx: Matrix3 = [[1, 0, 0], [0, Math.cos(b), -Math.sin(b)], [0, Math.sin(b), Math.cos(b)]];
  const ry: Matrix3 = [[Math.cos(g), 0, Math.sin(g)], [0, 1, 0], [-Math.sin(g), 0, Math.cos(g)]];
  return multiply(multiply(rz, rx), ry);
}

/**
 * How far the phone has turned from `level`, as a rotation vector in degrees: its x component is the turn about the
 * phone's own x axis (the beta direction) and its y component the turn about its y axis (the gamma direction), each
 * measured in the "level" pose's axes. For small turns about one axis these equal the changes in beta and gamma.
 */
export function tiltFromLevel(reading: TiltReading, level: TiltReading): { x: number; y: number } {
  const l = orientationMatrix(level);
  const c = orientationMatrix(reading);
  const transposed: Matrix3 = [[l[0][0], l[1][0], l[2][0]], [l[0][1], l[1][1], l[2][1]], [l[0][2], l[1][2], l[2][2]]];
  const r = multiply(transposed, c);
  const cosAngle = Math.max(-1, Math.min(1, (r[0][0] + r[1][1] + r[2][2] - 1) / 2));
  const angle = Math.acos(cosAngle);
  const sin = Math.sin(angle);
  // The axis-angle vector is (angle / (2 sin angle)) times the matrix's antisymmetric part; for a vanishing angle the
  // factor tends to 1/2, and near a half turn (never reached by a hand tilt) it is held finite.
  const factor = angle < 1e-6 ? 0.5 : angle / (2 * Math.max(sin, 1e-3));
  return { x: factor * (r[2][1] - r[1][2]) / DEGREES, y: factor * (r[0][2] - r[2][0]) / DEGREES };
}

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
  const turn = tiltFromLevel(reading, level);
  const dg = turn.y;
  const db = turn.x;
  const turns = ((Math.round(screenAngleDegrees / 90) % 4) + 4) % 4;
  const [x, y] =
    turns === 0 ? [dg, db] :
    turns === 1 ? [db, -dg] :
    turns === 2 ? [-dg, -db] :
    [-db, dg];
  return { x: shaped(x), y: shaped(y) };
}

/**
 * One step of a critically damped spring (the exact solution of x'' = -2w x' - w^2 (x - target) over `dt`): it starts
 * and stops without a kick and never overshoots a fixed target, so the view glides and the sensor's noise is smoothed.
 */
export function springStep(position: number, velocity: number, target: number, omega: number, dt: number): { position: number; velocity: number } {
  const offset = position - target;
  const decay = Math.exp(-omega * dt);
  const carried = velocity + omega * offset;
  return { position: target + (offset + carried * dt) * decay, velocity: (velocity - omega * carried * dt) * decay };
}

/** The farthest the view pans, in pixels, for a touch device that tilts or for a mouse that only nudges. */
export function panRange(width: number, height: number, tilt: boolean): { x: number; y: number } {
  const fraction = tilt ? TILT.panFraction : TILT.pointerPanFraction;
  return { x: fraction * width, y: fraction * height };
}

/** Fraction of the shorter side the first gear's radius covers: a phone that tilts gets larger gears, so fewer fill its field. */
const GEAR_SCALE_FRACTION = { pointer: 0.3, tilt: 0.42 } as const;

/** Pixels per module unit for a screen. */
export function splashGearScale(width: number, height: number, firstTeeth: number, tilt: boolean): number {
  return (Math.min(width, height) * (tilt ? GEAR_SCALE_FRACTION.tilt : GEAR_SCALE_FRACTION.pointer)) / (firstTeeth / 2);
}

/** The widest empty patch the gear field may leave anywhere in the panned view, as a fraction of the shorter side. */
export const FIELD_GAP_FRACTION = 0.25;

/**
 * The widest empty patch of the gear layer anywhere it can be seen, in pixels: the largest distance from a point in the
 * view, at any pan up to `panRange`, to the nearest gear's tip circle. Zero where the point is inside a gear. The gear
 * layer pans `gearsPanShare` of the view, so the region examined is the screen widened by that much of the pan range on
 * every side.
 */
export function gearFieldGap(width: number, height: number, tilt: boolean): number {
  const portrait = height > width;
  const train = splashGearTrain(portrait);
  const first = train[0];
  if (first === undefined) return Infinity;
  const scale = splashGearScale(width, height, first.teeth, tilt);
  const core = splashTrainBounds(train, SPLASH_CORE_COUNT);
  const centreX = (core.minX + core.maxX) / 2;
  const centreY = (core.minY + core.maxY) / 2;
  const range = panRange(width, height, tilt);
  const halfWidth = width / 2 + TILT.gearsPanShare * range.x;
  const halfHeight = height / 2 + TILT.gearsPanShare * range.y;
  const step = Math.min(width, height) / 40;
  let worst = 0;
  for (let dx = -halfWidth; dx <= halfWidth; dx += step) {
    for (let dy = -halfHeight; dy <= halfHeight; dy += step) {
      const x = centreX + dx / scale;
      const y = centreY + dy / scale;
      let nearest = Infinity;
      for (const g of train) nearest = Math.min(nearest, Math.hypot(g.x - x, g.y - y) - (g.teeth / 2 + SPLASH_TOOTH.addendum));
      worst = Math.max(worst, Math.max(0, nearest) * scale);
    }
  }
  return worst;
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
