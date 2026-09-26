/**
 * Frequency in hertz (cycles per second), kept distinct from angular
 * velocity in rad/s so a 2π factor can never be dropped silently
 * (UNIT-002, SRC-0002).
 */
export type Frequency = number & { readonly __unit: "Frequency_Hz" };

export function hertz(value: number): Frequency {
  return value as Frequency;
}

export function toHertz(value: Frequency): number {
  return value;
}

/** Beats per hour, a watchmaking display unit: a rate of events, here expressed in Hz. */
export function beatsPerHour(value: number): Frequency {
  return (value / 3600) as Frequency;
}

export function toBeatsPerHour(value: Frequency): number {
  return value * 3600;
}
