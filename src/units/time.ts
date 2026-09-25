/** Time is stored internally in seconds (SI). */
export type TimeSpan = number & { readonly __unit: "Time_s" };

export function seconds(value: number): TimeSpan {
  return value as TimeSpan;
}

export function minutes(value: number): TimeSpan {
  return (value * 60) as TimeSpan;
}

export function toSeconds(time: TimeSpan): number {
  return time;
}

export function toMinutes(time: TimeSpan): number {
  return time / 60;
}
