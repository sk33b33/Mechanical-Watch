# Assumption Register

Every approximation used by the application should be recorded here or generated into a machine-readable equivalent.

Machine-readable equivalent: `src/reference/assumptions.ts`. A test
(`src/reference/registers.test.ts`) fails if the two drift apart.

| ID | Assumption | Scope | Status |
|---|---|---|---|
| ASM-0001 | Ideal rigid gears for initial kinematics | Gear sandbox | Active |
| ASM-0002 | Constant efficiency may be used only when explicitly configured | Torque model | Pending |
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

Rules:
1. Never hide an assumption.
2. Never turn an assumption into a constant without provenance.
3. Tests should identify assumptions where they affect expected values.
