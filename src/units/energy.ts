/** Energy in joules (SI). Displayed in µJ at the UI boundary. */
export type Energy = number & { readonly __unit: "Energy_J" };

export function joules(value: number): Energy {
  return value as Energy;
}

export function toMicrojoules(value: Energy): number {
  return value * 1e6;
}
