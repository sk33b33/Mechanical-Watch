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

## Rules implemented

| Rule | Severity | Level | Where |
|---|---|---|---|
| GEAR-001 | error | L1 | `validateMovement` |
| GEAR-002 | error | L1 | `validateMovement` |
| GEAR-003 | error | L1 | module, profile model and pressure-angle compatibility |
| GEAR-004 | error | L1 | placed vs ideal centre distance |
| GEAR-005 | none | none | Guaranteed by GEAR-001 + GEAR-002 (positive integer z gives a finite ratio) |
| GEAR-006 | none | none | Encoded in the sign of `meshSpeedRatio`; tested |
| SHAFT-001 | error | L1 | finite axis position |
| SHAFT-002 | none | none | Structural: a gear references exactly one `shaftId` |
| ASSY-001 | error | L1/L2 | dangling references; over-constrained train |
| ASSY-002 | error (pitch overlap) / warning (visual tip overlap only) | L1 / L0 | unmeshed gear pairs |
| SIM-001 | error / blocker | L2 | drive and integrated state |
| SIM-002 | none | none | Fixed-timestep integrator; tested for chunking independence |
| SIM-003 | info | L2 | always states the drive is prescribed |
| KIN-001 | warning | L2 | unpowered shafts (project addition) |
| VAL-001 | blocker | L1 | validation engine failure (project addition) |

Not yet applicable: UNIT-001/002 (enforced by branded unit types, not a
runtime rule), ESC-*, MFG-*.

## Validation levels

The code uses REF-ENG §15 (L0–L5). CLAUDE.md's four level names map as:
GEOMETRIC → L1, KINEMATIC → L2, DYNAMIC_SIMPLIFIED → L3,
PHYSICAL_VALIDATION_PENDING → any level below L5. A movement *declares*
its target level (`Movement.declaredValidationLevel`). Validation only
reports whether that level is satisfied; it never raises it.
