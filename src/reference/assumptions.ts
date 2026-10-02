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
    status: "Active",
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
      "Side shake is reported as diametral clearance (bore − pivot diameter); supported by SRC-0011's worked example (a .12mm pivot needs a .13mm jewel hole — a diameter-to-diameter difference), a Tier 6 forum source, not a published standard confirming the convention directly",
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
  "ASM-0021": {
    summary:
      "A Swiss lever escape wheel gives two beats per tooth (one at each pallet), and a beat is one swing of the balance (half its period); supported by SRC-0016 (corroborated by SRC-0017), both Tier 6/7 informal sources, not a published standard — accepted for the simplified model",
    scope: "Escapement",
    status: "Active",
  },
  "ASM-0022": {
    summary:
      "The balance is a sinusoidal kinematic approximation at a declared amplitude, at the frequency the train's speed requires; no inertia, hairspring torque, damping or amplitude dependence is modeled, so it does not govern the rate",
    scope: "Balance",
    status: "Active",
  },
  "ASM-0023": {
    summary:
      "The train is locked between beats and advances only in an impulse window, while the balance is within half the lift angle of its dead point; the pallet fork crosses between bankings in that window; locking, draw, drop, impact, sliding and banking geometry are not modeled",
    scope: "Escapement",
    status: "Active",
  },
  "ASM-0024": {
    summary:
      "The balance and hairspring are a linear, undamped torsional oscillator (I θ'' = −k θ, f = √(k/I)/2π) with inertia and stiffness entered directly; it is isochronous by construction, and escapement disturbance, amplitude, damping, position, temperature and hairspring geometry/material are not modeled",
    scope: "Balance (simplified dynamic, L3)",
    status: "Active",
  },
  "ASM-0025": {
    summary:
      "Pallet geometry is simplified: the pallets lock on the escape wheel's tip circle at two points a whole number of pitches plus a half apart, placed for tangential locking (pallet arbor where the tangents meet); total lever swing = lock + impulse + run; draw is an input whose adequacy against friction is not checked; tooth and pallet faces, drop and recoil are not modeled",
    scope: "Escapement geometry",
    status: "Active",
  },
  "ASM-0026": {
    summary:
      "Simplified energy model: mainspring torque varies linearly with wind between entered end values; torque reaches the escape wheel by power balance with an optional overall train efficiency (lossless upper bound otherwise); each beat delivers torque × half a pitch × escapement efficiency; the balance loses 2πE/Q per period; steady state only, and amplitude does not affect rate (ASM-0024)",
    scope: "Energy / amplitude (L3)",
    status: "Active",
  },
  "ASM-0027": {
    summary:
      "A gear mesh's worst-case centre distance over declared tolerances (module, and a FIXED shaft's own X/Y position) is a first-order (Taylor) expansion around the placement solver's own distance, not an exact 2D optimization; it is exact for the module term (distance scales linearly with it) and a linear approximation for a position term, matching the linear worst-case approach already used for side shake and endshake; a shaft whose placement is solved (MESH_POLAR, COAXIAL) contributes nothing here, since this does not chain into whatever it is placed from",
    scope: "Tolerances / gear meshes",
    status: "Active",
  },
  "ASM-0028": {
    summary:
      "Endshake advisory thresholds (~0.05 mm for escapement shafts — escape wheel, pallet arbor, balance staff; ~0.10 mm for other pivoted shafts) are informal figures from forum testimony (SRC-0011), not a published standard; used only as a BRG-006 informational advisory, never a pass/fail limit. (Side shake has its own advisory, ASM-0029/BRG-007, sourced separately)",
    scope: "Bearings / endshake advisory",
    status: "Active",
  },
  "ASM-0029": {
    summary:
      "Side-shake advisory thresholds (0.01 mm diametral for a pivot up to 0.30 mm, 0.02 mm for a larger pivot) are an informal rule of thumb credited to Hans Jendritzki, from forum testimony (SRC-0012, corroborated by SRC-0013), not a published standard read directly; used only as a BRG-007 informational advisory, never a pass/fail limit",
    scope: "Bearings / side-shake advisory",
    status: "Active",
  },
  "ASM-0030": {
    summary:
      "INVOLUTE_PROFILE tooth geometry uses the standard full-depth metric system (SRC-0024: 20° pressure angle, addendum 1.00m, dedendum 1.25m, zero profile shift, zero backlash); a generic machine-gear convention, not a horological one (REF-ENG §6, CLAUDE_REFERENCE_INSTRUCTIONS.md rule 10)",
    scope: "Geometry / viewport",
    status: "Active",
  },
  "ASM-0031": {
    summary:
      "The root fillet is a circular arc, not the true trochoidal fillet a rack cutter would generate (SRC-0025 describes that construction; an attempt to implement it did not pass its own verification and was not shipped, see reference/sources/SOURCES.yml). Where the root circle sits inside the base circle (GEAR-103's undercut case, common among watch pinions), the arc bridges the whole gap, tangent to the root circle and to the involute flank's own base-circle tangent point — its radius is fixed by the two tangencies (half the gap between the root and base circles), not the cutter's own standard corner radius. Otherwise the involute flank already reaches the root circle on its own, so only the resulting sharp corner is rounded, by a small arc of the standard cutter corner radius (0.38m, SRC-0024 Fig. 1-1) tangent to the flank's own local direction there and to the straight line this approximates the root land as, toward the neighbouring tooth's matching root point (REF-ENG §6)",
    scope: "Geometry / viewport",
    status: "Active",
  },
  "ASM-0032": {
    summary:
      "WATCH_SPECIFIC_PROFILE tooth geometry uses the cycloidal \"clock toothing\" convention (SRC-0026, corroborated by SRC-0027): the dedendum's generating (rolling) circle diameter is fixed to half of the gear's OWN pitch diameter, which makes the dedendum flank a straight radial line. True BS 978 Pt 2 conjugate action would size that generating circle from the specific gear this one meshes with instead (its diameter equal to the meshing pinion's own pitch radius) — using the gear's own tooth count is a self-contained simplification, not a mesh-pair-aware construction; no assembly/mesh lookup is performed",
    scope: "Geometry / viewport",
    status: "Active",
  },
  "ASM-0033": {
    summary:
      "WATCH_SPECIFIC_PROFILE draws the addendum as the standard's own circular-arc tip approximation (SRC-0026), not the literal epicycloid: a circle of the tabulated radius factor, through the tip apex and the point where the dedendum meets the pitch circle, selected by profile style (round/medium/high ogival) and leaf-count bracket (6-10 / 11+), with the standard's 5% practical clearance reduction applied. SRC-0026's own addendum-height equation (its eq. 17) is itself a function of the gear ratio (both leaf counts in the mesh, since \"the tooth profiles depend on the pinion counts\"); this is honoured by `effectiveLeafCount`, which keys the table lookup off the smaller of the gear's own tooth count and its actual WATCH_SPECIFIC_PROFILE meshing partner's (both gears of a mesh share one standardized cutter selection, keyed by the pinion side) — falling back to the gear's own tooth count only when it has no such mesh. The narrowed pinion tooth-width convention (1.05m / 1.25m by the same leaf-count bracket) and the dedendum-depth formula (the same effective leaf count's addendum factor + 0.4 modules clearance) are likewise mesh-aware. The dedendum's SHAPE (not just its depth) is not mesh-aware (see ASM-0032): a true conjugate dedendum hypocycloid, generated by the meshing pinion's own generating circle, would need real curve tracing, deliberately not attempted (same call made for the involute trochoidal fillet, SRC-0025). Gears with an effective leaf count below 6 are outside SRC-0026's tabulated range and are rejected (GEAR-104) rather than extrapolated",
    scope: "Geometry / viewport",
    status: "Active",
  },
} as const satisfies Record<string, Omit<Assumption, "id">>;

export type AssumptionId = keyof typeof ASSUMPTIONS;

export function listAssumptions(): Assumption[] {
  return (Object.keys(ASSUMPTIONS) as AssumptionId[]).map((id) => ({ id, ...ASSUMPTIONS[id] }));
}
