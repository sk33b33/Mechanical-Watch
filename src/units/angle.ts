/**
 * Angle is stored internally in radians (SI). Degrees are a display/UI
 * convenience only.
 */
export type Angle = number & { readonly __unit: "Angle_rad" };

export function radians(value: number): Angle {
  return value as Angle;
}

export function degrees(value: number): Angle {
  return ((value * Math.PI) / 180) as Angle;
}

export function toDegrees(angle: Angle): number {
  return (angle * 180) / Math.PI;
}

export function toRadians(angle: Angle): number {
  return angle;
}

export function normalizeAngle(angle: Angle): Angle {
  const twoPi = 2 * Math.PI;
  const wrapped = ((angle % twoPi) + twoPi) % twoPi;
  return wrapped as Angle;
}
