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
      "Simplified energy model: mainspring torque varies linearly with wind between entered end values; torque reaches the escape wheel by power balance with an optional overall train efficiency (lossless upper bound otherwise); each beat delivers torque × half a pitch × escapement efficiency; the balance loses 2πE/Q per period; steady state only, and amplitude does not affect rate (ASM-0024). Searched for a closed-form \"real\" (nonlinear) torque-vs-wind curve to improve on the straight-line model: three independent sources (SRC-0037, read; SRC-0038, unread/blocked; SRC-0039, read) converge on the same negative result — the standard engineering treatment of a spiral spring is itself an ideal *linear* torsion relation (no narrower than this project's own two-point line), and the real nonlinearity comes from coil friction and barrel/arbor contact, for which no accessible formula was found; it must be measured, not computed, the same conclusion reached for circular error (ASM-0034). A mainspring's slipping bridle (REF-ENG §11's \"bridle/slipping behaviour\") has a cited ~1.3–1.5× slip-to-working-torque ratio (SRC-0038), but unread/unverified and scoped by other unread snippets to automatic winding specifically, a mechanism this project does not model at all — nothing implemented from either search",
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
      "Endshake advisory thresholds (~0.05 mm for escapement shafts — escape wheel, pallet arbor, balance staff; ~0.10 mm for other pivoted shafts) are informal figures from forum testimony (SRC-0011), not a published standard; used only as a BRG-006 informational advisory, never a pass/fail limit. (Side shake has its own advisory, ASM-0029/BRG-007, sourced separately). The primary standard most likely to supersede this (NIHS 04-04 \"Ajustements radiaux et axiaux\" and its companion NIHS 04-03, SRC-0030) is now named but paywalled and unretrieved",
    scope: "Bearings / endshake advisory",
    status: "Active",
  },
  "ASM-0029": {
    summary:
      "Side-shake advisory thresholds (0.01 mm diametral for a pivot up to 0.30 mm, 0.02 mm for a larger pivot) are an informal rule of thumb credited to Hans Jendritzki, from forum testimony (SRC-0012, corroborated by SRC-0013), not a published standard read directly; used only as a BRG-007 informational advisory, never a pass/fail limit. The primary standard most likely to supersede this (NIHS 04-04/04-03, SRC-0030; jewel-bore standards NIHSG 41-11/NIHS 94-10, SRC-0031) is now named but paywalled and unretrieved",
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
      "WATCH_SPECIFIC_PROFILE's dedendum is the true hypocycloid (SRC-0028) traced by a generating circle of radius `generatingCircleRadius(effectiveLeafCount, module)` rolling inside the gear's own pitch circle (SRC-0026 \"clock toothing\", corroborated by SRC-0027) — sampled from the pitch circle down to the root circle (`hypocycloidThetaAtRadius`). The same generating circle (sized by the smaller, pinion-side gear of a WATCH_SPECIFIC_PROFILE mesh, via `effectiveLeafCount`) also produces the mating gear's addendum factors (ASM-0033), per SRC-0026's conjugate-action convention. When a gear has no smaller WATCH_SPECIFIC_PROFILE mesh partner, the generating circle's radius equals half the gear's own pitch radius exactly, and the hypocycloid degenerates algebraically to the straight radial line \"clock toothing\" is named for (the Tusi couple, SRC-0028) — not a separately hardcoded shape. Remaining simplifications: a gear meshing more than one WATCH_SPECIFIC_PROFILE partner uses only the smallest (ASM-0033's own simplification, inherited here); and the true standard's generating circle for a WHEEL's dedendum and the mating PINION's addendum could in principle differ from the one used for the wheel's own addendum and the pinion's dedendum — SRC-0026 states the single-generating-circle \"clock toothing\" convention uses one circle throughout a pair, which is what is implemented",
    scope: "Geometry / viewport",
    status: "Active",
  },
  "ASM-0033": {
    summary:
      "WATCH_SPECIFIC_PROFILE draws the addendum as the standard's own circular-arc tip approximation (SRC-0026), not the literal epicycloid: a circle of the tabulated radius factor, through the tip apex and the point where the dedendum meets the pitch circle, selected by profile style (round/medium/high ogival) and leaf-count bracket (6-10 / 11+), with the standard's 5% practical clearance reduction applied. SRC-0026's own addendum-height equation (its eq. 17) is itself a function of the gear ratio (both leaf counts in the mesh, since \"the tooth profiles depend on the pinion counts\"); this is honoured by `effectiveLeafCount`, which keys the table lookup off the smaller of the gear's own tooth count and its actual WATCH_SPECIFIC_PROFILE meshing partner's (both gears of a mesh share one standardized cutter selection, keyed by the pinion side) — falling back to the gear's own tooth count only when it has no such mesh. The narrowed pinion tooth-width convention (1.05m / 1.25m by the same leaf-count bracket) and the dedendum depth AND shape (ASM-0032) are likewise mesh-aware, via the same `effectiveLeafCount`. Gears with an effective leaf count below 6 are outside SRC-0026's tabulated range and are rejected (GEAR-104) rather than extrapolated",
    scope: "Geometry / viewport",
    status: "Active",
  },
  "ASM-0034": {
    summary:
      "Amplitude-dependent balance rate (\"circular error\"/isochronism error, REF-ENG §10) has an optional first-order (local linearization) correction: dailyRate(A) = dailyRate₀ + c·(A − A_ref), where A_ref is the balance's own declared `amplitude` and c (`isochronismCoefficient`, s/day per radian) is a declared/measured per-movement input, null by default. No universal value for c exists — a real spring's amplitude dependence comes from its own terminal-curve geometry (Phillips 1861, SRC-0033, cited via SRC-0032, Tier 1/2, which gives the qualitative phenomenon and Phillips' zero-error geometric conditions but no usable closed-form rate-vs-amplitude formula) — so c must be measured or sourced, never invented. Null (the default) leaves the balance isochronous by construction (ASM-0024, unchanged)",
    scope: "Balance (simplified dynamic, L3)",
    status: "Active",
  },
  "ASM-0035": {
    summary:
      "A balance quality factor Q entered outside roughly 100–300 (SRC-0034, Tier 6: Douglas Bateman's finding, cited secondhand by two independent writers, that Q — not escapement type — predicts a timekeeper's accuracy) is flagged as an informational advisory (SPR-004), never a pass/fail limit; this movement's own Q still can only come from measurement or a source (ASM-0026) and is never defaulted or inferred from the range. Escapement efficiency has no comparable advisory yet: the only figures found (SRC-0035) are geometric-only (91%/88% by tooth count, excluding friction/dynamic losses) and only two data points, not a general formula, so they do not yet translate into an implementable check",
    scope: "Energy / amplitude (L3)",
    status: "Active",
  },
  "ASM-0036": {
    summary:
      "Pallet geometry (ASM-0025) gains a declared drop angle (`PalletGeometry.dropAngle`), measured at the escape wheel's own axis — distinct from the lever-side lock/draw/run angles. For two beats per tooth (ASM-0021), each beat's wheel-angle budget (tooth width + pallet width + drop) is half the tooth pitch, π/escapeTeeth (`wheelAngleBudgetPerBeat`); drop must be positive and strictly less than that budget, since the tooth and pallet still need a positive share of it (ESC-106, a derived geometric necessity, not just a cited convention). An entered drop outside the informally cited 1–2° club-tooth range (SRC-0036, Tier 4, Playtner 1908) is a separate, non-blocking advisory (ESC-107), which also reports the resulting linear clearance at the tip circle (arc length = radius × angle, `dropClearance`). Still unmodeled: the actual tooth and pallet FACE shapes, club-vs-ratchet tooth type, and convex/concave lifting planes — SRC-0036 covers these too, but they are out of scope for this pass (pallet type and width are now ASM-0037)",
    scope: "Escapement geometry",
    status: "Active",
  },
  "ASM-0037": {
    summary:
      "Pallet geometry gains `PalletGeometry.kind` (EQUIDISTANT | CIRCULAR, SRC-0036 \"Equidistant vs. Circular\") and a declared wheel-side pallet width (`widthAngle`). Only EQUIDISTANT is implemented — it is what this codebase's existing tangential-locking construction (`tangentialCentreDistance`/`lockingPoints`) already builds, per Playtner's own identification of \"the tangential escapement\" with the equidistant pallet; CIRCULAR is a visible but disabled choice (no closed-form locking-point offset has been derived from SRC-0036 yet — Playtner states only that it depends on pallet width, not a formula). The escape tooth's own width is derived, not declared, as the remainder of the per-beat wheel-angle budget after the pallet's width and drop (`toothWidthAngle` = budget − widthAngle − dropAngle, SRC-0036's own 15-tooth worked numbers: 12° = 4½° tooth + 6° pallet + 1½° drop); pallet width must be positive and the derived tooth width must be positive (ESC-106)",
    scope: "Escapement geometry",
    status: "Active",
  },
  "ASM-0038": {
    summary:
      "EscapeWheel.toothKind (CLUB | RATCHET): CLUB has its own impulse face, so the derived tooth width must stay positive; RATCHET puts the entire lift on the pallet, so the tooth is a bare point and tooth width may be exactly zero. The drop advisory also becomes type-specific (1.5 degrees club / 2 degrees ratchet, Playtner)",
    scope: "Escapement geometry",
    status: "Active",
  },
  "ASM-0039": {
    summary:
      "PalletGeometry.drawAngle is the pallet locking face's inclination from the radial line through the locking point (Playtner); the escape tooth's own locking face is derived (toothDrawAngle = 2 x draw, conventional, for point contact), checked against a cited practical 20-28 degree range (ESC-108). Engaging/disengaging asymmetry and the locked-vs-unlocked correction are unmodeled",
    scope: "Escapement geometry",
    status: "Active",
  },
  "ASM-0040": {
    summary:
      "The escape wheel's teeth and pallet stones are drawn as real 2D outlines using the model's own derived angles (toothWidthAngle, toothDrawAngle, draw), not fixed cosmetic ratios, via generateEscapeWheelOutline/generatePalletStoneOutline. Still visual only: straight-edged, no true face curvature or contact geometry, falls back to the earlier cosmetic shapes without pallet geometry",
    scope: "Escapement geometry / viewport",
    status: "Active",
  },
  "ASM-0041": {
    summary:
      "Balance.impulseRadius (balance staff to ruby pin face), entered directly like inertia/hairspringStiffness. The fork's real acting length is derived from it (forkActingLength = impulseRadius x forkRatio, Playtner's inverse-ratio law), turning forkRatio from an abstract number into real geometry. Only one piece of four fork-and-roller chapters; ruby pin, rollers, guard point, crescent and horn remain unmodeled",
    scope: "Escapement geometry",
    status: "Active",
  },
  "ASM-0042": {
    summary:
      "PalletGeometry.rubyPinEntryFreedom and rubyPinSlotShake (optional, entered directly). Entry freedom must be strictly less than the total lock (lock + run) -- a hard necessity, not just cited -- so a premature strike leaves the pallets still locked. Slot shake is a simple positive check. The ruby pin's suggested width is derived as half the fork's angular motion (Playtner's own cited choice, not a strict formula)",
    scope: "Escapement geometry",
    status: "Active",
  },
  "ASM-0043": {
    summary:
      "Balance.rollerKind (SINGLE | DOUBLE, required) and PalletGeometry.guardPointFreedom/guardPointRadius (optional). Guard-point freedom must be strictly less than the total lock, same hard necessity as ruby-pin entry freedom. Radius and freedom together derive a linear clearance (guardPointClearance). SINGLE with a fork ratio below Playtner's cited floor (3 to 1) is an advisory; not checked for DOUBLE, which decouples impulse and safety roller sizing",
    scope: "Escapement geometry",
    status: "Active",
  },
  "ASM-0044": {
    summary:
      "Balance.rollerRadius (optional) and crescentHalfAngle/ringCrossingAngle/rubyPinAngleAtBalance (ESC-112): the author's own closed-form reconstruction of SRC-0036's verbal single-roller crescent-opening construction, using the actual placed pallet-to-balance distance (same source as ESC-103), the fork acting length and impulse radius (law of cosines, the ruby-pin reference direction) and the guard-point freedom (law of sines, a ray from the pallet centre crossing the roller). No worked numeric example exists to verify the combined result against, so rollerRadius defaults to unknown everywhere (including the teaching movement, whose own placed distance does not admit its own fork acting length/impulse radius as a consistent triangle); an inconsistent triangle is reported as a warning, not a wrong number. Single roller only — the double roller's own dart construction uses a different empirical allowance, unmodeled",
    scope: "Escapement geometry",
    status: "Active",
  },
  "ASM-0045": {
    summary:
      "PalletGeometry.hornFreedom (optional) and hornClearance (ESC-113): unlike the crescent, the horn's end lies on the same pallet-centred arc as the ruby pin (the fork acting length), so no new radius or cross-centre geometry is needed -- hornClearance reuses the same arc-length formula as dropClearance/guardPointClearance. Must be strictly less than the total lock, same hard necessity as rubyPinEntryFreedom/guardPointFreedom. Cited as 1/4 to 1/2 degree more than the guard-point freedom, checked as a non-blocking advisory. The horn's own physical length/shape is a visual construction, left to Phase 7.1.5.6",
    scope: "Escapement geometry",
    status: "Active",
  },
  "ASM-0046": {
    summary:
      "Balance.temperatureCoefficient (optional, s/day per degree C, from a conventional 20C 'middle temperature' reference), the same first-order local-linearization pattern as isochronismCoefficient (ASM-0034). SRC-0040 (Gould 1934, NIST/Bureau of Standards) treats a compensated balance's temperature-rate curve as approximately straight near the working range, with the slope indicating the degree of temperature compensation; cites 20C as the middle-temperature reference and 5C-35C as the usual temperature range. No universal value exists -- compensated (cut bimetallic rim + steel) and monometallic (elinvar) assemblies differ by an order of magnitude in this coefficient, so it must be measured or sourced per movement, never invented. Null by default, including in the teaching movement, since no source gives its own measured value. Positional error (REF-ENG section 10) remains entirely unmodeled: no single scalar coefficient captures a watch's rate spread across its axes of orientation",
    scope: "Balance (simplified dynamic, L3)",
    status: "Active",
  },
  "ASM-0047": {
    summary:
      "MoonPhase.windowCount (SINGLE | DOUBLE, ASM-0043-style structural enum, no new kinematics): the disc is driven by an ordinary continuous gear-train reduction on its own declared arbor and its phase is read directly from that arbor's solved angle, the same cyclical-reading pattern as readHand -- this project tracks no absolute calendar date, so this is not a claim to show the real moon phase on any particular real date. DOUBLE (two moon images 180 degrees apart, so a half-turn is one lunation) is the conventional modern layout (SRC-0045); SINGLE (one full turn per lunation) is offered as a structural option but not itself sourced as common. The implied lunation period (from the arbor's own angular velocity) is reported against the real synodic month, 29.53059 days (SRC-0046, NASA/GSFC) -- a comparison only, never fed back into the model. No jumper/cam mechanism: unlike the date/month complications also scoped in Phase 8, a real moonphase disc can be, and here is, driven by continuous rotation alone (SRC-0045, a granted patent, confirms this directly: 'driven to continuously rotate around the axle').",
    scope: "MoonPhase disc (Phase 8.1, kinematic, L2)",
    status: "Active",
  },
  "ASM-0048": {
    summary:
      "DateComplication (Phase 8.2): a simple instantaneous date star wheel that is NOT a continuous gear-train member -- it advances by exactly one step (2 pi / starToothCount) once per full revolution of a separate, ordinary, continuously-driven drive arbor (e.g. a 24-hour wheel geared 2:1 from the hour wheel), detected as a forward-only crossing of the drive shaft's own angle reference (crossesRevolution). SRC-0042 (a granted patent): 'the driving wheel 3 makes one turn in twenty-four hours' via that 2:1 ratio, drives 'a calendar mobile 1... bearing the numerals 0 to 31... with an inner toothing 1a of thirty-one teeth' forward 'one step' per drive revolution, with 'a concave portion... preventing the latter from moving by more than one step.' No jumper-spring energy storage, finger/cam contact geometry, or quick-correction mechanism is modeled -- only this net kinematic effect. Reversing the drive shaft (e.g. setting the hands backward through the trigger point) does not un-advance the star: real jump mechanisms are one-way (ratchet/jumper-spring action), so only forward crossings fire the jump -- a structural assumption about how any real star-and-jumper mechanism behaves, not itself drawn from a specific quote. starToothCount accepts any positive integer structurally (the same kinematics would describe a day-of-week star), though this project's Phase 8 scope is the date specifically (31, SRC-0042's own worked number, used in the teaching movement).",
    scope: "DateComplication (Phase 8.2, kinematic, L2)",
    status: "Active",
  },
  "ASM-0049": {
    summary:
      "MonthComplication (Phase 8.3): a month star, also NOT a continuous gear-train member, driven entirely by its referenced DateComplication's own jumps rather than a continuous arbor of its own. SRC-0043 (ETA SA, a granted patent): the date disc 'includ[es] a second toothing (24), a correction drive wheel set (42) able to cooperate with [it] to drive the date disc through an additional step at the end of the months of less than thirty one days, and a month star wheel (54) arranged to be actuated at the end of each month.' Modeled as the net kinematic effect (monthEndCorrection, src/kinematics/monthComplication.ts): on an ordinary day the date star advances one step as in ASM-0048; on the last day of the current month it advances by however many extra steps land it exactly on day 1, and the month star advances one step in the same event -- this reduces to an ordinary single date step after a 31-day month, so no separate case is needed there. Twelve months and non-leap-year Gregorian month lengths (February fixed at 28 days) are structural facts about the calendar this project assumes, named as constants (MONTHS_PER_YEAR, GREGORIAN_MONTH_LENGTHS), not declared or invented per movement. A LeapYearComplication, where present (Phase 8.4, ASM-0050), tracks the 4-year cycle as an indicator wheel only and is not wired back into this correction schedule: real annual-calendar watches in this same sense (ETA's own mechanism included) still need one manual correction a year after February, which this item does not close.",
    scope: "MonthComplication (Phase 8.3, kinematic, L2)",
    status: "Active",
  },
  "ASM-0050": {
    summary:
      "LeapYearComplication (Phase 8.4): a 4-slot Geneva (Maltese-cross) wheel indicator, also NOT a continuous gear-train member, driven entirely by its referenced MonthComplication's own December-to-January wrap -- one trigger per calendar year by construction, regardless of the days in any given month. SRC-0044 (Omega SA, a granted patent): the real four-year-cycle indicator is 'controlled directly or indirectly by a rotatable assembly journalled on the month star such assembly including a year cam and a Maltese cross enabling it to effect one revolution every four years' -- i.e. a cam-plus-Geneva hybrid, not a pure single-pin Geneva alone; this project models only the Geneva-drive component (a stated simplification of SRC-0044's own mechanism, not a literal reproduction of it -- the year cam, which would carry the actual leap-year logic such as century exceptions, is not modeled). Modeled as the net kinematic effect, the same jump-chaining pattern as ASM-0049: on the year-wrap trigger, the wheel advances by exactly one Geneva index step (2 pi / 4 = 90 degrees, LEAP_YEAR_SLOT_COUNT, src/domain/leapYearComplication.ts) -- not the real mechanism's own continuous, non-uniform pin/slot contact motion. That continuous motion genuinely does have closed-form kinematics (SRC-0047, a peer-reviewed mechanism-design paper, independently re-derived and cross-checked against two further sources): the driven wheel's angle during the indexing stroke is beta(alpha) = arctan(lambda sin(alpha) / (1 - lambda cos(alpha))), its angular velocity is a direct function of the driver's own alpha and alpha-dot (src/kinematics/genevaDrive.ts's genevaWheelAngularVelocity), and the no-shock (impact-free) pin-entry condition fixes the pin-radius/centre-distance ratio at lambda = sin(pi/n) (for n=4, lambda = sin(45) = 0.7071). These functions ARE wired into the live simulation's time integration (Phase 8.9, src/simulation/simulationState.ts's SimulationState.genevaStrokes): on the year-wrap trigger, rather than jumping the wheel's own shaftAngle straight to its post-index value, stepSimulation starts a stroke and plays out the real beta(alpha) shape across subsequent steps, so `simulation.shaftAngle` genuinely sweeps through the non-uniform stroke rather than only ever taking the discrete net step. Only the stroke's own TIMING is still a declared value, not a real one -- see ASM-0052. Four slots (one normal/normal/normal/leap cycle) is a structural fact about a four-year cycle, not a declared per-movement field, same treatment as MONTHS_PER_YEAR (ASM-0049). Century-exception leap-year rules (e.g. 1900 not a leap year, 2000 is) are out of scope: this mechanism, like SRC-0044's own real one, repeats a fixed four-year cycle and needs the same periodic manual correction a real mechanical perpetual calendar does.",
    scope: "LeapYearComplication (Phase 8.4, kinematic, L2)",
    status: "Active",
  },
  "ASM-0051": {
    summary:
      "DialWindow (Phase 8.6, now actually done): a cutout in a Dial, through which a disc complication (MoonPhase, DateComplication, MonthComplication or LeapYearComplication) becomes visible from the dial side -- the display concept Phase 8.6 scoped (\"dial windows or sub-dials\") but, despite STATUS.md's earlier claim that it was 'folded into 8.1-8.4', was never actually built; this item corrects that overstatement by building it. Without a window, every disc complication sits behind the dial's own opaque disc (closer to the mainplate, at a less negative z than the dial's own faceHeight, ASM-0014) and is fully occluded, so the only way to read a complication's current value was the inspector's text-only 'Current position' row. A window's own outline is either a circle (radius) or an axis-aligned rectangle (width, height) -- two shapes only, not a real window's actual bevelled aperture: a deliberate simplification, the same 'visual only, not a manufacturing claim' treatment this project already gives other cosmetic geometry (tooth proportions, ASM-0005; dial hour markers, ASM-0020). The teaching movement uses a circle for its date and moonphase windows (the usual shape for a simple aperture) and a rectangle for month and leap-year (sized for a short label like \"Jan\" or \"Year 4\", which a fixed-radius circle cannot show without either clipping the text or revealing its neighbours). A window's centre is declared in the same movement-plan (x, y) coordinates as every other plan-positioned entity, not relative to the dial's own centre. DIALWIN-001/002 (src/validation/rules/dialWindowRules.ts) check that a window actually overlaps its referenced complication's own disc -- geometrically, in plan, via circle-circle distance for a circular window or circle-to-axis-aligned-rectangle distance (distanceToRectangle in src/math/vec2.ts) for a rectangular one -- since a non-overlapping window shows nothing through it, a real design error this project can and does catch, unlike a kinematic error. For date/month/leap-year complications (not moonphase, which stays a plain disc), the disc's own dial-facing face additionally carries its position labels (1-31, month abbreviations Jan-Dec, or year 1-4) painted around its rim as a texture -- generated once from the domain model's own declared tooth/position count, not re-synchronised per frame: the labels are baked onto the rotating disc exactly once, and the existing kinematic rotation (already correct since Phase 8.1-8.4) carries the right label past the window on its own, the same way a real printed date ring works.",
    scope: "DialWindow (Phase 8.6, visual/L0 display only)",
    status: "Active",
  },
  "ASM-0052": {
    summary:
      "Leap-year Geneva-drive visual/mechanical linkage (Phase 8.9): the leap-year wheel's own real indexing-stroke SHAPE is simulated (genevaWheelAngle, ASM-0050), but no continuously-rotating driver exists anywhere in this project's simplified jump-chain model (ASM-0048/0049/0050 have no arbor that spins once a year) to derive a real stroke DURATION from -- LEAP_YEAR_INDEX_STROKE_SECONDS (src/domain/leapYearComplication.ts, declared 0.4 s) is therefore a declared playback timing, illustrative only, the same 'declared, not measured' treatment already given other visual timing/sizing constants (e.g. DIAL_WINDOW_VISUALIZATION, ASM-0051). The wheel itself is now drawn with real radial slots (createGenevaWheelGeometry, src/geometry/assemblyGeometry3d.ts) instead of a plain disc, and a driver-pin assembly (a small carrier disc and pin) is rendered at the month star's own position and swept through the same stroke each trigger, parking at its entry-ready position (alpha = -driverMotionAngle/2) between strokes -- a declared illustrative choice, since no real continuously-rotating driver's own dwell position exists here to show instead. Slot width/depth and the pin/carrier sizes are declared visual dimensions (GENEVA_WHEEL_VISUALIZATION), not a sourced manufacturing clearance, the same 'visual only' treatment already given escape teeth and pallet stones (ASM-0004, ASM-0039, ASM-0040); the locking-disc crescent recess itself is not drawn, only reported numerically (YEAR-002). The wheel's own local slot phase and the driver pin's orbit radius are both DERIVED from already-declared positions (the wheel's and month star's own solved coordinates, and lambda = sin(pi/n) x their centre distance), not invented: see createGenevaWheelGeometry's own doc comment for why one alignment condition at shaftAngle 0 holds at every dwell position, by construction.",
    scope: "LeapYearComplication's own visual/mechanical linkage (Phase 8.9, visual/L0 display plus a declared simulation-timing choice)",
    status: "Active",
  },
  "ASM-0053": {
    summary:
      "Date visual/mechanical linkage (Phase 8.9): a small cam disc fixed to the drive shaft's own axis (turns for free with the shaft's own already-simulated continuous rotation -- no new timing or tracking needed, unlike the leap-year wheel, ASM-0052) and a jumper rod from a fixed pivot to a point on the date star's own rim. SRC-0042 (the sourced real mechanism) describes a cam-and-roller trigger that winds an instantaneous-jump spring, released when the roller passes the cam's tip, held between jumps by a spring-loaded jumper -- but gives no numeric cam profile and no spring-stiffness/moment-of-inertia data, so unlike the leap-year Geneva drive (which has a real, sourced, closed-form stroke shape, SRC-0047) there is no real motion curve here to simulate. The cam is therefore drawn as a plain disc, not SRC-0042's own undisclosed profile, and the jumper as a rigid lever, not a real flexible spring blade -- both visual only (ASM-0004), the same 'visual only, no true contact geometry' treatment already given the escapement's own symbolic pallet arms (ASM-0039, ASM-0040). What IS real: the jumper's own nose position is read directly from the star's own already-simulated shaftAngle every frame (src/viewport/viewport.ts's dateJumperLinkages), not an invented animation, so the rod visibly swings in exact sync with the star -- it just snaps together with the star's own still-instantaneous jump (ASM-0048 is unchanged: no sourced release-velocity profile exists to ease that jump the way the Geneva drive's real stroke could), which is a true depiction of the real mechanism's own character (a real date's midnight jump is also effectively instantaneous to the eye) rather than a shortcut. Cam radius, nose radius and pivot distance are declared fractions of already-declared positions/dimensions (the drive-shaft/star centre distance, the star's own tip radius) -- DERIVED scale, not an invented absolute size (DATE_LINKAGE_VISUALIZATION, src/geometry/assemblyGeometry3d.ts). No new domain fields, no schema change: everything needed already existed on DateComplication.",
    scope: "DateComplication's own visual/mechanical linkage (Phase 8.9, visual/L0 display only)",
    status: "Active",
  },
} as const satisfies Record<string, Omit<Assumption, "id">>;

export type AssumptionId = keyof typeof ASSUMPTIONS;

export function listAssumptions(): Assumption[] {
  return (Object.keys(ASSUMPTIONS) as AssumptionId[]).map((id) => ({ id, ...ASSUMPTIONS[id] }));
}
