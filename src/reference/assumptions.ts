/** Mirror of reference/assumptions/ASSUMPTION_REGISTER.md (kept in sync by registers.test.ts). */
export type AssumptionStatus = "Active" | "Pending" | "Planned" | "Permanent";

export interface Assumption {
  id: AssumptionId;
  summary: string;
  scope: string;
  status: AssumptionStatus;
}

export const ASSUMPTIONS = {
  "ASM-0001": {
    summary: "Ideal rigid gears for initial kinematics",
    scope: "Gear sandbox",
    status: "Active",
  },
  "ASM-0002": {
    summary: "Constant efficiency may be used only when explicitly configured",
    scope: "Torque model",
    status: "Pending",
  },
  "ASM-0003": {
    summary: "Escapement begins as a simplified kinematic model",
    scope: "Escapement",
    status: "Planned",
  },
  "ASM-0004": {
    summary: "Visual mesh does not establish manufacturing validity",
    scope: "Entire app",
    status: "Permanent",
  },
  "ASM-0005": {
    summary:
      "Tooth visualization uses generic basic-rack proportions (addendum 1.0 × module, dedendum 1.25 × module, trapezoidal flanks); visual (L0) only, not an involute or horological profile",
    scope: "Geometry / viewport",
    status: "Active",
  },
  "ASM-0006": {
    summary: "All shaft axes are parallel and perpendicular to the mainplate plane",
    scope: "Shafts / kinematics",
    status: "Active",
  },
  "ASM-0007": {
    summary:
      "The drive is a prescribed angular velocity (kinematic input); no energy source, torque or mainspring is modeled",
    scope: "Gear sandbox",
    status: "Active",
  },
  "ASM-0008": {
    summary:
      "Numerical parameters (comparison tolerances, fixed simulation timestep) are numerical-method choices, not physical or manufacturing values",
    scope: "Math / simulation",
    status: "Active",
  },
  "ASM-0009": {
    summary: "Demo movement dimensions are illustrative design inputs, not sourced watch specifications",
    scope: "Demo movement",
    status: "Active",
  },
  "ASM-0010": {
    summary:
      "Frames (mainplate, bridges) are flat slabs of uniform thickness; pillars, screws, recesses and sinks are not modeled",
    scope: "Frames / interference",
    status: "Active",
  },
  "ASM-0011": {
    summary:
      "Bearing faces are flush with the frames' inner faces; cap jewels, chatons and oil sinks are not modeled",
    scope: "Bearings / endshake",
    status: "Active",
  },
  "ASM-0012": {
    summary:
      "Arbors and jewels are drawn at placeholder sizes when their dimensions are unknown; visual (L0) only",
    scope: "Viewport",
    status: "Active",
  },
  "ASM-0013": {
    summary:
      "Side shake is reported as diametral clearance (bore − pivot diameter); the horological convention is still to be confirmed against a source",
    scope: "Bearings / side shake",
    status: "Active",
  },
  "ASM-0014": {
    summary:
      "Time display uses a 12-hour dial on the −Z side of the mainplate; hands turn clockwise seen from the dial (hours 1 rev/12 h, minutes 1 rev/h, seconds 1 rev/min, by definition)",
    scope: "Time display",
    status: "Active",
  },
  "ASM-0015": {
    summary:
      "A friction clutch is kinematic only: fully engaged while running, freely slipping while setting the hands; slip torque is not modeled, and the going train keeps running during setting (no stop-seconds)",
    scope: "Motion works / hand setting",
    status: "Active",
  },
  "ASM-0016": {
    summary:
      "Hands are not modeled; they are drawn only as indicators of their arbor's simulated angle (length, shape and stacking are visual)",
    scope: "Viewport",
    status: "Active",
  },
  "ASM-0017": {
    summary:
      "Tolerance analysis is a worst-case (arithmetic) stack of declared limits; distributions are recorded but not used, and untoleranced inputs are taken at nominal and reported as such",
    scope: "Tolerances",
    status: "Active",
  },
  "ASM-0018": {
    summary:
      "A mainspring's inner end is on the barrel arbor and its outer end on the drum, so the arbor is wound in the direction the drum turns when running; spring torque and energy are not modeled",
    scope: "Barrel / winding",
    status: "Active",
  },
  "ASM-0019": {
    summary:
      "Keyless works: the stem lies in a plane parallel to the mainplate; each stem pinion engages its wheel at a right angle as rolling pitch circles (|ω1 z1| = |ω2 z2|), on the crown side of the wheel's axis; the setting lever, yoke, springs and ratchet (Breguet) teeth are represented only by two stem positions and a one-way coupling",
    scope: "Keyless works",
    status: "Active",
  },
  "ASM-0020": {
    summary:
      "The dial is a flat disc of uniform thickness; feet, holes and printing are not modeled, and the hour markers drawn on it are visual",
    scope: "Dial",
    status: "Active",
  },
} as const satisfies Record<string, Omit<Assumption, "id">>;

export type AssumptionId = keyof typeof ASSUMPTIONS;

export function listAssumptions(): Assumption[] {
  return (Object.keys(ASSUMPTIONS) as AssumptionId[]).map((id) => ({ id, ...ASSUMPTIONS[id] }));
}
