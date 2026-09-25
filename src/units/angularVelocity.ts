/**
 * Angular velocity is stored internally in radians/second (SI).
 * Sign convention: positive is counter-clockwise when viewed from the
 * positive axis direction, matching a right-handed coordinate system.
 */
export type AngularVelocity = number & { readonly __unit: "AngularVelocity_radPerS" };

export function radiansPerSecond(value: number): AngularVelocity {
  return value as AngularVelocity;
}

export function rpmToRadPerSecond(rpm: number): AngularVelocity {
  return ((rpm * 2 * Math.PI) / 60) as AngularVelocity;
}

export function toRadiansPerSecond(value: AngularVelocity): number {
  return value;
}

export function toRpm(value: AngularVelocity): number {
  return (value * 60) / (2 * Math.PI);
}
