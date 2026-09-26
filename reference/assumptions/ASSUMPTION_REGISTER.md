# Assumption Register

Every approximation used by the application should be recorded here or generated into a machine-readable equivalent.

Machine-readable equivalent: `src/reference/assumptions.ts`. A test
(`src/reference/registers.test.ts`) fails if the two drift apart.

| ID | Assumption | Scope | Status |
|---|---|---|---|
| ASM-0001 | Ideal rigid gears for initial kinematics | Gear sandbox | Active |
| ASM-0002 | Constant efficiency may be used only when explicitly configured | Torque model | Active |
| ASM-0003 | Escapement begins as a simplified kinematic model | Escapement | Planned |
| ASM-0004 | Visual mesh does not establish manufacturing validity | Entire app | Permanent |
| ASM-0005 | Tooth visualization uses generic basic-rack proportions (addendum 1.0 × module, dedendum 1.25 × module, trapezoidal flanks); visual (L0) only, not an involute or horological profile | Geometry / viewport | Active |
| ASM-0006 | All shaft axes are parallel and perpendicular to the mainplate plane | Shafts / kinematics | Active |
| ASM-0007 | The drive is a prescribed angular velocity (kinematic input); no energy source, torque or mainspring is modeled | Gear sandbox | Active |
| ASM-0008 | Numerical parameters (comparison tolerances, fixed simulation timestep) are numerical-method choices, not physical or manufacturing values | Math / simulation | Active |
| ASM-0009 | Demo movement dimensions are illustrative design inputs, not sourced watch specifications | Demo movement | Active |
| ASM-0010 | Frames (mainplate, bridges) are flat slabs of uniform thickness; pillars, screws, recesses and sinks are not modeled | Frames / interference | Active |
| ASM-0011 | Bearing faces are flush with the frames' inner faces; cap jewels, chatons and oil sinks are not modeled | Bearings / endshake | Active |
| ASM-0012 | Arbors and jewels are drawn at placeholder sizes when their dimensions are unknown; visual (L0) only | Viewport | Active |
| ASM-0013 | Side shake is reported as diametral clearance (bore − pivot diameter); the horological convention is still to be confirmed against a source | Bearings / side shake | Active |
| ASM-0014 | Time display uses a 12-hour dial on the −Z side of the mainplate; hands turn clockwise seen from the dial (hours 1 rev/12 h, minutes 1 rev/h, seconds 1 rev/min, by definition) | Time display | Active |
| ASM-0015 | A friction clutch is kinematic only: fully engaged while running, freely slipping while setting the hands; slip torque is not modeled, and the going train keeps running during setting (no stop-seconds) | Motion works / hand setting | Active |
| ASM-0016 | Hands are not modeled; they are drawn only as indicators of their arbor's simulated angle (length, shape and stacking are visual) | Viewport | Active |
| ASM-0017 | Tolerance analysis is a worst-case (arithmetic) stack of declared limits; distributions are recorded but not used, and untoleranced inputs are taken at nominal and reported as such | Tolerances | Active |
| ASM-0018 | A mainspring's inner end is on the barrel arbor and its outer end on the drum, so the arbor is wound in the direction the drum turns when running; spring torque and energy are not modeled | Barrel / winding | Active |
| ASM-0019 | Keyless works: the stem lies in a plane parallel to the mainplate; each stem pinion engages its wheel at a right angle as rolling pitch circles (|ω1 z1| = |ω2 z2|), on the crown side of the wheel's axis; the setting lever, yoke, springs and ratchet (Breguet) teeth are represented only by two stem positions and a one-way coupling | Keyless works | Active |
| ASM-0020 | The dial is a flat disc of uniform thickness; feet, holes and printing are not modeled, and the hour markers drawn on it are visual | Dial | Active |
| ASM-0021 | A Swiss lever escape wheel gives two beats per tooth (one at each pallet), and a beat is one swing of the balance (half its period); source pending, accepted for the simplified model | Escapement | Active |
| ASM-0022 | The balance is a sinusoidal kinematic approximation at a declared amplitude, at the frequency the train's speed requires; no inertia, hairspring torque, damping or amplitude dependence is modeled, so it does not govern the rate | Balance | Active |
| ASM-0023 | The train is locked between beats and advances only in an impulse window, while the balance is within half the lift angle of its dead point; the pallet fork crosses between bankings in that window; locking, draw, drop, impact, sliding and banking geometry are not modeled | Escapement | Active |
| ASM-0024 | The balance and hairspring are a linear, undamped torsional oscillator (I θ'' = −k θ, f = √(k/I)/2π) with inertia and stiffness entered directly; it is isochronous by construction, and escapement disturbance, amplitude, damping, position, temperature and hairspring geometry/material are not modeled | Balance (simplified dynamic, L3) | Active |
| ASM-0025 | Pallet geometry is simplified: the pallets lock on the escape wheel's tip circle at two points a whole number of pitches plus a half apart, placed for tangential locking (pallet arbor where the tangents meet); total lever swing = lock + impulse + run; draw is an input whose adequacy against friction is not checked; tooth and pallet faces, drop and recoil are not modeled | Escapement geometry | Active |
| ASM-0026 | Simplified energy model: mainspring torque varies linearly with wind between entered end values; torque reaches the escape wheel by power balance with an optional overall train efficiency (lossless upper bound otherwise); each beat delivers torque × half a pitch × escapement efficiency; the balance loses 2πE/Q per period; steady state only, and amplitude does not affect rate (ASM-0024) | Energy / amplitude (L3) | Active |
| ASM-0027 | A gear mesh's worst-case centre distance over declared tolerances (module, and a FIXED shaft's own X/Y position) is a first-order (Taylor) expansion around the placement solver's own distance, not an exact 2D optimization; it is exact for the module term (distance scales linearly with it) and a linear approximation for a position term, matching the linear worst-case approach already used for side shake and endshake; a shaft whose placement is solved (MESH_POLAR, COAXIAL) contributes nothing here, since this does not chain into whatever it is placed from | Tolerances / gear meshes | Active |
| ASM-0028 | Endshake advisory thresholds (~0.05 mm for escapement shafts — escape wheel, pallet arbor, balance staff; ~0.10 mm for other pivoted shafts) are informal figures from forum testimony (SRC-0011), not a published standard; used only as a BRG-006 informational advisory, never a pass/fail limit. Side shake still has no usable sourced range at all (ASM-0013) | Bearings / endshake advisory | Active |

Rules:
1. Never hide an assumption.
2. Never turn an assumption into a constant without provenance.
3. Tests should identify assumptions where they affect expected values.
