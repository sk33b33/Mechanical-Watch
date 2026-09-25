import type { AssumptionId } from "./assumptions";

/**
 * Numerical-method parameters. These are floating-point / integration
 * choices, NOT physical or manufacturing tolerances (ASM-0008). A
 * manufacturing tolerance model does not exist yet (MFG-001).
 */
export const NUMERICAL_PARAMETERS = {
  /** Absolute tolerance when comparing a placed centre distance to the ideal one, in metres. */
  centreDistanceToleranceMetres: 1e-9,
  /** Relative tolerance when two solver paths are compared for the same shaft. */
  solverRelativeTolerance: 1e-6,
  /** Fixed simulation timestep, in seconds (SIM-002). */
  simulationTimestepSeconds: 1 / 240,
  /** Upper bound on fixed steps per advance call, so a stalled tab cannot freeze the page. */
  maxSimulationStepsPerAdvance: 240,
  assumption: "ASM-0008" satisfies AssumptionId,
} as const;
