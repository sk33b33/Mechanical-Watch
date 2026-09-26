# Traceability

Maps every engineering relationship in the code to its basis, assumptions,
tests and validation rules. This answers the "Code review questions" in
`CLAUDE_REFERENCE_INSTRUCTIONS.md`. Update this file in the same commit
as any change to an equation, constant or rule.

`REF-ENG §x` means `reference/REFERENCE_ENGINEERING.md` section x. None of
these equations has an external primary citation recorded yet: the gear
relationships currently rest only on REF-ENG §5. Adding one (e.g. a gear
geometry standard) is open work.

## Equations

| Quantity (SI unit) | Equation | Code | Basis | Assumptions | Evidence state | Level | Tests |
|---|---|---|---|---|---|---|---|
| Pitch diameter (m) | d = m z | `pitchDiameter` in `src/math/gearMath.ts` | REF-ENG §5.1 | ASM-0001 | DERIVED (definition of module; external citation pending) | L1 | `gearMath.test.ts` › pitchDiameter |
| Centre distance (m) | a = (d1 + d2)/2 = m(z1 + z2)/2 | `idealCentreDistance`, `meshCentreDistance` | REF-ENG §5.2 | ASM-0001 | DERIVED | L1 | › centre distance |
| Centre-distance match (bool) | abs(a_placed − a_ideal) ≤ tol | `isCentreDistanceAchievable` | REF-ENG §5.2 | ASM-0008 (tolerance is numerical, not manufacturing) | DERIVED | L1 | › flags an impossible centre distance; `gearMeshGeometry.test.ts` |
| Speed ratio (1) | ω2/ω1 = −z1/z2 | `meshSpeedRatio`, `drivenAngularVelocity` | REF-ENG §5.3 | ASM-0001 | DERIVED | L2 | › meshSpeedRatio / direction reversal |
| Compound ratio (1) | product of stage ratios | `compoundSpeedRatio`, `solveGearTrain` | REF-ENG §5.3, §7 | ASM-0001, ASM-0006, ASM-0007 | DERIVED | L2 | › compoundSpeedRatio; `solveGearTrain.test.ts` |
| Torque (N·m) | T2 = η T1 (z2/z1), with η = 1 unless configured | `drivenTorque` | REF-ENG §5.4 | ASM-0001; η only via ASM-0002 or a SRC | DERIVED | L3 (not yet used by the solver or UI) | › drivenTorque |
| Pitch-line velocity (m/s) | v = ω r, r = d/2 | `pitchLineVelocity` | REF-ENG §5.5 | ASM-0001 | DERIVED | L2 | › pitchLineVelocity (incl. equal on both gears) |
| Shaft angle (rad) | θ(n+1) = θ(n) + ω Δt, with fixed Δt | `stepSimulation`, `advanceSimulation` | REF-ENG §15 (L2) | ASM-0007, ASM-0008 | DERIVED | L2 | `simulationState.test.ts` |
| Shaft axis position (m) | FIXED: given; MESH_POLAR: p = p_ref + a·(cos θ, sin θ), with a = m(z1 + z2)/2 | `solvePlacement` in `src/kinematics/solvePlacement.ts` | REF-ENG §5.2, §7 | ASM-0006 | DERIVED | L1 | `solvePlacement.test.ts` |
| Side shake (m) | bore Ø − pivot Ø (diametral) | `sideShake` in `src/assembly/assemblyGeometry.ts` | REF-ENG §12 | ASM-0013 (convention unconfirmed) | DERIVED from user inputs; acceptability UNKNOWN | L1 | `assemblyRules.test.ts` › bearing geometry |
| Space between bearings (m) | upper frame underside − lower frame top | `bearingInnerSpan` | REF-ENG §12 | ASM-0010, ASM-0011 | DERIVED | L1 | › computes endshake… |
| Endshake (m) | space between bearings − shoulder span | `endshake` | REF-ENG §12 | ASM-0011 | DERIVED from user inputs; acceptability UNKNOWN | L1 | › computes endshake… |
| Axial overlap (bool) | lo_a < hi_b and lo_b < hi_a (touching faces don't overlap) | `zOverlaps`, `gearZRange`, `frameZRange` | none; geometric definition | ASM-0010 | DERIVED | L1 | `assemblyRules.test.ts` › GEAR-101, ASSY-002 |
| Wheel/arbor crossing (bool) | axis distance < pitch radius, with axial overlap; arbor taken as its bare axis (lower bound) | `interferenceRules` | REF-ENG §5.6 | arbor diameter not modeled | DERIVED | L1 | › a wheel may not cross another shaft's arbor |
| Coaxial axis (m) | p = p_ref | `solvePlacement` (COAXIAL) | geometric definition | ASM-0006 | DERIVED | L1 | `movementKinematics.test.ts` › places the coaxial cannon pinion… |
| Clutch while running (1) | ω_a = ω_b (engaged friction clutch) | `solveGearTrain` (RUNNING) | REF-ENG §8 | ASM-0015 | APPROXIMATION (no slip torque) | L2 | › derives the rest of the going train… |
| Hand setting | clutches slip; hand side = gear-connected group of the minutes hand, driven by the setting input; other shafts keep their running speed | `solveGearTrain` (HAND_SETTING), `handSettingState` | REF-ENG §8 | ASM-0015 | APPROXIMATION | L2 | › hand setting through the friction clutch |
| Nominal hand rate (rad/s) | ω = 2π / T with T = 12 h, 1 h, 1 min; positive = clockwise from the dial | `nominalHandAngularVelocity` in `src/kinematics/timeDisplay.ts` | definition of a 12-hour dial | ASM-0014 | definition | L2 | › time display definitions |
| Hand ratio check (1) | ω_h/ω_ref = T_ref/T_h, same sign | `timeRules` (TIME-002) | definition + REF-ENG §5.3 | ASM-0014 | DERIVED | L2 | › TIME-002 … |
| Rotation period (s) | T = 2π / abs(ω) | `periodSeconds`, `formatPeriod` | definition | none | DERIVED | L2 | › reads hand angles… |
| Dial reading | hand angle / 2π × (12 or 60), each hand read on its own | `readHand` | definition | ASM-0014 | DERIVED | L2 | › reads hand angles… |
| Tooth outline (visual) | trapezoid with addendum 1.0 × module and dedendum 1.25 × module | `generateGearOutline` | none; visualization only | ASM-0005, ASM-0004 | APPROXIMATION | L0 | `gearOutline.test.ts` |

Units: SI internally (SRC-0001, SRC-0002 via REF-ENG §4). mm, degrees and
rev/min exist only at the UI boundary (`src/units/`).

## Invalid inputs

| Input | Behaviour |
|---|---|
| Tooth count not a positive integer (0, negative, 6.5, empty) | Math functions throw `InvalidGearParameterError`. In the app the value is kept as typed, the gear is not rendered, the solver treats its meshes as impassable, and GEAR-001 is reported. |
| Module ≤ 0 or empty | Same pattern, GEAR-002. |
| Efficiency outside (0, 1] | `drivenTorque` throws. |
| Non-finite shaft axis | SHAFT-001. |
| Non-finite drive | Not propagated by the solver; SIM-001. |
| Non-finite simulation angle | Simulation halts; SIM-001 blocker. |
| Validation engine exception | VAL-001 blocker; UI still updates. |
| Placement that can't resolve (cycle, dangling reference, mesh not between the shafts, invalid mesh) | Shaft is not placed or drawn; ASSY-001 names the reason. Shafts placed from it fail with REFERENCE_UNRESOLVED. |
| Unknown pivot diameter, bore or shoulder span (empty field) | Stored as null; clearance reported as unknown with the missing inputs named; counted in BRG-005. Never defaulted. |
| Pivot, bore or shoulder span ≤ 0 or non-numeric | BRG-003 / BRG-004 input error. |
| Frame thickness ≤ 0, degenerate outline | FRAME-001; frame not drawn. |
| Gear thickness ≤ 0, non-finite axial position | GEAR-102; gear excluded from axial checks. |
| Newly created part (every dimension empty) | Kept empty (NaN/null); each missing value is reported by its rule (GEAR-001/002/102, SHAFT-001, FRAME-001). Incomplete frames are not drawn and are skipped by the geometric checks that need them. |
| Drive with no speed | SIM-001 error; the solver propagates nothing. |
| No drive at all | KIN-001 info. |
| Saved file with invalid values | Loaded unchanged (NaN preserved) and reported by validation. |
| Schema-1 file | Migrated to schema 2 on open (drive union; shafts PIVOTED with no hand; no couplings). |
| Nominal-time drive without exactly one minutes hand | TIME-003 / TIME-001; nothing is driven. |
| Hand setting where no clutch isolates the hands | SET-001 warning; the setting mode reports it and the hands are not moved. |

## Rules implemented

| Rule | Severity | Level | Where |
|---|---|---|---|
| GEAR-001 | error | L1 | `validateMovement` |
| GEAR-002 | error | L1 | `validateMovement` |
| GEAR-003 | error | L1 | module, profile model and pressure-angle compatibility |
| GEAR-004 | error | L1 | placed vs ideal centre distance |
| GEAR-005 | none | none | Guaranteed by GEAR-001 + GEAR-002 (positive integer z gives a finite ratio) |
| GEAR-006 | none | none | Encoded in the sign of `meshSpeedRatio`; tested |
| GEAR-101 | error | L1 | meshed gears must overlap axially (project addition) |
| GEAR-102 | error | L1 | gear thickness / axial position (project addition) |
| SHAFT-001 | error | L1 | finite placement coordinates and angle |
| SHAFT-002 | none | none | Structural: a gear references exactly one `shaftId` |
| Shaft alignment | none | none | Structural: bearings have no position of their own and sit on their shaft's solved axis, so a shaft's two bearings are coaxial by construction (ASM-0006). Tested by BRG-002 following a moved shaft. |
| ASSY-001 | error | L1/L2 | dangling references; unresolved placement constraints; meshing gears on one shaft; over-constrained train |
| ASSY-002 | error (pitch overlap) / warning (visual tip overlap only) | L1 / L0 | unmeshed gears at the same height; two gears on one arbor at the same height; gear inside a frame slab; wheel crossing another arbor |
| FRAME-001 | error | L1 | frame thickness, height and outline (project addition) |
| BRG-001 | error | L1 | one lower and one upper bearing, in different frames, correctly ordered (project addition; only for pivoted shafts in movements with frames) |
| BRG-002 | error | L1 | bearing inside its frame outline (project addition) |
| BRG-003 | error | L1 | side shake must be positive when known; inputs must be positive (project addition) |
| BRG-004 | error | L1 | endshake must be positive when known; inputs must be positive (project addition) |
| BRG-005 | info | L1 | counts computed vs unknown clearances; states they are not judged (project addition) |
| SIM-001 | error / blocker | L2 | drive and integrated state |
| SIM-002 | none | none | Fixed-timestep integrator; tested for chunking independence |
| SIM-003 | info | L2 | always states the drive is prescribed |
| KIN-001 | warning / info | L2 | unpowered shafts (warning); no drive set (info) (project addition) |
| CPL-001 | error | L1 | a friction clutch joins two different coaxial shafts (project addition) |
| SUP-001 | error | L1 | a carried part is placed coaxially (project addition) |
| SUP-002 | error | L1 | a stud lies within its frame (project addition) |
| TIME-001 | error | L2 | one shaft per hand (project addition) |
| TIME-002 | error | L2 | 12-hour-dial hand ratios and direction (project addition) |
| TIME-003 | error | L2 | nominal time needs a minutes hand (project addition) |
| TIME-004 | info | L2 | hand rate relative to nominal under a prescribed drive (project addition) |
| SET-001 | warning | L2 | hands settable without turning the train (project addition) |
| VAL-001 | blocker | L1 | validation engine failure (project addition) |

Not yet applicable: UNIT-001/002 (enforced by branded unit types, not a
runtime rule), ESC-*, MFG-*.

## Validation levels

The code uses REF-ENG §15 (L0–L5). CLAUDE.md's four level names map as:
GEOMETRIC → L1, KINEMATIC → L2, DYNAMIC_SIMPLIFIED → L3,
PHYSICAL_VALIDATION_PENDING → any level below L5. A movement *declares*
its target level (`Movement.declaredValidationLevel`). Validation only
reports whether that level is satisfied; it never raises it.
