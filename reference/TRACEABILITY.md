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
| Involute function (rad) | inv(α) = tan α − α | `involuteAngle` in `src/math/involute.ts` | REF-ENG §6 | — | VERIFIED_MANUFACTURER (SRC-0024, eq. 3-6) | L1 | `involute.test.ts` › involuteAngle |
| Base circle radius (m) | r_b = r_pitch cos α | `baseRadius` in `src/math/involute.ts` | REF-ENG §6 | — | VERIFIED_MANUFACTURER (SRC-0024, Table 4-1) | L1 | › baseRadius |
| Involute curve point | r = r_b / cos φ; x = r cos(inv φ), y = r sin(inv φ) | `involutePoint` in `src/math/involute.ts` | REF-ENG §6 | — | VERIFIED_MANUFACTURER (SRC-0024, eq. 3-7) | L1 | › involutePoint |
| Minimum tooth count before undercut | z_c = ⌈2 / sin²α⌉ | `minimumToothCountForNoUndercut` in `src/math/involute.ts` | REF-ENG §6 | — | VERIFIED_MANUFACTURER (SRC-0024, eq. 4-1); matches the source's own worked values (32 at 14.5°, 18 at 20°) | L1 | › minimumToothCountForNoUndercut |
| Involute gear outline (full tooth profile) | standard full-depth proportions (addendum m, dedendum 1.25m), flank sampled from base (or root) circle to tip, circular-arc fillet below the base circle, tooth centred so the pitch-circle tooth thickness is a half pitch (zero backlash) | `generateInvoluteGearOutline` in `src/geometry/involuteGearOutline.ts` | REF-ENG §6 | ASM-0030, ASM-0031 | DERIVED from the above, plus the standard (unshifted) zero-backlash tooth-thickness convention (SRC-0024, Table 4-1) | L1 | `involuteGearOutline.test.ts` |
| Circular root fillet (where root circle is inside base circle) | circle tangent to the root circle and to the involute flank's own base-circle tangent point (no kink); centre at radius (rootRadius+baseRadius)/2 along the flank's angle, radius = (baseRadius−rootRadius)/2 | `circularRootFillet` in `src/math/circularFillet.ts` | REF-ENG §6 | ASM-0031 | DERIVED (elementary tangent-circle construction; not from an external source) | L1 | `circularFillet.test.ts` |
| Corner fillet (where root circle is outside base circle, so the flank already reaches it) | classical fillet between two rays from a shared corner: tangentDistance = radius/tan(halfAngle), centreDistance = radius/sin(halfAngle) along the angle bisector, radius = 0.38m (SRC-0024 Fig. 1-1, the standard cutter corner radius) | `cornerFillet` in `src/math/circularFillet.ts`, applied in `generateInvoluteGearOutline` via `cornerFilletArcPoints` | REF-ENG §6 | ASM-0031 | DERIVED (elementary two-line tangent-circle construction; not from an external source). The flank's own local tangent direction is used (via finite difference against `involutePoint`), not the straight line `circularRootFillet` builds on — that line is tangent to the true involute curve only at the base circle, not at the root (caught by rendering the outline, see the module comment in `circularFillet.ts`) | L1 | `circularFillet.test.ts` › cornerFillet; `involuteGearOutline.test.ts` |
| Hypocycloid (point on a circle of radius r rolling inside a fixed circle of radius R) | x(θ)=(R−r)cos θ + r cos((R−r)/r·θ), y(θ)=(R−r)sin θ − r sin((R−r)/r·θ); degenerates to the straight line y=0, x=R cos θ when r=R/2 (the Tusi couple) | `hypocycloidPoint`, `hypocycloidThetaAtRadius` in `src/math/cycloidTooth.ts` | — (elementary roulette-curve geometry) | — | VERIFIED (SRC-0028, standard parametric-curve reference); the r=R/2 degenerate case independently re-derived algebraically and checked numerically before relying on it | L1 | `cycloidTooth.test.ts` › hypocycloidPoint, hypocycloidThetaAtRadius |
| Cycloidal dedendum ("clock toothing") | the hypocycloid (above) traced by a generating circle of radius `generatingCircleRadius(effectiveLeafCount, module)` rolling inside the gear's own pitch circle, sampled from the pitch circle to the root circle; degenerates to the exact straight radial line when the gear has no smaller WATCH_SPECIFIC_PROFILE mesh partner (SRC-0026, Tier 5, corroborated by SRC-0027, Tier 4) | `dedendumFlankPoints` in `src/geometry/watchSpecificGearOutline.ts` | REF-ENG §6 | ASM-0032 | DERIVED from SRC-0026's stated construction plus SRC-0028's hypocycloid formula; neither SRC-0026 nor SRC-0027 cites BS 978 Pt 2 / NIHS 26702 itself (both paywalled, not accessed — UNKNOWN primary source) | L1 | `watchSpecificGearOutline.test.ts` › mesh-aware dedendum, self-intersection scan |
| Cycloidal addendum (standardized circular-arc tip) | circle of the tabulated radius factor f_r, through the tip apex (pitch radius + practical addendum factor, on the tooth centreline) and the point where the dedendum meets the pitch circle; f_a, f_r selected by profile style (round/medium/high ogival, by leaf count) and leaf-count bracket (6-10 / 11+), keyed by `effectiveLeafCount` (the smaller of the gear's own tooth count and its actual WATCH_SPECIFIC_PROFILE mesh partner's), practical addendum = 0.95 × theoretical factor | `cycloidalToothFactors`, `practicalAddendumFactor`, `addendumArcThroughTwoPoints` in `src/math/cycloidTooth.ts`; `effectiveLeafCount` in `src/geometry/watchSpecificGearOutline.ts`, applied in `generateWatchSpecificGearOutline` | REF-ENG §6 | ASM-0033 | DERIVED from SRC-0026's own tabulated values (eq. 17, 21-22) and its stated pinion/ratio dependency, honoured via the mesh lookup; falls back to the gear's own tooth count when unmeshed (ASM-0033) | L1 | `cycloidTooth.test.ts`; `watchSpecificGearOutline.test.ts` › effectiveLeafCount, mesh-aware tooth proportions |
| Cycloidal tooth width and dedendum depth | tooth width at the pitch circle 1.05m (6-10 leaves) / 1.25m (11+), narrower than an equal half-pitch split; dedendum depth = (`effectiveLeafCount`'s practical addendum factor + 0.4) m | `toothWidthFactor`, `dedendumDepthFactor` in `src/math/cycloidTooth.ts`, both called with `effectiveLeafCount` | REF-ENG §6 | ASM-0033 | DERIVED from SRC-0026; dedendum depth is stated there as a function of the meshing partner's addendum factor — both gears of a mesh now share the same effective leaf count, so a wheel's dedendum is sized to clear its actual meshing pinion's addendum (ASM-0033) | L1 | `cycloidTooth.test.ts`; `watchSpecificGearOutline.test.ts` › mesh-consistent clearance |
| Centre-distance match (bool) | abs(a_placed − a_ideal) ≤ tol | `isCentreDistanceAchievable` | REF-ENG §5.2 | ASM-0008 (tolerance is numerical, not manufacturing) | DERIVED | L1 | › flags an impossible centre distance; `gearMeshGeometry.test.ts` |
| Speed ratio (1) | ω2/ω1 = −z1/z2 | `meshSpeedRatio`, `drivenAngularVelocity` | REF-ENG §5.3 | ASM-0001 | DERIVED; SRC-0014 states ω2/ω1 = N1/N2 (magnitude) and that two parallel-axis meshing gears turn in opposite senses (the sign); SRC-0009 states the same magnitude relation independently | L2 | › meshSpeedRatio / direction reversal |
| Compound ratio (1) | product of stage ratios | `compoundSpeedRatio`, `solveGearTrain` | REF-ENG §5.3, §7 | ASM-0001, ASM-0006, ASM-0007 | DERIVED; SRC-0009 (Wikipedia "Gear train", idler-gear formula section) derives R_final = R_AI · R_IB for a two-stage train, the same stage-product rule generalized here | L2 | › compoundSpeedRatio; `solveGearTrain.test.ts` |
| Torque (N·m) | T2 = η T1 (z2/z1), with η = 1 unless configured | `drivenTorque` | REF-ENG §5.4 | ASM-0001; η only via ASM-0002 or a SRC | DERIVED; SRC-0014 states T2/T1 = N2/N1 for the lossless (η = 1) case; the η < 1 real-mesh extension is not covered by this source and remains ASM-0002 | L3 (not yet used by the solver or UI) | › drivenTorque |
| Pitch-line velocity (m/s) | v = ω r, r = d/2 | `pitchLineVelocity` | REF-ENG §5.5 | ASM-0001 | DERIVED; SRC-0018 (Wikipedia "Tangential speed") states v = r ω directly (general circular-motion kinematics, applied here at the pitch radius) | L2 | › pitchLineVelocity (incl. equal on both gears) |
| Shaft angle (rad) | θ(n+1) = θ(n) + ω Δt, with fixed Δt | `stepSimulation`, `advanceSimulation` | REF-ENG §15 (L2) | ASM-0007, ASM-0008 | DERIVED | L2 | `simulationState.test.ts` |
| Shaft axis position (m) | FIXED: given; MESH_POLAR: p = p_ref + a·(cos θ, sin θ), with a = m(z1 + z2)/2 | `solvePlacement` in `src/kinematics/solvePlacement.ts` | REF-ENG §5.2, §7 | ASM-0006 | DERIVED | L1 | `solvePlacement.test.ts` |
| Side shake (m) | bore Ø − pivot Ø (diametral) | `sideShake` in `src/assembly/assemblyGeometry.ts` | REF-ENG §12 | ASM-0013 (diametral convention; supported by SRC-0011's worked example, Tier 6), ASM-0029 | DERIVED from user inputs; compared only to an informal, unconfirmed reference figure (BRG-007, SRC-0012) — not a validated acceptable range. The primary standard most likely to supply one is now named (NIHS 04-04/04-03, SRC-0030; NIHSG 41-11/NIHS 94-10, SRC-0031) but paywalled and unretrieved | L1 | `assemblyRules.test.ts` › bearing geometry, BRG-007 |
| Space between bearings (m) | upper frame underside − lower frame top | `bearingInnerSpan` | REF-ENG §12 | ASM-0010, ASM-0011 | DERIVED | L1 | › computes endshake… |
| Endshake (m) | space between bearings − shoulder span | `endshake` | REF-ENG §12 | ASM-0011, ASM-0028 | DERIVED from user inputs; compared only to an informal, unconfirmed reference figure (BRG-006, SRC-0011) — not a validated acceptable range. The primary standard most likely to supply one is now named (NIHS 04-04/04-03, SRC-0030) but paywalled and unretrieved | L1 | › computes endshake…; `assemblyRules.test.ts` › BRG-006 |
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
| Right-angle stem mesh (1) | ω_wheel = s (z_pinion / z_wheel) ω_pinion, s = +1 if the stem axis is above the wheel's mid-plane, −1 if below; pinion ω about the stem direction (toward the crown), wheel ω about +Z | `crossedMeshSpeedRatio` in `src/math/gearMath.ts`, `verticalSide`, `stemEngagement` in `src/kinematics/keylessGeometry.ts` | derived here from rolling pitch circles at the contact (teeth pass at the same rate; surface velocities equal); REF-ENG §5.3 only covers parallel meshes | ASM-0019, ASM-0001 | DERIVED; cited. SRC-0010 (Nie et al. 2026, JSME, peer-reviewed, read) states the same relation for a bevel gear pair (i₁₂ = ψ2/ψ1 = z1/z2), closing the crossed-axis citation; SRC-0009 (Wikipedia, read) supports the general spur-gear principle. SRC-0007, SRC-0008 remain unread and are no longer needed. Still a generic-machine-gear source, not horological (CLAUDE_REFERENCE_INSTRUCTIONS.md rule 10): SRC-0019 (Hillmann, "The Keyless Mechanism", a horological primary source specifically about this winding-pinion/transmission-wheel right-angle gearing) was found and read, but describes correct engagement only qualitatively ("ratio of the sizes of the mobiles", matched tooth counts and pitch) and gives no explicit speed-ratio formula, so it does not itself close this gap | L2 | `keyless.test.ts` › property: surface velocities agree… (independent 3D check) |
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
| Isochronism-adjusted daily rate (s/day) | dailyRate₀ + c·(A − A_ref), a first-order (local) linearization around the declared reference amplitude A_ref (`Balance.amplitude`) | `isochronismAdjustedRate` in `src/kinematics/balance.ts` | REF-ENG §10 | ASM-0034 | DERIVED (the linearization itself is elementary; c has no citable universal value — SRC-0032, Tier 1/2 NIST/NBS, confirms the phenomenon and cites Phillips' 1861 zero-error geometric conditions, SRC-0033, but gives no usable closed-form rate-vs-amplitude formula, so c is a declared/measured per-movement input); null c leaves ASM-0024's isochronous baseline unchanged | L3 | `balance.test.ts` › isochronism-adjusted rate |
| Temperature-adjusted daily rate (s/day) | dailyRate₀ + c·(T − T_ref), a first-order (local) linearization around the conventional 20 °C "middle temperature" (T_ref, overridable) | `temperatureAdjustedRate`, `MIDDLE_TEMPERATURE_CELSIUS`, `USUAL_TEMPERATURE_RANGE_CELSIUS` in `src/kinematics/balance.ts` | REF-ENG §10 | ASM-0046 | DERIVED (the linearization is elementary, same pattern as isochronism; c has no citable universal value — SRC-0040, Tier 1 NIST/NBS (Gould 1934), confirms a compensated balance's rate-vs-temperature curve is "approximately straight lines" near the working range and cites the 20 °C/5 °C/35 °C conventions used verbatim here, but gives no single numeric coefficient — compensated and monometallic assemblies differ by an order of magnitude — so c is a declared/measured per-movement input); null c leaves ASM-0024's baseline unchanged | L3 | `balance.test.ts` › temperature-adjusted rate |
| Moonphase fraction (dimensionless, 0–1) | ((shaftAngle / 2π) × windowsPerRevolution) mod 1, read directly from the disc arbor's own solved angle | `moonPhaseFraction` in `src/kinematics/moonPhase.ts` | REF-ENG §8 (motion-works-style continuous reduction, no new section — Phase 8.1) | ASM-0047 | DERIVED (the cyclical read is elementary, same pattern as `readHand`; no absolute calendar date is tracked anywhere in this project, so this is not a claim to show any particular real date's moon phase) | L2 | `moonPhase.test.ts` › moonPhaseFraction |
| Implied lunation (days) | (2π / \|ω\|) / 86 400 / windowsPerRevolution, from the disc arbor's own solved continuous angular velocity | `impliedLunationDays` in `src/kinematics/moonPhase.ts` | REF-ENG §8 | ASM-0047 | DERIVED from the solved gear train (elementary); compared, not fitted, against the real synodic month (SYNODIC_MONTH_DAYS = 29.53059 days, SRC-0046, NASA/GSFC) via `lunationDriftMinutes` — the comparison is reported only, never fed back into the model | L2 | `moonPhase.test.ts` › impliedLunationDays, lunationDriftMinutes |
| Date jump trigger (boolean) | previousAngle + ω·dt ≥ 2π, forward only (ω ≤ 0 never fires) | `crossesRevolution` in `src/kinematics/dateComplication.ts`, applied in `stepSimulation` (`src/simulation/simulationState.ts`) | REF-ENG §8 (motion-works-style drive) | ASM-0048 | DERIVED threshold-crossing detection (elementary); the forward-only (ratchet) restriction is a structural assumption about how any real star-and-jumper mechanism behaves (reversing the drive does not un-advance the star), not itself drawn from a specific quote — SRC-0042 (a granted patent) confirms the forward jump and its one-step limit directly: "the calendar mobile 1 to be advanced by one step," with "a concave portion... preventing the latter from moving by more than one step" | L2 | `dateComplication.test.ts` › crossesRevolution; `simulationState.test.ts` › date jump |
| Date jump step angle (rad) | 2π / starToothCount | `dateJumpStepAngle` in `src/kinematics/dateComplication.ts` | REF-ENG §8 | ASM-0048 | DERIVED (elementary); starToothCount = 31 is SRC-0042's own worked example ("an inner toothing 1a of thirty-one teeth") | L2 | `dateComplication.test.ts` › dateJumpStepAngle |
| Star position (0-indexed) | round((normalizeAngle(starAngle) / 2π) × starToothCount) mod starToothCount | `starPosition` in `src/kinematics/dateComplication.ts` | REF-ENG §8 | ASM-0048 | DERIVED (elementary); rounds rather than floors so accumulated floating-point drift from many jumps never reads one step short | L2 | `dateComplication.test.ts` › starPosition |
| Days in month (non-leap, 0-indexed, wraps) | GREGORIAN_MONTH_LENGTHS[monthIndex mod 12] | `daysInMonth` in `src/kinematics/monthComplication.ts` | elementary calendar fact | ASM-0049 | NAMED CONSTANT, not derived or invented — a structural fact about the Gregorian calendar, same treatment as SYNODIC_MONTH_DAYS (ASM-0047); February fixed at 28 days, leap years out of scope until Phase 8.4 | L2 | `monthComplication.test.ts` › daysInMonth |
| Month-end correction (date steps, month-advance flag) | dayPosition + 1 = lastDay ⇒ {dateSteps: starToothCount − lastDay + 1, monthAdvances: true}; else {dateSteps: 1, monthAdvances: false} | `monthEndCorrection` in `src/kinematics/monthComplication.ts` | REF-ENG §8 | ASM-0049 | DERIVED (elementary); reduces to an ordinary single step after a 31-day month, so no separate branch is needed there — verified by hand for every Gregorian month length (28/30/31 days); SRC-0043 (a granted patent): the date disc "includ[es]... a correction drive wheel set... able to... drive the date disc through an additional step at the end of the months of less than thirty one days" | L2 | `monthComplication.test.ts` › monthEndCorrection; `simulationState.test.ts` › month-end correction |
| Month jump step angle (rad) | 2π / MONTHS_PER_YEAR | `monthJumpStepAngle` in `src/kinematics/monthComplication.ts` | REF-ENG §8 | ASM-0049 | DERIVED (elementary); 12 positions is a structural fact about the calendar, not a declared field | L2 | `monthComplication.test.ts` › monthJumpStepAngle |
| Geneva no-shock pin-radius ratio λ | sin(π / n) | `genevaLambda` in `src/kinematics/genevaDrive.ts` | elementary circle/triangle geometry (O1-P ⟂ O2-P at entry/exit) | ASM-0050 | DERIVED; VERIFIED_TEXT (SRC-0047, eq. 4, a peer-reviewed mechanism-design paper) and independently re-derived from first principles (right triangle O1-O2-P, right-angled at P, Thales' theorem) | L2 | `genevaDrive.test.ts` › genevaLambda; property: λ² + lockingRatio² = 1 |
| Geneva locking-disc radius ratio | cos(π / n) | `genevaLockingDiscRadiusRatio` in `src/kinematics/genevaDrive.ts` | same construction as λ | ASM-0050 | DERIVED; VERIFIED_TEXT (SRC-0047) | L2 | `genevaDrive.test.ts` › genevaLockingDiscRadiusRatio |
| Geneva wheel advance per index (rad) | 2π / n | `genevaWheelAdvanceAngle` in `src/kinematics/genevaDrive.ts` | elementary (n equally-spaced slots) | ASM-0050 | DERIVED; VERIFIED_TEXT (SRC-0047) | L2 | `genevaDrive.test.ts` › genevaWheelAdvanceAngle |
| Geneva driver motion sweep (rad) | π(n − 2) / n | `genevaDriverMotionAngle` in `src/kinematics/genevaDrive.ts` | elementary, from the entry/exit angles | ASM-0050 | DERIVED; VERIFIED_TEXT (SRC-0047) | L2 | `genevaDrive.test.ts` › genevaDriverMotionAngle |
| Geneva driven-wheel angle β(α), α from the stroke's symmetric midpoint | β = arctan(λ sin α / (1 − λ cos α)) | `genevaWheelAngle` in `src/kinematics/genevaDrive.ts` | elementary vector/coordinate geometry (driver pin position relative to the driven wheel's centre) | ASM-0050 | DERIVED; same functional form as SRC-0047 eq. 1–2, but this module's own α reference point (the stroke's midpoint, not its entry) was independently re-derived from the driver-pin/wheel-centre coordinate geometry and verified numerically against it, not merely trusted from a transcription | L2 | `genevaDrive.test.ts` › genevaWheelAngle (incl. a direct-coordinate-geometry cross-check, boundary values, oddness, monotonicity) |
| Geneva driven-wheel angular velocity ω2(α) | ω2 = λ·ω1·(cos α − λ) / (1 + λ² − 2λ cos α) | `genevaWheelAngularVelocity` in `src/kinematics/genevaDrive.ts` | dβ/dα of the position formula above (elementary calculus, hand-verified) | ASM-0050 | DERIVED; same functional form as SRC-0047 eq. 3; cross-checked against a numerical derivative of `genevaWheelAngle` and against integrating it back to the net wheel advance | L2 | `genevaDrive.test.ts` › genevaWheelAngularVelocity (numerical-derivative agreement, integration-recovers-advance, boundary and peak checks) |
| Pallet span angle (rad) | φ = span × 2π / z | `spanAngle` in `src/kinematics/palletGeometry.ts` | REF-ENG §9 | ASM-0021, ASM-0025 | DERIVED | L1 | `palletGeometry.test.ts` |
| Tangential locking distance (m) | escape-to-pallet axis = R_tip / cos(φ/2), for 0 < φ < π | `tangentialCentreDistance` | geometry of two tangents to a circle | ASM-0025 | DERIVED | L1 | `palletGeometry.test.ts` › property: tangents at the locking points meet at the pallet axis |
| Lever impulse angle (rad) | lever − lock − run | `impulseAngle` | definition | ASM-0025 | DERIVED | L1 | `mainspringEnergy.test.ts` › pallet rules |
| Fork ratio | lift angle / lever angle | `forkRatio` | definition | ASM-0025 | DERIVED | L1 | `palletGeometry.test.ts` |
| Fork acting length (m) | impulse radius × fork ratio | `forkActingLength` in `src/kinematics/palletGeometry.ts` | REF-ENG §9 | ASM-0041 | DERIVED; VERIFIED_TEXT (SRC-0036, Playtner's own 5:1 proportion and 4.5mm fork-length worked example) | L1 | `palletGeometry.test.ts` › fork acting length |
| Suggested ruby-pin width (rad) | lever angle / 2 | `suggestedRubyPinWidth` in `src/kinematics/palletGeometry.ts` | REF-ENG §9 | ASM-0042 | DERIVED; VERIFIED_TEXT (SRC-0036: "we would choose a ruby pin of a width equal to half the angular motion of the fork") | L1 | `palletGeometry.test.ts` › suggested ruby-pin width |
| Guard-point clearance (m) | guard-point radius × guard-point freedom (arc length) | `guardPointClearance` in `src/kinematics/palletGeometry.ts` | REF-ENG §9 | ASM-0043 | DERIVED; VERIFIED_TEXT (SRC-0036, Playtner's own worked example: 4mm guard radius, 1¼° freedom ⇒ 0.0873mm) | L1 | `palletGeometry.test.ts` › guard-point clearance |
| Ring-crossing angle (rad) | angle, at a circle's centre, between the line to a ray's origin and the line to where that ray first crosses the circle (nearest-root ray/circle intersection, then law of cosines) | `ringCrossingAngle` in `src/kinematics/palletGeometry.ts` | elementary circle geometry | ASM-0044 | DERIVED; VERIFIED_GEOMETRY (property test cross-checks against an independent ray/circle-intersection construction) | L1 | `palletGeometry.test.ts` › property: ringCrossingAngle |
| Ruby-pin angle at balance centre (rad) | angle, at the balance centre, between the line to the pallet centre and the line to the ruby pin, from the three already-known triangle sides (law of cosines) | `rubyPinAngleAtBalance` in `src/kinematics/palletGeometry.ts` | elementary triangle geometry | ASM-0044 | DERIVED; VERIFIED_GEOMETRY (property test cross-checks against an independent two-circle intersection) | L1 | `palletGeometry.test.ts` › property: rubyPinAngleAtBalance |
| Single-roller crescent half-angle (rad) | \|guard-point crossing angle − ruby-pin angle\| at the balance centre (full opening is double, mirrored) | `crescentHalfAngle` in `src/kinematics/palletGeometry.ts` | REF-ENG §9 | ASM-0044 | DERIVED; the author's own trigonometric reconstruction of SRC-0036 "The Crescent"'s verbal compass construction — no worked numeric example exists to verify the combined result against | L1 | `palletGeometry.test.ts` › crescent half-angle composes… |
| Horn clearance (m) | fork acting length × horn freedom (arc length) | `hornClearance` in `src/kinematics/palletGeometry.ts` | REF-ENG §9 | ASM-0045 | DERIVED; the horn's end lies on the same pallet-centred arc as the ruby pin, so this reuses `forkActingLength` as its radius — no new field, no worked numeric example to verify against (the chapter's own worked example leaves absolute size "immaterial") | L1 | `palletGeometry.test.ts` › horn clearance |
| Wheel-angle budget per beat (rad) | π / escapeTeeth (half the tooth pitch) | `wheelAngleBudgetPerBeat` in `src/kinematics/palletGeometry.ts` | REF-ENG §9 | ASM-0021, ASM-0036 | DERIVED; VERIFIED_TEXT (SRC-0036, Playtner, worked 15-tooth example: 12° budget = 4½° tooth + 6° pallet + 1½° drop) | L1 | `palletGeometry.test.ts` › wheel-angle budget per beat |
| Drop clearance at tip circle (m) | tip radius × drop angle (arc length) | `dropClearance` in `src/kinematics/palletGeometry.ts` | REF-ENG §9 | ASM-0036 | DERIVED; VERIFIED_TEXT (SRC-0036, Playtner's own worked example: 7.5mm primitive diameter, 1.5° drop ⇒ 0.0983mm) | L1 | `palletGeometry.test.ts` › drop clearance |
| Escape-tooth width (rad) | wheel-angle budget − pallet width − drop | `toothWidthAngle` in `src/kinematics/palletGeometry.ts` | REF-ENG §9 | ASM-0021, ASM-0037 | DERIVED; VERIFIED_TEXT (same SRC-0036 passage as the budget row: 12° = 4½° tooth + 6° pallet + 1½° drop) | L1 | `palletGeometry.test.ts` › tooth width |
| Escape-tooth locking face (rad) | 2 × pallet draw angle (conventional doubling, not a strict formula) | `toothDrawAngle` in `src/kinematics/palletGeometry.ts` | REF-ENG §9 | ASM-0039 | DERIVED; VERIFIED_TEXT (SRC-0036, Playtner's own worked example: 12° draw ⇒ 24° tooth locking face) | L1 | `palletGeometry.test.ts` › escape-tooth locking face |
| Spring torque at a wind (N·m) | T_letdown + (T_full − T_letdown) × w / turns, w clamped to [0, turns] | `springTorque` in `src/kinematics/mainspringEnergy.ts` | REF-ENG §11 | ASM-0026 | DERIVED from entered values | L3 | `mainspringEnergy.test.ts` › linear in wind |
| Power reserve (s) | turns / (abs(ω_drum) / 2π) | `powerReserveSeconds` | definition | ASM-0026 | DERIVED | L2 | › 6.5 turns at one drum turn per 6 h is 39 h |
| Escape wheel torque (N·m) | T_drum × abs(ω_drum / ω_escape) × η_train (η = 1, the lossless bound, when not configured) | `escapeTorque` | conservation of power | ASM-0002, ASM-0026 | DERIVED; upper bound without η | L3 | › escape torque conserves power |
| Energy per beat to the balance (J) | T_escape × π / z × η_escapement | `energyPerBeat`, `escapeRotationPerBeat` | work = torque × angle | ASM-0021, ASM-0026 | DERIVED | L3 | › energy per beat |
| Steady amplitude (rad) | A = √(2 Q E_beat / (π k)), from 2 E_beat = 2π (½ k A²) / Q | `steadyAmplitude` | definition of Q; ½ k A² | ASM-0024, ASM-0026 | DERIVED; requires physical validation | L3 | › property: energy in per period equals the loss |
| Stop wind (turns) | where A(w) = lift / 2, with A ∝ √T(w) | `summarizeEnergy` in `src/kinematics/energySummary.ts` | follows from the two above | ASM-0023, ASM-0026 | DERIVED | L3 | › finds where the balance stops unlocking |
| Mainspring state of wind (turns) | dw/dt = (ω_arbor − ω_drum) × sign(ω_drum running) / 2π, clamped to [0, turns] | `stepSimulation`, `windTracks` in `src/simulation/simulationState.ts` | kinematics of the barrel | ASM-0018, ASM-0026 | DERIVED; simulation state | L2 | `simulationState.test.ts` › mainspring wind; `store.test.ts` › run-down |
| Toleranced limits (m) | lower = nominal + lower deviation; upper = nominal + upper deviation | `Tolerance` in `src/domain/tolerance.ts` | REF-ENG §14 | none (declared intent) | user input; not validated | L1 | `toleranceAnalysis.test.ts` |
| Worst-case stack (m) | R = Σ sᵢ xᵢ; R_min = Σ (sᵢ > 0 ? lowerᵢ : −upperᵢ); R_max likewise; untoleranced inputs at nominal | `evaluateStack` in `src/assembly/toleranceAnalysis.ts` | REF-ENG §14 | ASM-0017 | DERIVED | L1 | › property: min ≤ nominal ≤ max… |
| Side shake over tolerances (m) | bore − pivot, worst case | `sideShakeStack` | REF-ENG §12, §14 | ASM-0013, ASM-0017 | DERIVED; acceptability UNKNOWN — pending candidate: NIHS 04-04/04-03 (SRC-0030), NIHSG 41-11/NIHS 94-10 (SRC-0031), paywalled, unretrieved | L1 | › side shake: min takes… |
| Endshake over tolerances (m) | upper underside − lower underside − lower thickness − shoulder span, worst case | `endshakeStack` | REF-ENG §12, §14 | ASM-0010, ASM-0011, ASM-0017 | DERIVED; acceptability UNKNOWN — pending candidate: NIHS 04-04/04-03 (SRC-0030), paywalled, unretrieved | L1 | › endshake stacks… |
| Mesh centre distance over tolerances (m) | first-order (Taylor) expansion anchored at the placed distance d: min/max = d + Σ coefficientᵢ × worst-case(limitᵢ − nominalᵢ); module coefficient = (z1+z2)/2 (exact); a FIXED shaft's position coefficient = ± the mesh's direction cosine (linear approximation) | `meshCentreDistanceStack` in `src/assembly/toleranceAnalysis.ts` | REF-ENG §14 | ASM-0017, ASM-0027 | DERIVED; nominal always equals the placed distance | L1 | `toleranceAnalysis.test.ts` › gear mesh centre-distance stack, incl. a property test |
| Plan drawing (mm) | frame outlines, solved axes, pitch circles (d = m z), placed centre distances; ideal added when they differ by more than the ASM-0008 tolerance; a mesh's worst-case centre distance added ("· tol min…max") only where toleranced | `buildPlanDrawing` in `src/outputs/drawing/planDrawing.ts` | REF-ENG §5.1, §5.2, §6, §14 | ASM-0006, ASM-0008, ASM-0027 | DERIVED; nominal only except that annotation (MFG-001) | L1 | `outputs.test.ts` › plan drawing |
| Elevation drawing (mm) | orthographic X-Z projection along Y: frame bodies over their outline's X-extent, arbor centrelines over their occupied Z-span, gear/escapement bodies at pitch/tip diameter and thickness, bearing markers flush with the frame's inner face, overall height, and a toleranced arbor's endshake dimension | `buildElevationDrawing` in `src/outputs/drawing/elevationDrawing.ts` | REF-ENG §5.1, §6, §11, §14 | ASM-0006, ASM-0011, ASM-0017 | DERIVED; nominal only except the endshake annotation (MFG-001) | L1 | `outputs.test.ts` › elevation drawing |
| Visual mesh export (mm) | viewport frame slabs and visual tooth outlines at assembled positions | `buildStl` in `src/outputs/stl.ts` | none; visualization only | ASM-0004, ASM-0005, ASM-0010 | APPROXIMATION | L0 | `outputs.test.ts` › STL |
| Tooth outline (visual) | trapezoid with addendum 1.0 × module and dedendum 1.25 × module | `generateGearOutline` | none; visualization only | ASM-0005, ASM-0004 | APPROXIMATION | L0 | `gearOutline.test.ts` |
| Escape-tooth outline (visual) | flat top of `toothWidthAngle` at the tip circle; locking edge found by ray–circle intersection at `toothDrawAngle` off the radial; plain radial trailing edge to the root | `generateEscapeWheelOutline` (with a tooth face) in `src/geometry/assemblyGeometry3d.ts` | none; visualization only | ASM-0037, ASM-0038, ASM-0039, ASM-0040, ASM-0004 | APPROXIMATION; straight-edged, no face curvature | L0 | `assemblyGeometry3d.test.ts` › generateEscapeWheelOutline |
| Pallet stone outline (visual) | quadrilateral: locking face through the locking point in the declared/derived draw direction, swept back a fixed visual depth | `generatePalletStoneOutline` in `src/geometry/assemblyGeometry3d.ts` | none; visualization only | ASM-0039, ASM-0040, ASM-0004 | APPROXIMATION; no true contact geometry | L0 | `assemblyGeometry3d.test.ts` › generatePalletStoneOutline |

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
| Schema-7 file | Migrated to schema 8 on open (balance isochronism coefficient unknown, ASM-0034). |
| Schema-8 file | Migrated to schema 9 on open (pallet geometry, where given, gains an empty drop angle to fill in, ASM-0036). |
| Schema-9 file | Migrated to schema 10 on open (pallet geometry, where given, gains EQUIDISTANT — the only implemented kind — and an empty width angle to fill in, ASM-0037). |
| Schema-10 file | Migrated to schema 11 on open (escape wheels gain CLUB — the only tooth kind previously assumed — ASM-0038). |
| Schema-11 file | Migrated to schema 12 on open (balances gain an empty (null) impulse radius to fill in, ASM-0041). |
| Schema-12 file | Migrated to schema 13 on open (pallet geometry, where given, gains an empty (null) ruby-pin entry freedom and slot shake to fill in, ASM-0042). |
| Schema-13 file | Migrated to schema 14 on open (balances gain `rollerKind: "SINGLE"` — the only configuration previously assumed; pallet geometry, where given, gains an empty (null) guard-point freedom and radius to fill in, ASM-0043). |
| Schema-14 file | Migrated to schema 15 on open (balances gain an empty (null) roller radius to fill in, ASM-0044). |
| Schema-15 file | Migrated to schema 16 on open (pallet geometry, where given, gains an empty (null) horn freedom to fill in, ASM-0045). |
| Schema-16 file | Migrated to schema 17 on open (balances gain an empty (null) temperature coefficient to fill in, ASM-0046). |
| Schema-17 file | Migrated to schema 18 on open (movements gain an empty `moonPhases` record, ASM-0047, Phase 8.1). |
| Schema-18 file | Migrated to schema 19 on open (movements gain an empty `dateComplications` record, ASM-0048, Phase 8.2). |
| Schema-19 file | Migrated to schema 20 on open (movements gain an empty `monthComplications` record, ASM-0049, Phase 8.3). |
| Schema-20 file | Migrated to schema 21 on open (movements gain an empty `leapYearComplications` record, ASM-0050, Phase 8.4). |
| New pallet geometry (all empty) | Kept NaN; defaults to EQUIDISTANT (ASM-0037, the only implemented kind); ESC-104 span error, ESC-105 and ESC-106 errors until entered. No default angles. |
| Pallet span not k + ½ teeth, or ≥ 180° | ESC-104 error; locking distance not derived; symbolic fork arms shown. |
| Lock + run ≥ lever angle; lock ≤ 0; run < 0 | ESC-105 error. |
| Draw ≤ 0 | ESC-105 warning (nothing pulls the lever onto its banking); no escape-tooth locking face derived (ESC-108). |
| Draw > 0, derived escape-tooth locking face (2 × draw) outside the practically cited 20°-28° range | ESC-108 info advisory (ASM-0039); never blocks. |
| Impulse radius ≤ 0 (when entered) | ESC-109 error; no fork acting length derived. |
| Ruby-pin entry freedom ≤ 0 (when entered) | ESC-110 error. |
| Ruby-pin entry freedom ≥ total lock (lock + run), when entered | ESC-110 error — a premature strike against the fork could otherwise fully unlock the pallets instead of leaving them locked. |
| Ruby-pin entry freedom outside the cited 1°-1¼° range (but under the total lock) | ESC-110 info advisory (ASM-0042); never blocks. |
| Ruby-pin slot shake ≤ 0 (when entered) | ESC-110 error. |
| Ruby-pin slot shake outside the cited ¼°-½° range | ESC-110 info advisory (ASM-0042); never blocks. |
| Guard-point freedom ≤ 0 (when entered) | ESC-111 error. |
| Guard-point freedom ≥ total lock (lock + run), when entered | ESC-111 error — a premature strike against the guard point could otherwise fully unlock the pallets instead of leaving them locked. |
| Guard-point radius ≤ 0 (when entered) | ESC-111 error; no clearance derived. |
| Single roller with fork ratio below Playtner's cited floor (3 to 1) | ESC-111 info advisory (ASM-0043); never blocks; not checked for a double roller. |
| Roller radius ≤ 0 (when entered) | ESC-112 error; no crescent opening derived. |
| Entered roller radius, impulse radius, fork acting length and the actual placed pallet-to-balance distance do not form a consistent geometry | ESC-112 warning, not an error — the entered values are reported as inconsistent rather than silently producing a wrong number; never fires for a double roller. |
| Horn freedom ≤ 0 (when entered) | ESC-113 error. |
| Horn freedom ≥ total lock (lock + run), when entered | ESC-113 error — the fork could otherwise be fully unlocked instead of drawn back against the bank if the horn strikes the ruby pin. |
| Horn freedom outside the cited ¼°-½° margin above the guard-point freedom (but under the total lock, and only when guard-point freedom is also entered) | ESC-113 info advisory (ASM-0045); never blocks. |
| Drop ≤ 0, or ≥ the one-beat wheel-angle budget | ESC-106 error; no clearance derived. |
| Pallet width ≤ 0 | ESC-106 error. |
| Pallet width + drop ≥ the one-beat wheel-angle budget (negative derived tooth width, club tooth) | ESC-106 error; no clearance or tooth-width figure derived. |
| Pallet width + drop = the one-beat wheel-angle budget exactly (zero derived tooth width), ratchet tooth | Valid, not an error (ASM-0038 — the tooth is a bare point, the entire lift is on the pallet); clearance and tooth-width figure (0°) are still derived. A club tooth at the same values is still an ESC-106 error. |
| Pallet width + drop > the one-beat wheel-angle budget (negative derived tooth width), ratchet tooth | ESC-106 error; no clearance or tooth-width figure derived. |
| Drop outside the type-specific informal range (1.5° club / 2° ratchet, but within budget) | ESC-107 info advisory (ASM-0036, ASM-0038); never blocks. |
| Mainspring data empty, turns ≤ 0, torques ≤ 0, let-down > fully wound, efficiency outside (0, 1] | SPR-001 error; no energy chain; the wind is not tracked. |
| Q or escapement efficiency unknown | Amplitude not predicted; SPR-002 names what is missing; the declared amplitude is shown. |
| Q ≤ 0 or efficiency outside (0, 1] | SPR-001 error. |
| Q outside roughly 100–300 | SPR-004 info advisory (ASM-0035); never blocks or changes the model. |
| Predicted amplitude below half the lift angle before let-down | SPR-003 warning with the stop wind and running reserve; error if even fully wound. The simulation stops a balance-governed train there. |
| Balance inertia or stiffness empty | Stored as null (unknown); the model stays kinematic; a balance-governed drive reports BAL-001 and drives nothing. |
| Balance inertia or stiffness ≤ 0 | BAL-001 error; no free frequency. |
| Isochronism coefficient empty | Stored as null (unmodeled); the balance stays isochronous (ASM-0024). |
| Isochronism coefficient non-finite | BAL-001 error. Any sign/magnitude is otherwise accepted — it is a rate-of-change, not a size. |
| Temperature coefficient empty | Stored as null (unmodeled); the baseline rate (ASM-0024) stands unqualified by temperature. |
| Temperature coefficient non-finite | BAL-001 error. Any sign/magnitude is otherwise accepted — it is a rate-of-change, not a size. |
| Moonphase disc not driven (arbor's solved angular velocity unavailable) | MOON-002 reports "not driven" instead of an implied lunation; no error. |
| Moonphase disc dimensions non-positive/non-finite, or mounted on a non-existent arbor | MOON-001 error, one per problem. |
| Date complication not driven (drive arbor's solved angular velocity unavailable or zero) | DATE-003 reports "not driven" instead of an implied jump period; no error. |
| Date complication star dimensions non-positive/non-finite, tooth count not a positive integer, drive/star arbors missing or identical | DATE-001 error, one per problem. |
| Date complication star arbor also reached by the continuous gear train | DATE-002 error — a jump mechanism's star must not be meshed. |
| Date complication drive arbor's implied period more than ±10% from one day | DATE-003 warning instead of info; not itself sourced, a round generous margin. |
| Month complication star dimensions non-positive/non-finite, star arbor missing, referenced date complication missing, star arbor same as the date complication's own star arbor | MONTH-001 error, one per problem. |
| Month complication star arbor also reached by the continuous gear train | MONTH-001 error (`star-also-geared`) — a jump mechanism's star must not be meshed. |
| Leap-year complication wheel dimensions non-positive/non-finite, wheel arbor missing, referenced month complication missing, wheel arbor same as the month complication's own star arbor | YEAR-001 error, one per problem. |
| Leap-year complication wheel arbor also reached by the continuous gear train | YEAR-001 error (`wheel-also-geared`) — a jump mechanism's wheel must not be meshed. |
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
| GEAR-103 | error (missing pressure angle) / warning (undercut) | L1 | an INVOLUTE_PROFILE gear needs a positive pressure angle; below the no-undercut threshold is reported as an advisory (project addition, ASM-0031, SRC-0024) |
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
| BRG-006 | info | L1 | endshake looser than an informal, unconfirmed forum-sourced figure — escapement (~0.05mm) vs train (~0.10mm) shafts (project addition, ASM-0028, SRC-0011; primary standard most likely to supersede this named but unretrieved, SRC-0030) |
| BRG-007 | info | L1 | side shake looser than an informal, unconfirmed forum-sourced figure credited to Hans Jendritzki — pivot up to 0.30mm (~0.01mm) vs larger (~0.02mm) (project addition, ASM-0029, SRC-0012; primary standard most likely to supersede this named but unretrieved, SRC-0030/SRC-0031) |
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
| ESC-002 | info | L2 | states what the simplified model does not claim (impact, sliding contact, faces, rate accuracy, and drop unless ESC-106/107 declare it) and which parts are simplified models |
| ESC-104 | error | L1 | pallet span is k + ½ teeth and under 180°; pallet arbor at the tangential locking distance (project addition, ASM-0025) |
| ESC-105 | error / warning | L1 | lock positive, run not negative, lock + run leave impulse; draw positive (warning) (project addition, ASM-0025) |
| ESC-106 | error | L1 | drop and pallet width (wheel-side) each positive, and together leaving a derived tooth width within the one-beat wheel-angle budget, π/escapeTeeth, that is positive for a club tooth or non-negative for a ratchet tooth (project addition, ASM-0021, ASM-0036, ASM-0037, ASM-0038) |
| ESC-107 | info | L1 | drop outside the type-specific informally cited range (1.5° club / 2° ratchet); reports the resulting tip-circle clearance and the derived tooth width (project addition, ASM-0036, ASM-0037, ASM-0038, SRC-0036) |
| ESC-108 | info | L1 | when draw is positive, reports the derived escape-tooth locking face (2 × draw, conventional, for point contact); outside the practically cited 20°-28° range is an advisory (project addition, ASM-0039, SRC-0036) |
| ESC-109 | error / info | L1 | impulse radius, when entered, must be positive; the fork's real acting length is then reported, derived via the balance-lift/lever-angle ratio (project addition, ASM-0041, SRC-0036) |
| ESC-110 | error / info | L1 | ruby-pin entry freedom, when entered, must be positive and less than the total lock (lock + run); slot shake, when entered, must be positive; outside Playtner's cited figures is an advisory; the suggested ruby-pin width (half the fork's angular motion) is reported (project addition, ASM-0042, SRC-0036) |
| ESC-111 | error / info | L1 | guard-point freedom, when entered, must be positive and less than the total lock (lock + run); guard-point radius, when entered, must be positive, and the derived clearance is reported; a single roller with a fork ratio under Playtner's cited floor (3 to 1) is an advisory, not checked for a double roller (project addition, ASM-0043, SRC-0036) |
| ESC-112 | error / warning / info | L1 | single roller only: roller radius, when entered, must be positive; with it, the impulse radius, fork acting length, guard-point freedom and the actual placed pallet-to-balance distance, the derived crescent opening is reported, or a warning when those lengths do not form a consistent geometry (project addition, ASM-0044, SRC-0036) |
| ESC-113 | error / info | L1 | horn freedom, when entered, must be positive and less than the total lock (lock + run); the derived horn clearance is reported; outside the cited ¼°-½° margin above the guard-point freedom (when both are entered) is an advisory (project addition, ASM-0045, SRC-0036) |
| ESC-101 | error | L1 / L2 | one escapement, three distinct existing arbors, valid inputs, amplitude above half the lift angle (project addition) |
| ESC-102 | error | L2 | pallet arbor and balance staff are not gear-driven (project addition) |
| ESC-103 | error | L1 | escape wheel clears the pallet arbor, the balance and other gears at its height; the balance clears the pallet arbor (project addition) |
| BAL-001 | error | L2 / L3 | entered inertia and stiffness positive, isochronism and temperature coefficients finite; a balance-governed drive needs an escapement, escape wheel and both inputs (project addition, ASM-0034, ASM-0046) |
| BAL-002 | info | L3 | free frequency, frequency needed for nominal time, stiffness for nominal, predicted daily rate, with limits; isochronism-adjusted rate at the predicted amplitude when a coefficient is declared (project addition, ASM-0034); temperature-adjusted rate across the usual 5 °C-35 °C range when a coefficient is declared (project addition, ASM-0046, SRC-0040) |
| SPR-001 | error | L3 | mainspring data, Q and escapement efficiency within their valid ranges (project addition, ASM-0026) |
| SPR-002 | info | L3 | reserve, escape torque (lossless bound when so), predicted amplitude or what it needs (project addition, ASM-0026) |
| SPR-003 | warning / error | L3 | the balance stops before let-down (warning) or cannot unlock even fully wound (error) (project addition, ASM-0026) |
| SPR-004 | info | L3 | entered Q outside ~100–300, an informal reference range for a mechanical wristwatch balance (project addition, ASM-0035, SRC-0034) |
| MOON-001 | error | L1 | moonphase disc dimensions positive/finite, mounted on an arbor that exists (project addition, ASM-0047) |
| MOON-002 | info | L2 | implied lunation period from the disc arbor's own solved angular velocity, reported against the real synodic month (project addition, ASM-0047, SRC-0046) |
| DATE-001 | error | L1 | date complication star dimensions positive/finite, tooth count a positive integer, drive and star arbors exist and are distinct (project addition, ASM-0048) |
| DATE-002 | error | L2 | the star arbor must not also be reached by the continuous gear train (project addition, ASM-0048) |
| DATE-003 | info / warning | L2 | implied jump period from the drive arbor's own solved angular velocity, reported against one day; warning outside ±10% (project addition, ASM-0048, SRC-0042) |
| MONTH-001 | error | L1 / L2 | month complication star dimensions positive/finite, star and referenced date complication exist and are distinct from the date star, and the star arbor must not also be reached by the continuous gear train (project addition, ASM-0049) |
| MONTH-002 | info | L2 | the correction schedule this mechanism applies: which months get an extra date-star step and by how many, flagging February's fixed 28-day length and the Phase 8.4 leap-year deferral (project addition, ASM-0049) |
| YEAR-001 | error | L1 / L2 | leap-year complication wheel dimensions positive/finite, wheel and referenced month complication exist and are distinct from the month's own star arbor, and the wheel arbor must not also be reached by the continuous gear train (project addition, ASM-0050) |
| YEAR-002 | info | L2 | the drive model (driven by the month complication's own December-to-January wrap) and reference Geneva-mechanism figures (4-slot index angle, motion/dwell split, no-shock pin-radius ratio, peak speed ratio) this mechanism's real indexing stroke would have (project addition, ASM-0050, SRC-0047) |
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
