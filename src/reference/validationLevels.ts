/**
 * reference/REFERENCE_ENGINEERING.md §15. Supersedes the four levels in
 * CLAUDE.md, which map as:
 *   GEOMETRIC -> L1, KINEMATIC -> L2, DYNAMIC_SIMPLIFIED -> L3,
 *   PHYSICAL_VALIDATION_PENDING -> any level below L5.
 * The software never upgrades a level automatically: a subsystem
 * DECLARES the level its model targets, and validation reports whether
 * that declared level is currently satisfied.
 */
export const VALIDATION_LEVELS = [
  "L0_VISUAL",
  "L1_GEOMETRIC",
  "L2_KINEMATIC",
  "L3_SIMPLIFIED_DYNAMIC",
  "L4_ENGINEERING_VALIDATED",
  "L5_PHYSICAL_VALIDATION",
] as const;

export type ValidationLevel = (typeof VALIDATION_LEVELS)[number];

export const VALIDATION_LEVEL_LABELS: Record<ValidationLevel, string> = {
  L0_VISUAL: "L0 Visual",
  L1_GEOMETRIC: "L1 Geometric",
  L2_KINEMATIC: "L2 Kinematic",
  L3_SIMPLIFIED_DYNAMIC: "L3 Simplified dynamic",
  L4_ENGINEERING_VALIDATED: "L4 Engineering validated",
  L5_PHYSICAL_VALIDATION: "L5 Physical validation",
};

export function levelRank(level: ValidationLevel): number {
  return VALIDATION_LEVELS.indexOf(level);
}
