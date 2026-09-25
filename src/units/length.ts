/**
 * Length is stored internally in metres (SI). Conversions to/from
 * watchmaking-friendly units (mm) happen only at the UI/domain boundary,
 * per docs/MASTER_BUILD_PROMPT.md "Units".
 */
export type Length = number & { readonly __unit: "Length_m" };

export function metres(value: number): Length {
  return value as Length;
}

export function millimetres(value: number): Length {
  return (value / 1000) as Length;
}

export function toMillimetres(length: Length): number {
  return length * 1000;
}

export function toMetres(length: Length): number {
  return length;
}
