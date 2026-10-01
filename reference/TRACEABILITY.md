# Traceability

Maps every engineering relationship in the code to its basis, assumptions,
tests and validation rules. This answers the "Code review questions" in
`CLAUDE_REFERENCE_INSTRUCTIONS.md`. Update this file in the same commit
as any change to an equation, constant or rule.

`REF-ENG §x` means `reference/REFERENCE_ENGINEERING.md` section x. The
core REF-ENG §5 gear equations (pitch diameter, centre distance, speed
ratio with direction, compound ratio, the lossless torque case,
pitch-line velocity) and the balance oscillator formula now each have an
external citation (SRC-0009, SRC-0014, SRC-0015, SRC-0018 — all Tier:
encyclopedia). None of these is a primary standard (e.g. a gear-geometry
or horology standard), and none proves manufacturability (REF-ENG §5.2,
CLAUDE_REFERENCE_INSTRUCTIONS.md rule 10); finding one remains open work.

## Equations

| Quantity (SI unit) | Equation | Code | Basis | Assumptions | Evidence state | Level | Tests |
|---|---|---|---|---|---|---|---|
| Pitch diameter (m) | d = m z | `pitchDiameter` in `src/math/gearMath.ts` | REF-ENG §5.1 | ASM-0001 | DERIVED (definition of module); SRC-0014 (Wikipedia "Gear") states the general d = N mₙ / cos ψ form, of which this is the spur (ψ = 0) case | L1 | `gearMath.test.ts` › pitchDiameter |
| Centre distance (m) | a = (d1 + d2)/2 = m(z1 + z2)/2 | `idealCentreDistance`, `meshCentreDistance` | REF-ENG §5.2 | ASM-0001 | DERIVED; SRC-0014 (Wikipedia "Gear") states a = (m/2)(z1 + z2) directly | L1 | › centre distance |
| Centre-distance match (bool) | abs(a_placed − a_ideal) ≤ tol | `isCentreDistanceAchievable` | REF-ENG §5.2 | ASM-0008 (tolerance is numerical, not manufacturing) | DERIVED | L1 | › flags an impossible centre distance; `gearMeshGeometry.test.ts` |
| Speed ratio (1) | ω2/ω1 = −z1/z2 | `meshSpeedRatio`, `drivenAngularVelocity` | REF-ENG §5.3 | ASM-0001 | DERIVED; SRC-0014 states ω2/ω1 = N1/N2 (magnitude) and that two parallel-axis meshing gears turn in opposite senses (the sign); SRC-0009 states the same magnitude relation independently | L2 | › meshSpeedRatio / direction reversal |
| Compound ratio (1) | product of stage ratios | `compoundSpeedRatio`, `solveGearTrain` | REF-ENG §5.3, §7 | ASM-0001, ASM-0006, ASM-0007 | DERIVED; SRC-0009 (Wikipedia "Gear train", idler-gear formula section) derives R_final = R_AI · R_IB for a two-stage train, the same stage-product rule generalized here | L2 | › compoundSpeedRatio; `solveGearTrain.test.ts` |
| Torque (N·m) | T2 = η T1 (z2/z1), with η = 1 unless configured | `drivenTorque` | REF-ENG §5.4 | ASM-0001; η only via ASM-0002 or a SRC | DERIVED; SRC-0014 states T2/T1 = N2/N1 for the lossless (η = 1) case; the η < 1 real-mesh extension is not covered by this source and remains ASM-0002 | L3 (not yet used by the solver or UI) | › drivenTorque |
| Pitch-line velocity (m/s) | v = ω r, r = d/2 | `pitchLineVelocity` | REF-ENG §5.5 | ASM-0001 | DERIVED; SRC-0018 (Wikipedia "Tangential speed") states v = r ω directly (general circular-motion kinematics, applied here at the pitch radius) | L2 | › pitchLineVelocity (incl. equal on both gears) |
| Shaft angle (rad) | θ(n+1) = θ(n) + ω Δt, with fixed Δt | `stepSimulation`, `advanceSimulation` | REF-ENG §15 (L2) | ASM-0007, ASM-0008 | DERIVED | L2 | `simulationState.test.ts` |
| Shaft axis position (m) | FIXED: given; MESH_POLAR: p = p_ref + a·(cos θ, sin θ), with a = m(z1 + z2)/2 | `solvePlacement` in `src/kinematics/solvePlacement.ts` | REF-ENG §5.2, §7 | ASM-0006 | DERIVED | L1 | `solvePlacement.test.ts` |
| Side shake (m) | bore Ø − pivot Ø (diametral) | `sideShake` in `src/assembly/assemblyGeometry.ts` | REF-ENG §12 | ASM-0013 (diametral convention; supported by SRC-0011's worked example, Tier 6), ASM-0029 | DERIVED from user inputs; compared only to an informal, unconfirmed reference figure (BRG-007, SRC-0012) — not a validated acceptable range | L1 | `assemblyRules.test.ts` › bearing geometry, BRG-007 |
| Space between bearings (m) | upper frame underside − lower frame top | `bearingInnerSpan` | REF-ENG §12 | ASM-0010, ASM-0011 | DERIVED | L1 | › computes endshake… |
| Endshake (m) | space between bearings − shoulder span | `endshake` | REF-ENG §12 | ASM-0011, ASM-0028 | DERIVED from user inputs; compared only to an informal, unconfirmed reference figure (BRG-006, SRC-0011) — not a validated acceptable range | L1 | › computes endshake…; `assemblyRules.test.ts` › BRG-006 |
| Axial overlap (bool) | lo_a < hi_b and lo_b < hi_a (touching faces don't overlap) | `zOverlaps`, `gearZRange`, `frameZRange` | none; geometric definition | ASM-0010 | DERIVED | L1 | `assemblyRules.test.ts` › GEAR-101, ASSY-002 |
| Wheel/arbor crossing (bool) | axis distance < pitch radius, with axial overlap; arbor taken as its bare axis (lower bound) | `interferenceRules` | REF-ENG §5.6 | arbor diameter not modeled | DERIVED | L1 | › a wheel may not cross another shaft's arbor |
| Coaxial axis (m) | p = p_ref | `solvePlacement` (COAXIAL) | geometric definition | ASM-0006 | DERIVED | L1 | `movementKinematics.test.ts` › places the coaxial cannon pinion… |
| Clutch while running (1) | ω_a = ω_b (engaged friction clutch) | `solveGearTrain` (RUNNING) | REF-ENG §8 | ASM-0015 | APPROXIMATION (no slip torque) | L2 | › derives the rest of the going train… |
| Hand setting | clutches slip; hand side = gear-connected group of the minutes hand, driven by the setting input; other shafts keep their running speed | `solveGearTrain` (HAND_SETTING), `handSettingState` | REF-ENG §8 | ASM-0015 | APPROXIMATION | L2 | › hand setting through the friction clutch |
| Nominal hand rate (rad/s) | ω = 2π / T with T = 12 h, 1 h, 1 min; positive = clockwise from the dial | `nominalHandAngularVelocity` in `src/kinematics/timeDisplay.ts` | definition of a 12-hour dial | ASM-0014 | definition | L2 | › time display definitions |
| Hand ratio check (1) | ω_h/ω_ref = T_ref/T_h, same sign | `timeRules` (TIME-002) | definition + REF-ENG §5.3 | ASM-0014 | DERIVED | L2 | › TIME-002 … |
| Rotation period (s) | T = 2π / abs(ω) | `periodSeconds`, `formatPeriod` | definition | none | DERIVED | L2 | › reads hand angles… |
| Dial reading | hand angle / 2π × (12 or 60), each hand read on its own | `readHand` | definition | ASM-0014 | DERIVED | L2 | › reads hand angles… |
| Measured axis distance (m) | abs(p_a − p_b) between solved axes | `measureBetween` in `src/assembly/measure.ts` | geometric definition | ASM-0006 | DERIVED | L1 | `measure.test.ts` |
| Measured axial gap / overlap (m) | overlap = min(hi) − max(lo); gap if negative | `measureBetween` | geometric definition | ASM-0010 (frames) | DERIVED | L1 | `measure.test.ts` › meshed gears, frames |
| Measured pitch-circle clearance (m) | d − (d1 + d2)/2 | `measureBetween` | REF-ENG §5.2, §6 | pitch model only | DERIVED | L1 | `measure.test.ts` |
| Measured drawn-tip clearance (m) | d − tip1 − tip2, unmeshed pairs only | `measureBetween` | none (visual) | ASM-0005 | APPROXIMATION | L0 | `measure.test.ts` › drawn tips… |
| Measured centre-distance deviation (m) | abs(d − m(z1 + z2)/2) for a meshed pair | `measureBetween` | REF-ENG §5.2 | ASM-0008 | DERIVED | L1 | `measure.test.ts` › meshed gears |
| Right-angle stem mesh (1) | ω_wheel = s (z_pinion / z_wheel) ω_pinion, s = +1 if the stem axis is above the wheel's mid-plane, −1 if below; pinion ω about the stem direction (toward the crown), wheel ω about +Z | `crossedMeshSpeedRatio` in `src/math/gearMath.ts`, `verticalSide`, `stemEngagement` in `src/kinematics/keylessGeometry.ts` | derived here from rolling pitch circles at the contact (teeth pass at the same rate; surface velocities equal); REF-ENG §5.3 only covers parallel meshes | ASM-0019, ASM-0001 | DERIVED; cited. SRC-0010 (Nie et al. 2026, JSME, peer-reviewed, read) states the same relation for a bevel gear pair (i₁₂ = ψ2/ψ1 = z1/z2), closing the crossed-axis citation; SRC-0009 (Wikipedia, read) supports the general spur-gear principle. SRC-0007, SRC-0008 remain unread and are no longer needed. Still a generic-machine-gear source, not horological (CLAUDE_REFERENCE_INSTRUCTIONS.md rule 10) | L2 | `keyless.test.ts` › property: surface velocities agree… (independent 3D check) |
| Stem engagement geometry (m) | contact at C + R u (crown side); requires plan offset of the wheel axis from the stem line = 0 and abs(stem height − wheel mid-plane) = pinion pitch radius | `stemEngagement`, `keylessRules` (KEY-002) | geometric definition of intersecting-axis pitch circles | ASM-0019, ASM-0008 (tolerance) | DERIVED | L1 | `keyless.test.ts`, `keylessRules.test.ts` |
| Winding direction | the crown winds when the ratchet (barrel arbor) then turns the way the drum runs; the other way the ratchet teeth slip | `windingResponse`, `windingCrownSense` in `solveGearTrain.ts` | REF-ENG §11 (winding state as data) | ASM-0018, ASM-0019 | APPROXIMATION (spring not modeled) | L2 | › winds in the derived direction…; › turned the other way… |
| Click | ratchet ω = 0 unless being wound; a running train that turns it is a conflict | `holdRatchets` | REF-ENG §11 | ASM-0019 | APPROXIMATION (one-way hold, no geometry) | L2 | › a ratchet turned by the running train conflicts with the click |
| Crown setting | stem out: sliding pinion ↔ setting wheel engaged, friction clutches slip, hand side re-driven from the crown; going train keeps running | `solveGearTrain` (CROWN_SETTING), `crownSettingState` | REF-ENG §8 | ASM-0015, ASM-0019 | APPROXIMATION | L2 | › pulled out, the crown sets the hands… |
| Crown clock position (h) | atan2(−cos θ, sin θ) × 12 / 2π, mod 12 (dial side mirrors x; 12 o'clock is +Y) | `clockPositionFromDial` | definition | ASM-0014 | definition | L1 | › maps plan directions to the dial's clock |
| Dial clearance | every gear or frame overlapping the dial in plan must be entirely above its back | `dialRules` (DIAL-002) | geometric definition | ASM-0010, ASM-0020 | DERIVED | L1 | `keylessRules.test.ts` › DIAL-002 |
| Beats per escape revolution (1) | 2 z_escape | `beatsPerEscapeRevolution` in `src/kinematics/escapement.ts` | REF-ENG §9 (mechanism structure) | ASM-0021 (two beats per tooth; SRC-0016, corroborated by SRC-0017, both Tier 6/7 — see SRC-0017's notes for a conflicting Wikipedia sentence and why it doesn't override) | ASSUMPTION | L2 | `escapement.test.ts` › two beats per escape tooth |
| Beat rate (Hz) | f_beat = abs(ω_escape) / 2π × 2 z; shown in beats/h = 3600 f_beat | `beatFrequency` | REF-ENG §4 (beats per hour as a display unit) | ASM-0021 | DERIVED from ASM-0021 | L2 | › 18 000 beats an hour… |
| Required balance frequency (Hz) | f_balance = f_beat / 2 | `balanceFrequency` | definition of a beat as half a balance period | ASM-0021, ASM-0022 | DERIVED; the balance's own frequency is not modeled | L2 | › …the balance runs at 2.5 Hz |
| Balance angle (rad) | θ_b = A sin(2π f_balance t), A declared | `escapementMotion` | REF-ENG §10 (kinematic model: angle and frequency) | ASM-0022 | APPROXIMATION (sinusoid; no dynamics) | L2 | › the fork rests on alternate bankings… |
| Impulse window (1) | (2/π) asin(λ / 2A) of each beat, needs A > λ/2 | `impulseFraction` | derived from the sinusoid | ASM-0022, ASM-0023 | DERIVED | L2 | › is the share of each swing… |
| Ticking train (s) | shown at t_eff = T (k − ½ + s), s = window progress; locked between windows, within T/2 of t | `escapementMotion`, `escapementDisplay` | REF-ENG §9 (release, impulse phases) | ASM-0023 | APPROXIMATION (no locking, draw, drop or impact) | L2 | › keeps real time on average…; › never runs backward… |
| Balance free frequency (Hz) | f = √(k / I) / 2π | `naturalFrequency` in `src/kinematics/balance.ts` | REF-ENG §10 (simplified dynamic model: inertia, restoring torque); linear undamped oscillator (I θ'' = −k θ) | ASM-0024 | DERIVED from the oscillator equation; SRC-0015 (Wikipedia "Torsion spring") states the same f = √(κ/I)/2π formula for a torsional harmonic oscillator — the oscillator math only, not evidence that a real balance/hairspring behaves as one (that remains ASM-0024) | L3 | `balance.test.ts` › f = √(k/I) / 2π |
| Hairspring for a frequency (N·m/rad) | k = I (2π f)² | `stiffnessForFrequency` | inverse of the above | ASM-0024 | DERIVED | L3 | › property: the stiffness for a frequency gives that frequency back |
| Escape speed when the balance governs (rad/s) | abs(ω) = 2π f / z (one tooth per balance period); sign from the train so the hands run forward | `escapeSpeedFromBalance`, `driveSeed` (BALANCE) | REF-ENG §9, §10 | ASM-0021, ASM-0024 | DERIVED | L3 | › the escape wheel advances one tooth per balance period; › runs the hands clockwise… |
| Daily rate (s/day) | (f / f_nominal − 1) × 86 400; f_nominal from the escape arbor at nominal time | `dailyRateSeconds`, `summarizeBalance` | definition (train speed ∝ balance frequency) | ASM-0024 | DERIVED; not a rate-accuracy claim | L3 | › predicts about 7 s a day slow… |
| Pallet span angle (rad) | φ = span × 2π / z | `spanAngle` in `src/kinematics/palletGeometry.ts` | REF-ENG §9 | ASM-0021, ASM-0025 | DERIVED | L1 | `palletGeometry.test.ts` |
| Tangential locking distance (m) | escape-to-pallet axis = R_tip / cos(φ/2), for 0 < φ < π | `tangentialCentreDistance` | geometry of two tangents to a circle | ASM-0025 | DERIVED | L1 | `palletGeometry.test.ts` › property: tangents at the locking points meet at the pallet axis |
| Lever impulse angle (rad) | lever − lock − run | `impulseAngle` | definition | ASM-0025 | DERIVED | L1 | `mainspringEnergy.test.ts` › pallet rules |
| Fork ratio | lift angle / lever angle | `forkRatio` | definition | ASM-0025 | DERIVED | L1 | `palletGeometry.test.ts` |
| Spring torque at a wind (N·m) | T_letdown + (T_full − T_letdown) × w / turns, w clamped to [0, turns] | `springTorque` in `src/kinematics/mainspringEnergy.ts` | REF-ENG §11 | ASM-0026 | DERIVED from entered values | L3 | `mainspringEnergy.test.ts` › linear in wind |
| Power reserve (s) | turns / (abs(ω_drum) / 2π) | `powerReserveSeconds` | definition | ASM-0026 | DERIVED | L2 | › 6.5 turns at one drum turn per 6 h is 39 h |
| Escape wheel torque (N·m) | T_drum × abs(ω_drum / ω_escape) × η_train (η = 1, the lossless bound, when not configured) | `escapeTorque` | conservation of power | ASM-0002, ASM-0026 | DERIVED; upper bound without η | L3 | › escape torque conserves power |
| Energy per beat to the balance (J) | T_escape × π / z × η_escapement | `energyPerBeat`, `escapeRotationPerBeat` | work = torque × angle | ASM-0021, ASM-0026 | DERIVED | L3 | › energy per beat |
| Steady amplitude (rad) | A = √(2 Q E_beat / (π k)), from 2 E_beat = 2π (½ k A²) / Q | `steadyAmplitude` | definition of Q; ½ k A² | ASM-0024, ASM-0026 | DERIVED; requires physical validation | L3 | › property: energy in per period equals the loss |
| Stop wind (turns) | where A(w) = lift / 2, with A ∝ √T(w) | `summarizeEnergy` in `src/kinematics/energySummary.ts` | follows from the two above | ASM-0023, ASM-0026 | DERIVED | L3 | › finds where the balance stops unlocking |
| Mainspring state of wind (turns) | dw/dt = (ω_arbor − ω_drum) × sign(ω_drum running) / 2π, clamped to [0, turns] | `stepSimulation`, `windTracks` in `src/simulation/simulationState.ts` | kinematics of the barrel | ASM-0018, ASM-0026 | DERIVED; simulation state | L2 | `simulationState.test.ts` › mainspring wind; `store.test.ts` › run-down |
| Toleranced limits (m) | lower = nominal + lower deviation; upper = nominal + upper deviation | `Tolerance` in `src/domain/tolerance.ts` | REF-ENG §14 | none (declared intent) | user input; not validated | L1 | `toleranceAnalysis.test.ts` |
| Worst-case stack (m) | R = Σ sᵢ xᵢ; R_min = Σ (sᵢ > 0 ? lowerᵢ : −upperᵢ); R_max likewise; untoleranced inputs at nominal | `evaluateStack` in `src/assembly/toleranceAnalysis.ts` | REF-ENG §14 | ASM-0017 | DERIVED | L1 | › property: min ≤ nominal ≤ max… |
| Side shake over tolerances (m) | bore − pivot, worst case | `sideShakeStack` | REF-ENG §12, §14 | ASM-0013, ASM-0017 | DERIVED; acceptability UNKNOWN | L1 | › side shake: min takes… |
| Endshake over tolerances (m) | upper underside − lower underside − lower thickness − shoulder span, worst case | `endshakeStack` | REF-ENG §12, §14 | ASM-0010, ASM-0011, ASM-0017 | DERIVED; acceptability UNKNOWN | L1 | › endshake stacks… |
| Mesh centre distance over tolerances (m) | first-order (Taylor) expansion anchored at the placed distance d: min/max = d + Σ coefficientᵢ × worst-case(limitᵢ − nominalᵢ); module coefficient = (z1+z2)/2 (exact); a FIXED shaft's position coefficient = ± the mesh's direction cosine (linear approximation) | `meshCentreDistanceStack` in `src/assembly/toleranceAnalysis.ts` | REF-ENG §14 | ASM-0017, ASM-0027 | DERIVED; nominal always equals the placed distance | L1 | `toleranceAnalysis.test.ts` › gear mesh centre-distance stack, incl. a property test |
| Plan drawing (mm) | frame outlines, solved axes, pitch circles (d = m z), placed centre distances; ideal added when they differ by more than the ASM-0008 tolerance; a mesh's worst-case centre distance added ("· tol min…max") only where toleranced | `buildPlanDrawing` in `src/outputs/drawing/planDrawing.ts` | REF-ENG §5.1, §5.2, §6, §14 | ASM-0006, ASM-0008, ASM-0027 | DERIVED; nominal only except that annotation (MFG-001) | L1 | `outputs.test.ts` › plan drawing |
| Elevation drawing (mm) | orthographic X-Z projection along Y: frame bodies over their outline's X-extent, arbor centrelines over their occupied Z-span, gear/escapement bodies at pitch/tip diameter and thickness, bearing markers flush with the frame's inner face, overall height, and a toleranced arbor's endshake dimension | `buildElevationDrawing` in `src/outputs/drawing/elevationDrawing.ts` | REF-ENG §5.1, §6, §11, §14 | ASM-0006, ASM-0011, ASM-0017 | DERIVED; nominal only except the endshake annotation (MFG-001) | L1 | `outputs.test.ts` › elevation drawing |
| Visual mesh export (mm) | viewport frame slabs and visual tooth outlines at assembled positions | `buildStl` in `src/outputs/stl.ts` | none; visualization only | ASM-0004, ASM-0005, ASM-0010 | APPROXIMATION | L0 | `outputs.test.ts` › STL |
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
| Schema-2 file | Migrated to schema 3 on open (no tolerances). |
| Schema-3 file | Migrated to schema 4 on open (no keyless works, no dial). |
| Schema-4 file | Migrated to schema 5 on open (no escapement). |
| Schema-5 file | Migrated to schema 6 on open (balance inertia and stiffness unknown). |
| Schema-6 file | Migrated to schema 7 on open (no pallet geometry; escapement efficiency, Q and mainspring data unknown). |
| New pallet geometry (all empty) | Kept NaN; ESC-104 span error and ESC-105 errors until entered. No default angles. |
| Pallet span not k + ½ teeth, or ≥ 180° | ESC-104 error; locking distance not derived; symbolic fork arms shown. |
| Lock + run ≥ lever angle; lock ≤ 0; run < 0 | ESC-105 error. |
| Draw ≤ 0 | ESC-105 warning (nothing pulls the lever onto its banking). |
| Mainspring data empty, turns ≤ 0, torques ≤ 0, let-down > fully wound, efficiency outside (0, 1] | SPR-001 error; no energy chain; the wind is not tracked. |
| Q or escapement efficiency unknown | Amplitude not predicted; SPR-002 names what is missing; the declared amplitude is shown. |
| Q ≤ 0 or efficiency outside (0, 1] | SPR-001 error. |
| Predicted amplitude below half the lift angle before let-down | SPR-003 warning with the stop wind and running reserve; error if even fully wound. The simulation stops a balance-governed train there. |
| Balance inertia or stiffness empty | Stored as null (unknown); the model stays kinematic; a balance-governed drive reports BAL-001 and drives nothing. |
| Balance inertia or stiffness ≤ 0 | BAL-001 error; no free frequency. |
| New escapement (all empty, no arbors chosen) | Kept empty; ESC-101 lists what is missing; nothing ticks or swings. |
| Amplitude not above half the lift angle | ESC-101 error; no impulse window, so the display shows nothing ticking. |
| Pallet arbor or balance staff gear-driven | ESC-102 error. |
| Escape arbor not driven | ESC-001 says no beat rate is derived; the balance rests. |
| New keyless works or dial (all empty, no wheels or arbor chosen) | Kept empty; KEY-001 / DIAL-001 list what is missing. Nothing is drawn until defined. |
| Stem level with a wheel's mid-plane | The right-angle mesh is impassable; KEY-002 level error. |
| No mainspring on the ratchet's arbor | Winding direction unknown; crown turning while "winding" leaves the ratchet held; KEY-003 warning. |
| Ratchet driven by the running train | Solver conflict via the click; KEY-003 error. |
| Crown setting train not reaching the minutes hand | Setting unavailable; KEY-004 error. |
| New tolerance (limits empty) | Kept as NaN; TOL-001 error until both limits are entered. No default band is assumed. |
| Tolerance with lower > upper, or a size whose lower limit is ≤ 0 | TOL-001 error; stacks that use it report invalid input. |
| Tolerance on an unknown dimension | TOL-001 warning (no effect); the dimension stays unknown. |
| A module or FIXED position tolerance on a shaft whose placement is later changed to MESH_POLAR/COAXIAL | TOL-001 target error: that shaft no longer has the dimension (`tolerancedDimensionsOf` excludes it). |
| Both gears' shafts in a mesh coincide (same solved position) | `meshCentreDistanceStack` returns INVALID_INPUT rather than a division by zero. |
| Two tolerances on one dimension | TOL-001 error (`setTolerance` replaces, so this arises only from files). |
| Export of a design with errors | Produced anyway; the report states the declared level is not met. STL and drawings skip parts they can't place or size and the STL lists them. |

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
| BRG-005 | info | L1 | counts computed vs unknown clearances; states side shake and endshake are each only advised against an informal figure (project addition) |
| BRG-006 | info | L1 | endshake looser than an informal, unconfirmed forum-sourced figure — escapement (~0.05mm) vs train (~0.10mm) shafts (project addition, ASM-0028, SRC-0011) |
| BRG-007 | info | L1 | side shake looser than an informal, unconfirmed forum-sourced figure credited to Hans Jendritzki — pivot up to 0.30mm (~0.01mm) vs larger (~0.02mm) (project addition, ASM-0029, SRC-0012) |
| SIM-001 | error / blocker | L2 | drive and integrated state |
| SIM-002 | none | none | Fixed-timestep integrator; tested for chunking independence |
| SIM-003 | info | L2 | always states the drive is prescribed |
| KIN-001 | warning / info | L2 | unpowered shafts (warning); no drive set (info) (project addition) |
| CPL-001 | error | L1 | a friction clutch or mainspring joins two different coaxial shafts (project addition) |
| SUP-001 | error | L1 | a carried part is placed coaxially (project addition) |
| SUP-002 | error | L1 | a stud lies within its frame (project addition) |
| TIME-001 | error | L2 | one shaft per hand (project addition) |
| TIME-002 | error | L2 | 12-hour-dial hand ratios and direction (project addition) |
| TIME-003 | error | L2 | nominal time needs a minutes hand (project addition) |
| TIME-004 | info | L2 | hand rate relative to nominal under a prescribed drive (project addition) |
| SET-001 | warning | L2 | hands settable without turning the train (project addition) |
| VAL-001 | blocker | L1 | validation engine failure (project addition) |
| KEY-001 | error | L1 | keyless works references, one per movement, valid stem pinions and stem (project addition) |
| KEY-002 | error | L1 | right-angle engagement: modules match, wheel axis on the stem line, stem one pitch radius from the wheel, not level (project addition) |
| KEY-003 | error / warning | L2 | winding derivable (mainspring, drum running, ratchet reached); the running train must not turn the ratchet (project addition) |
| KEY-004 | error | L2 | crown setting reaches the minutes hand (project addition) |
| DIAL-001 | error | L1 | one dial, positive diameter and thickness, finite face, existing centre arbor (project addition) |
| DIAL-002 | error | L1 | the dial is below everything it covers (project addition) |
| DIAL-003 | error | L1 | every hand arbor is over the dial (project addition) |
| ESC-001 | info | L2 | declares the SIMPLIFIED ESCAPEMENT MODEL and the derived beat rate |
| ESC-002 | info | L2 | states what the simplified model does not claim (contact, drop, faces, rate accuracy) and which parts are simplified models |
| ESC-104 | error | L1 | pallet span is k + ½ teeth and under 180°; pallet arbor at the tangential locking distance (project addition, ASM-0025) |
| ESC-105 | error / warning | L1 | lock positive, run not negative, lock + run leave impulse; draw positive (warning) (project addition, ASM-0025) |
| ESC-101 | error | L1 / L2 | one escapement, three distinct existing arbors, valid inputs, amplitude above half the lift angle (project addition) |
| ESC-102 | error | L2 | pallet arbor and balance staff are not gear-driven (project addition) |
| ESC-103 | error | L1 | escape wheel clears the pallet arbor, the balance and other gears at its height; the balance clears the pallet arbor (project addition) |
| BAL-001 | error | L2 / L3 | entered inertia and stiffness positive; a balance-governed drive needs an escapement, escape wheel and both inputs (project addition) |
| BAL-002 | info | L3 | free frequency, frequency needed for nominal time, stiffness for nominal, predicted daily rate, with limits (project addition) |
| SPR-001 | error | L3 | mainspring data, Q and escapement efficiency within their valid ranges (project addition, ASM-0026) |
| SPR-002 | info | L3 | reserve, escape torque (lossless bound when so), predicted amplitude or what it needs (project addition, ASM-0026) |
| SPR-003 | warning / error | L3 | the balance stops before let-down (warning) or cannot unlock even fully wound (error) (project addition, ASM-0026) |
| TOL-001 | error / warning | L1 | tolerance definition: target exists, one per dimension, finite limits, lower ≤ upper, positive size limit (project addition) |
| TOL-002 | warning | L1 | a nominally positive side shake, endshake or gear-mesh centre distance that can close within declared tolerances (project addition) |
| MFG-001 | info | L1 | summary whenever tolerances exist: declared intent, untoleranced dimensions are nominal. Also stated in every output. |
| MFG-002 | none | none | Stated in the report, drawings and outputs dialog: nothing is manufacturing-validated. No level above L2 can be declared. |

Not a runtime rule: UNIT-001/002 are enforced by branded unit types
(`Frequency` in Hz is separate from `AngularVelocity` in rad/s).

## Validation levels

The code uses REF-ENG §15 (L0–L5). CLAUDE.md's four level names map as:
GEOMETRIC → L1, KINEMATIC → L2, DYNAMIC_SIMPLIFIED → L3,
PHYSICAL_VALIDATION_PENDING → any level below L5. A movement *declares*
its target level (`Movement.declaredValidationLevel`). Validation only
reports whether that level is satisfied; it never raises it.
