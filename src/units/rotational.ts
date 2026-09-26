/**
 * Rotational dynamics quantities in SI (REF-ENG §4): moment of inertia in
 * kg·m² and torsional stiffness in N·m/rad. Watchmaking display units
 * (mg·cm², µN·mm/rad) exist only at the UI boundary.
 */
export type MomentOfInertia = number & { readonly __unit: "MomentOfInertia_kgm2" };
export type TorsionalStiffness = number & { readonly __unit: "TorsionalStiffness_Nm_per_rad" };

/** 1 mg·cm² = 1e-6 kg × 1e-4 m² = 1e-10 kg·m². */
const KG_M2_PER_MG_CM2 = 1e-10;
/** 1 µN·mm = 1e-6 N × 1e-3 m = 1e-9 N·m. */
const NM_PER_UN_MM = 1e-9;

export function kilogramSquareMetres(value: number): MomentOfInertia {
  return value as MomentOfInertia;
}

export function milligramSquareCentimetres(value: number): MomentOfInertia {
  return (value * KG_M2_PER_MG_CM2) as MomentOfInertia;
}

export function toMilligramSquareCentimetres(value: MomentOfInertia): number {
  return value / KG_M2_PER_MG_CM2;
}

export function newtonMetresPerRadian(value: number): TorsionalStiffness {
  return value as TorsionalStiffness;
}

export function micronewtonMillimetresPerRadian(value: number): TorsionalStiffness {
  return (value * NM_PER_UN_MM) as TorsionalStiffness;
}

export function toMicronewtonMillimetresPerRadian(value: TorsionalStiffness): number {
  return value / NM_PER_UN_MM;
}
