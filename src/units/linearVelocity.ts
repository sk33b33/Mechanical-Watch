/** Linear velocity is stored internally in metres/second (SI). */
export type LinearVelocity = number & { readonly __unit: "LinearVelocity_mPerS" };

export function metresPerSecond(value: number): LinearVelocity {
  return value as LinearVelocity;
}

export function toMillimetresPerSecond(value: LinearVelocity): number {
  return value * 1000;
}
