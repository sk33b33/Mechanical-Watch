/**
 * Mirror of reference/assumptions/ASSUMPTION_REGISTER.md (kept in sync by registers.test.ts).
 *
 * Declared user context: Southern Hemisphere. The user has stated they are in the Southern
 * Hemisphere -- the standing default for any hemisphere-dependent choice in this project
 * (currently ASM-0057's season labels), not something to ask about again per feature.
 */
export type AssumptionStatus = "Active" | "Pending" | "Planned" | "Permanent" | "Superseded";

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
      "The dial is a flat disc of uniform thickness; feet, holes and printing are not modeled, and the hour markers drawn on it are visual: round dots (Phase 8.15 follow-up 18, replacing bars) -- big circles at 12, 3, 6 and 9 o'clock and half-size circles at the other eight positions -- sized as fractions of the dial radius (DIAL_VISUALIZATION); the seconds-scale numerals 60 (north), 15 (east), 30 (south) and 45 (west) are printed around the seconds hand's own pivot, just inside its tip (follow-up 19), as decoration for that hand and not a calibrated scale",
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
  "ASM-0054": {
    summary:
      "Month visual/mechanical linkage (Phase 8.9): a small declutch wheel drawn in its own idle (disengaged) position, just clear of the month star's own rim, offset toward the date star that drives it. Unlike DateComplication (which has a continuously-driven arbor to hang a cam on, ASM-0053) or LeapYearComplication (whose real Geneva-drive motion has a sourced closed-form shape, ASM-0050), MonthComplication has no continuous arbor at all -- it only ever advances in the same instant the date star's own jump lands on day 1 (stepSimulation's monthCorrection, src/simulation/simulationState.ts) -- and SRC-0043 (the sourced real mechanism) describes its own drive member only as a 'declutching drive wheel set' that engages the month star's teeth at month-end and is otherwise 'occupying a first position in which it has no effect,' with no numeric engagement geometry or timing given. With no continuous member to animate and no sourced motion to play, this wheel is drawn once, in its idle position, and never animated -- the same 'park at rest rather than invent motion with no basis' treatment the leap-year driver pin already gets between its own real strokes (ASM-0052). Wheel radius and position are both DERIVED from the date/month stars' own already-declared positions and the month star's own tip diameter (MONTH_LINKAGE_VISUALIZATION, src/geometry/assemblyGeometry3d.ts) -- a declared visible clearance gap (not a sourced manufacturing figure) keeps it visibly clear of the month star's rim, the same 'visual only' treatment already given escape teeth and pallet stones (ASM-0004, ASM-0039, ASM-0040). No new domain fields, no new ShaftId, no new simulation state, no schema change: everything needed already existed on MonthComplication and DateComplication.",
    scope: "MonthComplication's own visual/mechanical linkage (Phase 8.9, visual/L0 display only)",
    status: "Active",
  },
  "ASM-0055": {
    summary:
      "Moon-phase disc illustration (Phase 8.9 follow-up): a dark sky, one or two pale moon images (windowsPerRevolution -- SINGLE or DOUBLE) and decorative stars, painted onto the MoonPhase disc's own dial-facing face. MoonPhase was built (Phase 8.1, ASM-0047) with 'moon/star artwork is not modeled' as a deliberate scope cut, leaving nothing for the dial window (built later, Phase 8.6) to actually reveal, even though the phase fraction itself (moonPhaseFraction) was already correct and tested. SRC-0045 (a granted patent, Fig. 4) confirms the real, conventional design this draws: two moon images 180 degrees apart on a DOUBLE disc. The phase reveal itself needs no new simulation code: the dial window is already a fixed aperture offset from the disc's own rotation axis, and the disc already rotates correctly, so painting a moon image at the right position and letting ordinary 3D occlusion do the rest reproduces the same optical trick the real mechanism's own window uses -- two circles (the fixed window, the moving moon image) sliding past each other trace new moon -> crescent -> full -> crescent -> new moon as their overlap changes, exactly matching moonPhaseFraction's own 0<->0.5<->0 cycle. moonImageLocalAngle (src/geometry/assemblyGeometry3d.ts) derives exactly where each moon image must sit for that overlap to land correctly, from moonPhaseFraction's own convention; getting a CLEAN reveal (full overlap at the real full-moon instant, zero overlap at the real new-moon instant) required retuning the teaching movement's own dial-window radius/offset to geometrically fit the derived moon-image size/position (the window and moon-image radii must sum to less than the offset times sqrt(2) for a genuinely dark new-moon instant) -- a real design fix, the same kind of geometry tuning the date linkage's own pivotDistanceFraction needed. Sky/moon/star colours and the star positions themselves are declared visual-only choices (ASM-0004), not a real star chart or a sourced colour reference. No new domain fields, no new simulation state, no schema change: everything needed already existed on MoonPhase and DialWindow.",
    scope: "MoonPhase's own dial-facing illustration (Phase 8.9 follow-up, visual/L0 display only)",
    status: "Active",
  },
  "ASM-0056": {
    summary:
      "Screw (Phase 8.10): a plain circular through-hole of declared diameter, at a declared plan position, punched through one chosen Frame (a Mainplate or Bridge). CLAUDE.md's own 'Core component model' listed Screw as a planned entity from the start, but it was never built -- frames were plain solid extruded slabs with no bearing or screw holes at all. Alongside Screw, bearing clearance holes are now also punched into a frame wherever a seated Jewel's own boreDiameter is declared (non-null) and its shaft's axis is resolved (frameBearingHoles, src/assembly/assemblyGeometry.ts) -- a jewel with an unknown bore is skipped, never given an invented hole size, the same 'declared, never defaulted' treatment boreDiameter already had. A screw's hole, likewise, is exactly its declared diameter: no thread, head, countersink/counterbore, or clamping-torque/thread-engagement data is modeled, and the second frame or bridge foot a real screw also clamps is not represented either -- only the hole itself, in the one frame it is declared against. Same 'visual only, no manufacturing claim' treatment this project already gives other cosmetic/declared geometry (ASM-0004, ASM-0051). createFrameGeometry (src/geometry/assemblyGeometry3d.ts) now takes an optional holes: FrameHole[] list, punched via THREE.Path.absarc directly in the same movement-plan (x, y) coordinates the frame's own outline already uses -- no local-frame translation needed. Frame outlines themselves remain 100% manually drawn: no auto-fit/auto-resize of a plate to the parts placed on it was added here, since silently resizing a user's declared outline would conflict with this project's own 'never silently alter user dimensions' principle; that remains a distinct, not-yet-built feature.",
    scope: "Screw entity + bearing/screw hole geometry on existing frames (Phase 8.10, visual/L0 display plus L1_GEOMETRIC placement checks)",
    status: "Active",
  },
  "ASM-0057": {
    summary:
      "SeasonComplication (Phase 8.11): a quarter indicator, driven entirely by its referenced MonthComplication's own jump into January, April, July or October -- one trigger every three months by construction, architecturally the closest analog to LeapYearComplication (also a jump-driven wheel on another complication's own periodic trigger). Raised directly by the user ('use the month gear to add a season gear that rotates after every 3 months'), and explicitly NOT the 'season' item docs/ROADMAP.md 8.5 already scoped out: that item is a genuine equation-of-time/analemma complication (a bean-shaped cam encoding real orbital-mechanics data) this project still has no source for and still does not model. Two real engineering choices were asked of the user directly rather than invented: (1) labeling -- named seasons (Spring/Summer/Autumn/Winter) are hemisphere-dependent (Northern and Southern Hemisphere conventions assign opposite seasons to the same quarter), so this project initially used neutral 'Quarter 1-4' labels rather than declare a hemisphere; the user then stated directly they are in the Southern Hemisphere and asked for that to be the standing convention here (see this file's own preamble), giving SEASON_LABELS = Summer/Autumn/Winter/Spring for Q1-Q4, the Southern Hemisphere's own astronomical quarters (Q1 = Jan-Mar, mostly within the Dec 21-Mar 20 summer quarter, and so on) -- a declared choice, not an invented default (the Northern Hemisphere reading of the same quarters is Winter/Spring/Summer/Autumn); (2) phase alignment -- the user chose the Gregorian calendar-quarter boundary (Jan/Apr/Jul/Oct) over the alternative (Mar/Jun/Sep/Dec) offered. Unlike LeapYearComplication, no sourced real mechanism (patent or manufacturer description) exists for a quarter-indicator built this way, so the jump stays instantaneous rather than claiming a real Geneva-drive stroke shape to simulate -- the same 'no sourced motion, stays instantaneous' treatment DateComplication/MonthComplication already have (ASM-0048/0049), not a declared upgrade. Rendered as a plain disc (createZCylinder, reusing the month star's own rendering pattern), not a Geneva-slotted wheel like the leap-year wheel, for the same reason. wheelShaftId is a separate, declared (FIXED-position) arbor, NOT meshed with anything, same pattern as the other three jump-driven complications.",
    scope: "SeasonComplication (Phase 8.11, visual/L0 display plus L2_KINEMATIC jump-chain simulation)",
    status: "Active",
  },
  "ASM-0058": {
    summary:
      "Season wheel quadrant art (Phase 8.11 follow-up): the disc is divided into four equal wedges (seasonWedgeBoundaryAngles, src/geometry/assemblyGeometry3d.ts), each tinted and carrying a simple seasonal icon (sun/leaf/snowflake/flower) plus its own position label, requested directly by the user ('cut the gear into 4 equal pieces and add some art representing each season in their respective quarter'). Purely decorative (ASM-0004): the icons are generic symbolic glyphs, not sourced from any real watch's own dial art -- no four-seasons indicator with this specific iconography has been found, the same 'declared, not invented' visual treatment the moon-phase illustration (ASM-0055) and disc label ring (ASM-0051) already have. Index-matched to SEASON_LABELS's own fixed Q1-Q4 order (Summer/Autumn/Winter/Spring, ASM-0057), so this is specific to the season wheel, not a generic N-wedge drawer -- the same way createMoonPhaseTexture is specific to moon phase. Wedge boundaries sit at the half-slot-offset between adjacent labels (same convention the Geneva wheel's own rim slots already use relative to its labels). The -Z cap's own material colour is white rather than the wheel's own base colour, so the wedge tints read true instead of being darkened by it (the same reasoning the plain disc label ring's near-white background already relies on, extended to coloured art). No new domain fields, no schema change: createSeasonTexture replaces the generic createDiscLabelTexture call only for this one disc (seasonMaterials, src/viewport/viewport.ts).",
    scope: "SeasonComplication wheel's own dial-facing art (Phase 8.11 follow-up, visual/L0 display only)",
    status: "Active",
  },
  "ASM-0059": {
    summary:
      "YearDigitComplication, a 'drum clock' year display (Phase 8.12): four decimal digit wheels -- ones, tens, hundreds, thousands -- each architecturally identical to LeapYearComplication/SeasonComplication (a declared FIXED-position arbor, not meshed with anything, advanced only by a jump), all four referencing the same MonthComplication and all four triggered by its December-to-January wrap -- the same event LeapYearComplication's own Geneva wheel already fires on. Raised directly by the user ('add a drum clock for the current year'). No sourced real mechanism (patent or manufacturer description) for a wristwatch 'year' complication built from decimal digit-roller wheels has been found, so -- like SeasonComplication -- this models only the net kinematic effect the user described, declared rather than invented, and the jump stays instantaneous. The genuinely new kinematics: decimal carry propagation (digitsToAdvance, src/kinematics/yearDigitComplication.ts) -- every wrap advances the ones wheel; a more significant place advances in the same event only if every place below it was sitting at 9, ordinary decimal carry worked out from first principles since no equivalent already existed here (every earlier jump-driven wheel only ever has one wheel to advance per trigger). There is no sourced way for a watch to know the real calendar year on its own, so -- matching how DateComplication always starts at day 1 and MonthComplication always starts at January -- each wheel's own startDigit (0-9) is independently declared, set once like a real digit wheel would be by hand, not derived from a single shared 'year' field (clarified directly with the user: declared, not synced to the browser's own clock). wheelShaftId is a separate, declared (FIXED-position) arbor, NOT meshed with anything, same pattern as the other four jump-driven complications. SUPERSEDED (Phase 8.15, ASM-0063): the user rejected this vertical-arbor architecture outright ('i dont want 4 gears with 4 windows... i want only 4 numbers showing... the numbers should turn horizontally when facing the dial') in favour of a horizontal-axis barrel; YearDigitComplication is no longer a wheel on a Shaft at all. Kept here only as a historical record of the decimal-carry kinematics' own first derivation, which ASM-0063 carries forward unchanged.",
    scope: "YearDigitComplication (Phase 8.12, visual/L0 display plus L2_KINEMATIC jump-chain simulation with decimal carry)",
    status: "Superseded",
  },
  "ASM-0060": {
    summary:
      "Year-digit wheel drum visualization (Phase 8.13): raised directly by the user as feedback on ASM-0059's own first shipped look ('i would like it to be a cylinder... every digit sits on a drum that rotates from 0 to 9'). The -Z (dial-facing) cap keeps the plain position-label ring every other jump-driven wheel already gets (ASM-0051) unchanged -- the dial window above it still reveals exactly that. The LATERAL surface now additionally carries the same ten digits painted around it once (createYearDigitDrumTexture, src/geometry/assemblyGeometry3d.ts), and the teaching movement's own thickness/diameter ratio for the four digit wheels moved from a thin disc (0.15mm : 2mm) to a drum/roller proportion (0.8mm : 2mm) -- a top-down window cannot usefully reveal a side-printed cylinder, so a direct 3D inspection is what now reads as a digit drum. wheelZCentre moved from -1.2mm to -0.7mm to stay clear of the mainplate (0mm) and the dial's own back (-1.4mm), safe only because the four digit wheels share no x/y footprint with any other complication at that z-range. No kinematic change at all -- shaftAngle, digitsToAdvance and every validation rule are untouched. SUPERSEDED (Phase 8.15, ASM-0064): the vertical drum's own lateral texture was geometrically invisible from the normal dial-side camera view (looking straight down the same axis the drum rotated about, so a lateral/side-wrapped digit always sat edge-on) -- a real defect the user's own feedback ('the problem you facing is that you using gears with numbers on it that turns clockwise') named directly. ASM-0064's horizontal-axis barrel fixes this structurally, not just re-tunes it.",
    scope: "YearDigitComplication wheel's own body shape and lateral-surface art (Phase 8.13, visual/L0 display only)",
    status: "Superseded",
  },
  "ASM-0061": {
    summary:
      "Year-digit wheel connection-to-movement visualization (Phase 8.13): raised directly by the user in the same request as ASM-0060 ('make sure to display the connection to the movement') -- before this, none of the four digit wheels had any visual link to anything. Mirrors MONTH_LINKAGE_VISUALIZATION's own treatment (ASM-0054) exactly: a small declutch wheel, drawn once in its own idle/disengaged position, never animated -- no continuous member to animate and no sourced motion to play. Only the ones-place wheel gets one drawn, pointed at the month star that triggers all four digit wheels' own shared jump event (ASM-0059); the tens/hundreds/thousands wheels get no link of their own to the ones wheel or to each other, since digitsToAdvance advances every qualifying wheel in the SAME simulated instant rather than one wheel's own rotation stepping the next -- a tooth-engagement link between them would imply real inter-wheel gearing this project does not model, which YEARDIGIT-001's own wheel-also-geared check explicitly forbids. Visual only, no kinematic change. SUPERSEDED (Phase 8.15, ASM-0065): the same linkage concept carries forward (a small declutch wheel pointed at the month star, drawn once, never animated), now anchored at the barrel's own axleOrigin instead of a wheel arbor's solved position.",
    scope: "YearDigitComplication's own visual link to the MonthComplication that drives it (Phase 8.13, visual/L0 display only)",
    status: "Superseded",
  },
  "ASM-0062": {
    summary:
      "Year-digit wheel group housing visualization (Phase 8.14): raised directly by the user, who supplied a photo of a real mechanical tally-counter ('remove the 4 gears for the year timer and create something like this... connected somehow to the movement'). The teaching movement's own layout moved from a 2x2 grid to a tight single row (2.3mm centre spacing), and a dark housing now encloses it: three plain walls (back plus two ends) and thin divider bars between adjacent wheels, every one derived from the wheel group's own already-solved positions and declared tip diameters (yearDigitHousingBounds, yearDigitDividerXPositions, src/geometry/assemblyGeometry3d.ts) -- no invented size. No front/top/bottom cover is drawn: a solid cylinder's own far side is already hidden from the viewer without one. A static (never animated) mounting bracket runs from the housing's back wall up to the mainplate's own underside, the explicit 'connected to the movement' the user asked for, alongside (not replacing) the ones-wheel's own kinematic link to the month star (ASM-0061). The drum's own digit colours were also inverted to pale numerals on a dark body, matching the reference photo. No kinematic change: visual only, same treatment as ASM-0053/ASM-0054/ASM-0061. SUPERSEDED (Phase 8.15, ASM-0066): the same enclosing-housing concept carries forward (plain walls plus dividers plus a mounting bracket, no invented size), now built from the horizontal barrel's own along-axle bounds instead of four separate wheels' solved x positions.",
    scope: "Year-digit wheel group's own enclosing housing, divider bars and mounting bracket (Phase 8.14, visual/L0 display only)",
    status: "Superseded",
  },
  "ASM-0063": {
    summary:
      "YearDigitComplication redesigned as a horizontal-axis 'page-flip' barrel (Phase 8.15), replacing the vertical-arbor 'drum clock' (ASM-0059, superseded). Raised directly by the user, who rejected the vertical-axis wheels outright: '4 gears with 4 windows' with digits that 'turns clockwise' was wrong; the design should be '1 large rectangular window with 1 large cylindrical barrel behind it that is separated into 4 parts that turns all separately 1 number at a time... the numbers should turn horizontally when facing the dial'. Asked directly which of two readings was meant (vertical axis with a horizontal window layout, vs a literal horizontal rotation axis), the user chose the literal horizontal barrel explicitly, aware it requires a declared exception to ASM-0006 (every Shaft axis vertical) -- the same kind of exception KeylessWorks's own stem already has (ASM-0019). YearDigitComplication is therefore NOT a Shaft at all, exactly like KeylessWorks: it declares its own axleOrigin (Vec2), axleDirection (Angle, world-plan direction of the horizontal rotation axis) and axleHeight (Length) directly, with no arbor, mesh or drive train of its own. barrelDiameter and segmentLength (the along-axle width of this one digit's own segment) replace wheelTipDiameter/wheelThickness. The decimal-carry kinematics (digitsToAdvance, src/kinematics/yearDigitComplication.ts) and the declared (not invented, not browser-synced) per-segment startDigit carry forward from ASM-0059 unchanged -- this assumption only changes WHERE the digit lives in space and HOW it rotates, not the carry logic or the trigger event (the month complication's own December-to-January wrap). There is still no sourced real wristwatch mechanism for a year display built this way.",
    scope: "YearDigitComplication (Phase 8.15, visual/L0 display plus L2_KINEMATIC jump-chain simulation with decimal carry, horizontal-axis architecture)",
    status: "Active",
  },
  "ASM-0064": {
    summary:
      "Barrel lateral-texture and horizontal-rotation math (Phase 8.15), replacing the vertical drum's own lateral texture (ASM-0060, superseded) because that texture was geometrically invisible from the normal dial-side camera view: the dial-side camera looks straight down the Z axis, the SAME axis the old drum rotated about, so a lateral/side-wrapped digit always sat edge-on to that view, a real defect the user named directly ('the problem you facing is that you using gears with numbers on it that turns clockwise'). The new horizontal-axis barrel fixes this structurally: with the rotation axis horizontal (createXAxisCylinder, src/geometry/assemblyGeometry3d.ts -- a CylinderGeometry rotated so its own axis runs along local X, the same construction KeylessWorks's own stem rod already uses), the local angle around that axis that faces the dial (atan2(z, y) = -pi/2, since the root group's own Z-axis rotation never tilts local Z away from world Z) is a geometric FACT, not a free per-texture design choice the way the old drum's own frontAngleRadians was. yearDigitBarrelRestAngle(digit, digitCount) gives the local angle a digit's own canvas position must sit at so that rotating the live spin group by digit*step brings it to that -pi/2 dial-facing angle; cylinderXAxisCanvasUForLocalAngle inverts CylinderGeometry's own pre-rotation vertex formula to place it there on the canvas. createYearDigitBarrelTexture replaces createYearDigitDrumTexture. No kinematic change: the digit/angle relationship (yearDigitAngle, starPosition) is unchanged from ASM-0059/ASM-0063 -- only the mesh's own local-frame geometry and the texture-placement math are new.",
    scope: "YearDigitComplication barrel segment's own body shape and lateral-surface art (Phase 8.15, visual/L0 display only)",
    status: "Active",
  },
  "ASM-0065": {
    summary:
      "Barrel connection-to-movement visualization (Phase 8.15), replacing the vertical drum's own linkage (ASM-0061, superseded). The same declutch-wheel concept carries forward unchanged in kind -- a small wheel, drawn once in its own idle/disengaged position, pointed at the month star that triggers the shared jump event, never animated (no continuous member to animate and no sourced motion to play, same reasoning as ASM-0054/ASM-0061) -- but is now anchored directly at the relevant digit segment's own declared axleOrigin instead of a wheel arbor's solved position, since there is no arbor to solve a position for any more (ASM-0063). Only the ones-place segment gets one drawn, the same single-link convention ASM-0061 established. No kinematic change.",
    scope: "YearDigitComplication's own visual link to the MonthComplication that drives it (Phase 8.15, visual/L0 display only)",
    status: "Active",
  },
  "ASM-0066": {
    summary:
      "Barrel group housing visualization (Phase 8.15), replacing the vertical drum group's own housing (ASM-0062, superseded). The same enclosing-housing concept carries forward unchanged in kind -- plain walls (back plus two ends) and thin divider bars between adjacent segments, plus a static (never animated) mounting bracket to the mainplate's own underside, every one a plain box with no invented size -- but is now derived from the horizontal barrel's own along-axle bounds (yearDigitBarrelAlongBounds, yearDigitBarrelDividerPositions, src/geometry/assemblyGeometry3d.ts) instead of four separate wheels' own solved x positions, since the four segments now share one continuous axle rather than sitting at four independent arbors. No front/top/bottom cover is drawn, same reasoning as ASM-0062 (a solid cylinder's own far side is already hidden from the viewer without one). No kinematic change: visual only.",
    scope: "YearDigitComplication barrel group's own enclosing housing, divider bars and mounting bracket (Phase 8.15, visual/L0 display only)",
    status: "Active",
  },
  "ASM-0067": {
    summary:
      "Disc label ring auto-fit font size (Phase 8.15 follow-up, refining ASM-0051): DIAL_WINDOW_VISUALIZATION.fontSizePx (105px) is shared by every disc complication's own position-label ring regardless of how many labels it has or how wide they are -- apparently tuned once against the lowest-density rings (leap-year/season, 4 positions, 1-2 characters) and never re-checked against a denser one. Reported live directly ('check the numbers for the date gear it looks clumped up together or it has the size bug. Check the month text gear for the same bug') and confirmed by measuring the real rendered canvas (ctx.measureText, the same standard the year-digit barrel's own font-size fix, ASM-0064, already used): date (31 numeric positions, up to 2 digits) needs 113.4px for its widest label ('24') in a 37.4px slot, roughly 3x overflow; month (12 three-letter abbreviations) needs 196.9px for its widest label ('May') in a 96.5px slot, roughly 2x overflow -- both genuinely overlapping. Leap-year/season measure only 57-144px against a 289.5px slot, confirming those two rings were never actually broken. Fixed by discLabelSlotArcLengthPx(labelCount) (the ring's own circumference divided by its label count, pure geometry) and discLabelFittedFontSizePx(maxLabelWidthAtBaseFontPx, labelCount) (src/geometry/assemblyGeometry3d.ts): scales the shared 105px base font down only as far as the real measured widest-glyph width demands to keep it within DIAL_WINDOW_VISUALIZATION.labelFillFraction (0.75) of its own slot, clamped at a declared floor (minFontSizePx, 16px, never reached by any real label set here) and never scaled UP past the 105px base. A low-density ring (leap-year/season) clamps at scale 1 (unchanged); createDiscLabelTexture measures the real widest label at the base font (the one place with a live canvas context) and redraws at the fitted size. No change to label placement, position count, rotation or any kinematic value -- font size only.",
    scope: "DialWindow-revealed disc complications' own printed position-label ring (date, month, leap-year, season, Phase 8.15 follow-up, visual/L0 display only)",
    status: "Active",
  },
  "ASM-0068": {
    summary:
      "Disc label ring north-alignment (Phase 8.15 follow-up): a date/month/season window consistently showed a label diametrically opposite the disc's own currently-indicated position -- month's window read 'Jul' while MonthComplication's own starPosition-derived 'Current position' was 'January' (6 of 12, a half turn); the season pointer read 'WI' against a true 'SU' (2 of 4, again a half turn). Derived from discCapCanvasAngleForMeshAngle's verified reflection (canvas angle theta lands at mesh angle -pi/2 - theta) and windowAbove's '+Y = north = current' convention: label i, drawn at discLabelPlacements' default canvas angle (i/n)*2pi, lands at world angle (-pi/2 - (i/n)*2pi) + i*(2pi/n) = -pi/2 once its own shaftAngle = i*step is applied -- exactly pi short of the window's +pi/2, independent of i and n (the i terms cancel). Fixed with the declared constant DISC_LABEL_CURRENT_AT_NORTH_OFFSET_RADIANS = -pi, passed explicitly by date, month and season (discMaterials' 4th argument; createSeasonTexture gained the same canvasAngleOffset parameter), not a changed default on the shared geometry function. Leap-year's own offset is independently derived to dodge its Geneva slot cutouts (an unrelated constraint) and was left untouched and unverified against this question. Verified live: month reads 'Jan' and season 'SU' against their own reported positions. No kinematic change.",
    scope: "Date/month/season disc label ring's own phase against the dial window's north reading position (Phase 8.15 follow-up, visual/L0 display only)",
    status: "Active",
  },
  "ASM-0069": {
    summary:
      "DialWindow.pointer (Phase 8.15 follow-up): an optional fixed reading-position index mark on the dial, currently 'NORTH' only -- an upside-down (apex-down) triangle just outside the window's own north edge, naming which position reads as 'current'. Raised directly by the user alongside enlarging the season window to the whole wheel ('place an upside down triangle in the north position on the dial where the window is for the seasons'): a window big enough to show the full four-wedge artwork (ASM-0058) no longer answers 'which wedge is current' by its own small size the way a catch-one-label window does, so the same 'north = current' convention windowAbove already uses is made visible. Purely visual (ASM-0004), sized as fractions of the dial's own radius (DIAL_WINDOW_POINTER_VISUALIZATION), the same derivation convention as the hour markers (ASM-0020). Domain schema change: DialWindow.pointer (null by default), persistence schema v27 to v28 backfills null on every existing window. The teaching movement uses it on the season window, and (Phase 8.15 follow-ups 7 and 9) the leap-year and month windows. No kinematic change.",
    scope: "DialWindow.pointer index mark (Phase 8.15 follow-up, visual/L0 display only)",
    status: "Active",
  },
  "ASM-0070": {
    summary:
      "'Set to browser time' also sets the calendar (Phase 8.15 follow-up 10). Reported live: after pressing it the month read January and the date the 1st instead of October 20th, because the button only fast-forwarded the going train to the browser's time of day while every calendar wheel kept its own arbitrary starting position (day 1, January, position 0) and the jump mechanism (ASM-0048) only advances them from there. It now ALSO positions, directly and once, the date star (day-1), month star (month index), leap-year wheel ((year+3) mod 4, so a year divisible by 4 sits on the declared 'Year 4 (leap)' position and the 4-position wheel cannot express the 1900/2100 century exceptions), season wheel (floor(month/3), following ASM-0057's quarter convention and its declared Southern Hemisphere labels, so January-March reads Summer) and each declared year-digit segment (its own decimal digit of the year). This is a declared 'set by hand' action like year-digit startDigit, not a claim that a real watch could do it unaided. The clock fast-forward now targets the full 24-hour time of day instead of the 12-hour dial reading, because the 24-hour arbor that drives the date jump turns once per 24 h and landing on 2:37 instead of 14:37 would put the next date change 12 h out of step. Simulation state only; the design (movement) is unchanged. Moon phase is not touched.",
    scope: "AppStore.setToBrowserTime / withCalendarDate (src/simulation/calendarState.ts), simulation state L2",
    status: "Active",
  },
  "ASM-0071": {
    summary:
      "Disc label ring direction (Phase 8.15 follow-up 10): after 'Set to browser time' first put the calendar wheels on non-zero positions, the month window's own north label read April while the domain said October (likewise leap-year '4' against 'Year 2', season 'AU' against Spring) -- always label -i for true position i. The earlier ASM-0068 half-turn alignment had only ever been checked at position 0, where i = -i, and its derivation (that the per-label terms cancel) was wrong in sign. Measured on the real render: the canvas angle at the window's north decreases by one slot per position, so label k is now laid out at canvas angle -(k/n)*2*pi + offset (DISC_LABEL_RING_DIRECTION = -1) for every label ring (date, month, leap-year, season wedges, icons and labels). Consequence: labels run counter-clockwise as seen from the dial side, so the next label arrives at the window each time the disc advances. Visual placement only (ASM-0004); no kinematic or domain change. Verified live at October 20 2026 and December 31 2028 against each window's own 'Currently shows' reading.",
    scope: "Disc label ring layout (visual/L0 display only)",
    status: "Active",
  },
  "ASM-0072": {
    summary:
      "Moon-phase marks (Phase 8.15 follow-up 14): DialWindow.phaseMarks, an optional ring of fixed lunar-phase icons printed on the dial around a CIRCULAR moon-phase window -- an unlit ring for new moon, a filled disc for full, and a ring with its lit half filled for each quarter -- raised by the user after the moon window was enlarged to show the whole disc ('add phase marks to the moon window'), because a whole-disc window shows where the moons are but not what phase that position means. Placement is derived, not chosen: moonPhaseFraction runs 0 to 1 as a moon image advances one image-spacing (2*pi / n) and moonImageLocalAngle puts an image under the window's fixed north at fraction 0.5, so at fraction f an image sits at north + (2*pi / n)(f - 0.5), repeated every 2*pi / n -- for the two-image disc full at north and south, new at east and west, quarters on the diagonals. At north the existing pointer (ASM-0069) already marks full moon, so no icon is drawn there when a north pointer is set. Quarter icons are lit on the left (first quarter, waxing) and right (last quarter) as seen from the dial side: the declared Southern Hemisphere convention, the reverse of the Northern Hemisphere one. Visual only (ASM-0004), sized as fractions of the dial radius (MOON_PHASE_MARK_VISUALIZATION). Domain schema change: DialWindow.phaseMarks (false by default), persistence schema v28 to v29 backfills false on every existing window. No kinematic change; the teaching movement turns it on for the moon phase window only.",
    scope: "DialWindow.phaseMarks lunar-phase icon ring (Phase 8.15 follow-up, visual/L0 display only)",
    status: "Active",
  },
  "ASM-0073": {
    summary:
      "Printed moon-phase series on the moon disc (Phase 8.15 follow-up 15): at the user's request the two plain moon images on the dark sky disc were replaced by a ring of phase icons printed on the disc itself -- eight evenly spaced phases per moon image (new, waxing crescent, first quarter, waxing gibbous, full, waning gibbous, last quarter, waning crescent), repeated once per image so a two-image disc carries the series twice, half a turn apart -- and the dial ring of fixed phase icons (ASM-0072) was turned off for the teaching movement; the window's north pointer (ASM-0069) now points at whichever printed phase is current. Each icon of phase p sits at the canvas angle at which a disc label would read at north once the disc has turned phi = 2*pi*(p + k)/n (the same calibrated label-ring rule, ASM-0071), so the icon under the pointer is the phase moonPhaseFraction reports (verified live at fractions 0, 12.5, 25, 37.5, 50 and 75 percent); only the lit part of each icon is printed (follow-up 41): no dark disc or outline completes the moon, so the unlit part is the disc's own sky colour and a new moon prints nothing. The lit part of an icon is bounded by the lit limb and a half-ellipse terminator whose area fraction is the textbook (1 - cos 2*pi*p)/2; waxing phases are lit on the viewer's left and waning on the right (declared Southern Hemisphere convention). Icons are drawn with 'up' pointing away from the disc centre, as the label rings are. Visual only (ASM-0004); sizes are fractions of the disc radius (MOON_PHASE_VISUALIZATION). It supersedes ASM-0055's plain moon images and the full-moon-aligned image geometry (moonImageLocalAngle, kept but no longer drawn). No kinematic or domain change.",
    scope: "Moon phase disc texture (visual/L0 display only)",
    status: "Active",
  },
  "ASM-0074": {
    summary:
      "Year window legibility (Phase 8.15 follow-up 16): at the user's request the year window gets three aids, none changing the barrel, digit size or kinematics. (1) Contrast: the digit numerals are pure white (was cream) and the digit strip carries an emissive term (YEAR_DIGIT_BARREL_VISUALIZATION.emissiveIntensity, following the texture so the dark roller body stays dark) because lit only by the scene's lights the pale numerals read dim through the dial window; the dark roller body itself is kept, matching the tally-counter reference photo (ASM-0064). (2) Edges: new DialWindow.bezel, a thin dark frame printed on the dial around the window's edge, and the window's own height trimmed from 0.4mm to 0.34mm -- still above the digit's 0.218mm glyph extent so it is not clipped, but with the neighbouring digits' slivers mostly gone (the slot arc is 0.251mm). (3) Caption: new DialWindow.caption, a short printed label centred just below the window (the teaching movement prints 'YEAR'), rasterised to a transparent canvas texture on a plane facing the dial-side view. Bezel and caption are sized as fractions of the dial radius (DIAL_WINDOW_PRINT_VISUALIZATION), like the hour markers and pointers; visual only (ASM-0004). Domain schema change: DialWindow.bezel (false by default) and DialWindow.caption (null by default), persistence schema v29 to v30 backfills both on every existing window. No kinematic change.",
    scope: "DialWindow.bezel / DialWindow.caption and year digit strip emissive (Phase 8.15 follow-up, visual/L0 display only)",
    status: "Active",
  },
  "ASM-0075": {
    summary:
      "Five-spoke date, month and moon wheels (Phase 8.15 follow-ups 17 and 20): at the user's request the date and month star wheels (and, in follow-up 20, the moon phase wheel, whose gaps stop at 0.62 of its radius, below its ring of printed phase icons at 0.725-0.955) are drawn as open five-spoke wheels -- a central hub, five constant-width spokes and the gaps between them -- instead of solid discs, with the gaps stopping below the printed number/name ring ('start below the date numbers and below the month names to not encroach'). The gaps end at 0.58 of the tip radius while the label ring sits at 0.72 (DIAL_WINDOW_VISUALIZATION.labelRadiusFraction) and the labels extend only a few hundredths either side, so no gap cuts a label; the solid rim from there to the tip keeps the label ring whole. Spoke count 5, spoke width 0.13, hub radius 0.2 and the opening radius are named fractions of the tip radius (SPOKED_WHEEL_VISUALIZATION), declared visual choices and not a real calendar wheel's spoke design (SRC-0042 describes only a thirty-one-tooth star; no spoke geometry is sourced). The wheel reuses the leap-year wheel's extruded-geometry cap and UV reshaping, so the existing label ring and its calibrated north-reading rule (ASM-0068, ASM-0071) apply unchanged. Visual only (ASM-0004): tip radius, thickness, tooth/position count, mass properties and every kinematic result are unchanged, and the gaps do not feed any clearance or interference check (the wheel's footprint for section capping stays the full circle).",
    scope: "Date/month star wheel geometry (visual/L0 display only)",
    status: "Active",
  },
  "ASM-0076": {
    summary:
      "Dial polish batch (Phase 8.15 follow-up 21), all visual only (ASM-0004), at the user's request: (1) every dial window in the teaching movement now carries the thin dark printed bezel the year window got (ASM-0074); a window's north pointer clears the bezel as well as the window edge. (2) The window pointer triangles are equilateral -- all three sides one declared fraction of the dial radius (DIAL_WINDOW_POINTER_VISUALIZATION.sideFraction, 0.034), height side*sqrt(3)/2 -- replacing the earlier taller 0.03-wide, 0.04-tall triangle (amends ASM-0069's sizing only). (3) The four big hour circles carry the numerals 12 (north), 3 (east), 6 (south) and 9 (west) in the year digits' own text colour (YEAR_DIGIT_BARREL_VISUALIZATION.textColor, ASM-0064), sized as a fraction of the dial radius; east is the dial's right as read from its -Z side. (4) The crown carries a knurl -- 36 rounded ridges, each groove 0.09 of the radius deep (KEYLESS_VISUALIZATION.crownRidgeCount/crownRidgeDepthFraction, cut as a fluted cross-section along the stem) -- instead of a smooth cylinder; the crown's size, position and spin are unchanged (ASM-0012/0019). (5) The hour and minute hands end in an arrowhead -- a shaft tapering to half its width at the head, two barbs sweeping out to one hand-width either side, closing to a point at the hand's own declared length (HAND_ARROWHEAD_VISUALIZATION); the seconds hand keeps its plain taper, and hand length, hub and mounting heights are unchanged (ASM-0016). None of these is a sourced real-watch design; they are declared visual choices and feed no kinematic or clearance result.",
    scope: "Dial window bezels, equilateral pointers, hour numerals, crown knurl, hour/minute hand arrowheads (visual/L0 display only)",
    status: "Active",
  },
  "ASM-0077": {
    summary:
      "Spoked gears (Phase 8.15 follow-up 22): at the user's request, after answering four questions (large wheels only; five straight spokes like the dial wheels; a solid ring of about 20% of the radius under the teeth; a per-gear setting that the teaching movement turns on), a Gear can be drawn as an open five-spoke wheel -- a hub, five constant-width spokes and the gaps between them inside a solid ring under the teeth -- instead of a solid disc. Domain field Gear.spoked (false by default); persistence schema v30 to v31 backfills false on every existing gear, so older designs look unchanged; Inspector row 'Wheel style'. The gaps run from the hub to 0.8 of the gear's own root radius (the 20% ring, GEAR_SPOKE_VISUALIZATION.rimFraction) using the dial wheels' shared hub and spoke-width fractions (SPOKED_WHEEL_VISUALIZATION) of that root radius, one spoke pointing +Y. Needs at least 24 teeth (GEAR_SPOKE_MIN_TOOTH_COUNT); below that the gear is drawn solid and GEAR-105 says so rather than hiding it. The teaching movement turns it on for every wheel of 30 or more teeth (barrel drum, ratchet, centre, third, fourth, minute, hour and the two moon wheels); pinions and smaller wheels stay solid. Visual only (ASM-0004): tooth form, pitch diameter, bore, thickness and every kinematic and mesh result are unchanged, mass and inertia are not modelled from the gaps, and the section-view cap footprint stays the full disc. The STL export uses the same geometry, so a spoked gear exports with its gaps; that is the model's own geometry, not a manufacturing claim.",
    scope: "Gear.spoked open five-spoke wheel (visual/L0 display only)",
    status: "Active",
  },
  "ASM-0078": {
    summary:
      "Faceted ruby jewels (Phase 8.15 follow-up 24): at the user's request the red cylinders that stand for bearing jewels (HOLE_JEWEL) are drawn as faceted ruby ring jewels -- a flat table, bevelled crown, straight girdle and a funnel into a through hole (the olive the pivot runs in), mirrored at both ends so it reads from either side of the plate -- as a 12-facet lathe with flat shading, in a glossy, faintly self-lit ruby. The balance's impulse ruby pin gets the same faceted look as a solid stone (no hole). A PLAIN_HOLE stays a plain grey cylinder. Proportions (hole 0.28, table 0.74, funnel 0.5, crown 0.5 of the outer radius, crown capped at a quarter of the stone's height) are declared visual choices in JEWEL_VISUALIZATION, not a real jewel's catalogue shape; the stone still spans the frame's thickness plus a small proud margin as before. Visual only (ASM-0004, ASM-0006): outer radius, position, bore diameter and every bearing-clearance result are unchanged -- the drawn funnel hole is not the declared bore diameter.",
    scope: "Bearing jewel and impulse pin appearance (visual/L0 display only)",
    status: "Active",
  },
  "ASM-0079": {
    summary:
      "Spoked escape wheel (Phase 8.15 follow-up 25): at the user's request ('make the escape wheel look like a spoked wheel too') the escape wheel can be drawn as an open five-spoke wheel like the spoked gears (ASM-0077) -- a hub ring around the arbor bore, five constant-width spokes and gaps between them, inside a solid ring of 20% of the tooth root radius under the teeth, one spoke pointing +Y. Domain field EscapeWheel.spoked (false by default); persistence schema v31 to v32 backfills false on every existing escape wheel; Inspector row 'Wheel style' in the escapement section; the teaching movement turns it on. The gaps use the dial and gear wheels' shared spoke width (0.13 of the root radius); the hub ring is 1.5 times the arbor-bore radius so the bore is never cut through, which makes this small wheel's gaps narrower than the gears'. Visual only (ASM-0004): tooth form (ASM-0038/0039/0040), tip diameter, thickness, bore and every escapement, pallet-fork and energy result are unchanged, and the section-view cap footprint stays the full disc.",
    scope: "EscapeWheel.spoked open five-spoke wheel (visual/L0 display only)",
    status: "Active",
  },
  "ASM-0080": {
    summary:
      "Gear display colour (Phase 8.15 follow-up 26): at the user's request Moon wheel 1 is shown in the escapement's own colour. A Gear gains a presentation-only colour, DEFAULT (the usual steel grey) or ESCAPEMENT (the escape wheel's gold, the same viewport constant, so the two stay in step); persistence schema v32 to v33 backfills DEFAULT on every existing gear; Inspector row 'Colour'. Follow-up 43 adds a third colour, BLACK (a near-black, not pure black, so the lit teeth still read), also in the Inspector row; no schema bump is needed because an older file only ever holds the first two values. The teaching movement sets ESCAPEMENT on Moon wheel 1 and BLACK on Moon wheel 2, nothing else. Never read by any simulation, validation, mesh or export: it changes only the colour a gear is drawn in (and the colour its section-view cap takes), and selection highlighting still overrides it. ASM-0004 applies: colour implies nothing about material or finish.",
    scope: "Gear.colour display colour (visual/L0 display only)",
    status: "Active",
  },
  "ASM-0081": {
    summary:
      "Day-of-week indicator (Phase 8.15 follow-up 28): a DateComplication gains a presentation/labelling field `display`, DAY_OF_MONTH (the existing 1-31 date, the default) or DAY_OF_WEEK; persistence schema v33 to v34 backfills DAY_OF_MONTH on every existing date complication. A DAY_OF_WEEK star uses exactly the existing date jump kinematics (ASM-0048) with no month attached: one step of 2 pi / 7 per revolution of its 24-hour drive arbor, never backward. SRC-0048 (US8842500B2, a granted patent) describes a 7-arm days star advanced 1/7 turn per day by a pin on a once-a-day wheel with an elastic indexing element; SRC-0049 (horopedia.org) lists the same 7 positions and the distinction between semi-instantaneous and instantaneous jumps. Position 0 is Monday (WEEKDAY_NAMES, src/kinematics/dateComplication.ts); the dial labels use the 3-letter upper-case form (MON..SUN) because full names do not fit round a star this small, while the inspector and window reading give the full name. Not modeled: the pin/pawl-and-star contact geometry, the elastic indexing element's energy storage, the manual correction pusher, and any link between the weekday and the calendar date (the two stars are independent; AppStore.setToBrowserTime sets the weekday from the browser clock via withCalendarDate, ASM-0070, as a declared one-off set-by-hand action). The star colour is a distinct blue (presentation only, ASM-0004). DATE-004 requires seven teeth. Seven is a structural fact about the week, not a per-movement parameter.",
    scope: "DateComplication.display, weekday star labels, withCalendarDate weekday (L2 kinematic; presentation of labels)",
    status: "Active",
  },
  "ASM-0082": {
    summary:
      "Start screen (follow-up 29): a decorative, tap-to-enter splash with a brushed-metal backdrop, a translucent glass plate and a glowing gear train, shown on every load (`?splash=off` skips it). It is L0 visual only (ASM-0004) and part of no design: it is never saved and nothing in the domain model, validation or simulation reads it. The gear train reuses the project's own relations (centre distance a = m (z1 + z2) / 2 and speed ratio -z1/z2, REF-ENG 5.2-5.3) so the teeth interlock and turn at the right ratio, but its tooth form is a plain trapezoid, not involute, and its speed is a slow, arbitrary display rate; it implies nothing about a real calibre. The chips and the note are derived from the loaded design (schema version, its declared validation level, teaching-demo flag) plus a fixed 'physical validation pending' caveat. Pointer/tilt parallax and a synthesised click on entry (muted from a toggle, remembered in local storage) are presentation only; motion is skipped under prefers-reduced-motion. While it is up the application root is inert.",
    scope: "src/app/splash/* (visual/L0 display only)",
    status: "Active",
  },
  "ASM-0083": {
    summary:
      "Display polish batch (Phase 8.15 follow-up 30), all visual only (ASM-0004), at the user's request: (1) the hour and minute hands are longer (the thunderbolt shape first tried here was replaced by plain straight tapered hands in follow-up 31, ASM-0085; the arrowheads of ASM-0076 are gone too) (hour 5 to 7.5 mm, minute 8 to 11 mm; the minute hand stays inside the hour-marker ring at 0.91 of the 14 mm dial radius); the seconds hand and every mounting height are unchanged (ASM-0016). (2) A small black 'RSA MOVT' brand line is printed under the big 6 circle on the dial's south axis, 0.024 of the dial radius tall, centred at 0.98 of the radius so it clears the circle (outer edge 0.96) and stops short of the edge (DIAL_VISUALIZATION.brand). The text is a label the user chose; it asserts nothing about the movement's maker or provenance. (3) The crown is drawn in the escapement's own gold (one shared viewport constant, so they stay in step). (4) Jewels read as cut stones: translucent (opacity 0.66, no depth write), clear-coated, with stepped crown bevels, 24 outer facets (follow-up 31 added the extra cut sides, ASM-0085), and an inner faceted pavilion (a point, the culet, for a solid stone like the impulse ruby) drawn additively inside so it glints through the stone (JEWEL_VISUALIZATION, createJewelCoreGeometry). The refractive index used by the shader (1.77) is a display parameter, not an optical simulation. (5) The splash screen's gears glow brighter (core line, halo and bloom) and the screen zooms in on entry (the splash rushes past the viewer, the app zooms in to rest); skipped under prefers-reduced-motion (ASM-0082). None of these is a sourced real-watch design and none feeds a kinematic or clearance result.",
    scope: "Hand shape/length, dial brand print, crown colour, jewel look, splash glow and zoom (visual/L0 display only)",
    status: "Active",
  },
  "ASM-0084": {
    summary:
      "Watch tick sound (Phase 8.15 follow-ups 30, 31 and 37), decorative and not a recording or a dynamic model: a short synthesised tick (a band-passed noise burst plus a brief ping, the same 'tick' on every beat; follow-up 37 changed it from alternating a higher tick and a lower tock) plays once per escapement beat. The beat rate is the model's own -- the escape arbor's solved angular velocity times the escape wheel's tooth count times two beats per tooth (beatFrequency, ASM-0021), 5 beats a second (18,000 beats an hour) for the teaching movement -- and the tick follows simulated time at that average rate: each beat index floor(t * f) is one tick. The balance's real beat-by-beat motion (amplitude, drop, lock) is not simulated tick by tick (ASM-0024), and the sound has no source in any recording or measurement of a real watch, so it implies nothing about a real watch's sound, beat error or amplitude. A movement with no escapement, or an escape arbor the train does not drive, is silent. It is silent when paused, when the simulation runs faster than real time (the ticks would run together), and on any jump or backward move of simulated time (setting the hands, reset, set to browser time). The Web Audio context is shared with the splash click and is unlocked by the splash tap or the first pointer press or key press; the toolbar 'Tick' toggle is remembered in local storage. (Follow-up 30 first ticked once per dial second; follow-up 31 changed it to the beat rate.)",
    scope: "src/app/audio/tickSound.ts (decorative audio; no model)",
    status: "Active",
  },
  "ASM-0085": {
    summary:
      "Startup and detail batch (Phase 8.15 follow-up 31), at the user's request: (1) the hour and minute hands are plain straight tapered blades ending in a point (hour 7.5 mm, minute 11 mm long, 0.6 and 0.45 mm wide at the tail, narrowing to 0.3 of that at 0.9 of the length) -- visual only, drawn at the simulated angle, replacing the thunderbolts of ASM-0083. (2) Jewels carry more cut sides, visual only: 24 outer facets (from 16), two stepped crown bevels between the table and the girdle, and a faceted inner pavilion made of a kneed 12-facet double cone with a nested, smaller, 24-facet cone turned half a facet inside it (JEWEL_VISUALIZATION, createJewelCoreGeometry); no optics are simulated. (3) On entry the app opens the current teaching movement (not an old autosave of it), sets the simulation to the browser's date and time of day exactly as 'Set to browser time' does (ASM-0070, taken at the moment of entering, not at page load), and shows the dial view with the dial's own centre in the middle of the viewport and the whole dial in view (DIAL_FRAME_MARGIN). A design autosaved by the previous session is not discarded: it is saved in Projects under its own name and the user is told. '?start=plain' restores the earlier behaviour (autosave restored, t = 0, bridge view) and is used by the automated tests. (4) While the splash screen is up the viewport neither draws nor simulates, and the splash draws each glowing gear to a sprite once and only rotates sprites per frame, with a lighter, unblurred glass plate and no sheen or scan lines on touch screens, so the gears turn smoothly on a phone. None of these is a sourced real-watch design and none feeds a kinematic or clearance result beyond the startup clock, which is a declared set-by-hand action (ASM-0070).",
    scope: "Hand shape, jewel facets, startup state and view, splash rendering performance (visual/L0 display; startup clock per ASM-0070)",
    status: "Active",
  },
  "ASM-0086": {
    summary:
      "Drive-chain diagram (Phase 8.15 follow-up 32), a presentation of the model and not a model of its own: every part, connection and speed shown is read from the design and the solved gear train (src/analysis/chainDiagram.ts), so the diagram cannot disagree with the design. Parts are arbors (with the gears on them), the mainspring, the escapement (its pallet arbor and balance staff are drawn inside it) and the calendar stars; connections are gear meshes (labelled driving : driven teeth), friction clutches, the mainspring's drive of the drum and winding through the barrel arbor, the escape arbor's lock and release of the escapement, and the calendar's jump links (ASM-0048 to ASM-0050, ASM-0057, year-digit carry). Columns count connections from the mainspring (breadth-first over all connections, so a part set by the crown such as the setting wheel sits after the part it meshes with, and the arrows on spring and jump links, not column order, show direction of power); a part that no chain of connections reaches is drawn dashed red in a last column and named in the summary. The speeds are the solved running speeds (L2 kinematic); the diagram implies nothing about torque, friction or whether a real spring could drive the chain, which needs physical validation. The diagram can be printed (a black-on-white portrait A4 page, drawn top-down so the chain fits the width) or downloaded as an SVG, both from the same model and carrying the same caveat (follow-up 33).",
    scope: "src/analysis/chainDiagram.ts, src/analysis/chainDiagramPrint.ts, src/app/panels/chainDiagramDialog.ts (presentation of L2 kinematic results)",
    status: "Active",
  },
  "ASM-0087": {
    summary:
      "Moving wheels on the dial and the Fix chain button (Phase 8.15 follow-up 35), editing tools on the declared design and not a physical model. (1) With Move wheels on and the dial view showing, dragging a calendar wheel through its window (date, day of week, month, leap year, season, or the year-digit display, which moves its four barrels and window together) moves the wheel and every window that shows it by the same step, drawn live and committed as one undoable edit on release; a release with no movement changes nothing. These wheels are jump-driven, not gear-meshed (ASM-0048 to ASM-0050, ASM-0057), so they have no centre distance to keep and their cam and jumper links, drawn from the positions, follow by themselves. A wheel placed by a gear mesh (MESH_POLAR) swings round its partner at the unchanged ideal centre distance, so its teeth stay in contact; a coaxial wheel cannot be moved. Moving a wheel never changes a tooth count, module or other dimension, and nothing else moves while dragging. A wheel dropped overlapping another or beyond the dial edge is not stopped: validation reports it. (2) Fix chain\u2026 plans, and shows before applying, the moves needed to tidy the dial after edits: a whole-wheel window whose centre has drifted from its wheel's axis is re-centred on the axis; two wheels whose discs overlap, or are closer than a declared clearance gap of 0.3 mm, are pushed apart along their line of centres (the most recently moved wheel moves, else the smaller); a wheel too near or beyond the dial's edge is pulled inward to the same gap; this repeats until stable or 20 passes. The gap and pass limit are declared tidy-up choices (CHAIN_FIX), not a manufacturing clearance or a sourced figure. The plan is applied only on confirmation, as one undoable edit, and lists every part it moves and by how much; anything it cannot fix (a coaxial wheel, a conflict that does not settle) is reported rather than hidden. Nothing here checks torque, friction or physical fit (physical validation pending).",
    scope: "src/assembly/moveWheel.ts, src/assembly/fixChain.ts and the viewport/dialog UI (design editing, L1 geometric)",
    status: "Active",
  },
  "ASM-0088": {
    summary:
      "Startup layout (Phase 8.15 follow-up 36), a convenience for opening a design and not a model: a saved project in Projects can be set to open every time the app starts (its id is kept in browser storage under mw3d.startup.project; an entry marked with a star). It opens exactly as saved, then the usual startup applies (browser date and time, dial view, ASM-0085). With none set, the current teaching movement opens. If the chosen project is gone or unreadable the teaching movement opens and the user is told why. The design left by the last session (the autosave) is never discarded and never overwrites a deliberate save: with no entry of its own it is saved in Projects under its own name; identical to its entry it is not written again; edited since it was saved it goes to a separate entry named '... (unsaved edits)' (replaced by the next such session), leaving the saved design itself unchanged. Deleting the startup project clears the setting. '?start=plain' ignores all of this. Browser storage can be cleared by the browser, so the Save button's file remains the durable backup.",
    scope: "src/persistence/library.ts (startup project, keepPreviousSession), src/app/startup.ts, Projects dialog (design-file handling, no engineering model)",
    status: "Active",
  },
  "ASM-0089": {
    summary:
      "Seconds-hand position (Phase 8.15 follow-up 38), a layout choice and not a model: at the user's request the seconds hand and its numerals sit about 1.1 mm further right on the dial and 2.2 mm lower than before, at (8.70, -4.90) mm (from (9.78, -2.70) mm; the dial's right is -X). The seconds hand rides on the fourth arbor, which is placed by gear meshes (ideal centre distances, REF-ENG 5.2), so it cannot simply be slid: the third arbor now swings about the centre arbor and the fourth about the third, each at its exact centre distance and with every tooth count and ratio unchanged, until the fourth lands at the chosen point (two-link solution, TWO_LINK in teachingMovement.ts, taking the elbow below the line to the target, the branch nearer the old layout). The escape arbor keeps its 90 degree direction from the fourth, so the escape arbor, pallet arbor, balance staff, the balance cock outline and its screw move by the same step, and the train bridge outline's lower right corner is extended downward so it still holds the fourth arbor. The pallet/balance spacing and the escapement geometry are unchanged. All figures are illustrative layout choices (ASM-0009), not a sourced calibre layout.",
    scope: "src/app/teachingMovement.ts SECONDS_PIVOT_MM (teaching movement layout, L1 geometric)",
    status: "Active",
  },
  "ASM-0090": {
    summary:
      "Colours menu (Phase 8.15 follow-up 39), presentation only (L0 visual, ASM-0004): a Colours flyout lets the user choose, with an in-app colour chart (a saturation and brightness square plus a hue bar, or a typed #rrggbb), the colour of each wheel that a dial window shows (its body, and the text or digits printed on it; the four year-digit barrels are one wheel), the dial face, the hour marker circles, the numerals inside the four big hour markers, the printed text, triangles, frames and digits on the dial (window captions and pointers and frames, the seconds numerals and the brand line), the seconds hand, the minute hand and the hour hand. A colour not chosen is the built-in one; Reset puts a colour or everything back. For a wheel the chosen body colour fills the disc face seen through the window (the label discs' light fill, the moon's sky, the season wedges as one colour, the year barrels' background) and the text colour is the printed labels, the moon's lit phase icons, the season icons and labels, or the year digits. The choices are saved with the design (schema v35 gives older files nothing chosen; v36 adds the seconds hand), are undoable edits, and are never read by validation, kinematics, the chain diagram or any export (reports and drawings keep their own colours). A colour is only a picture: it implies nothing about materials, finish or what a real part would be made of (ASM-0004), and no contrast or legibility check is made, so an unreadable pairing is the user's choice.",
    scope: "src/domain/appearance.ts, the Colours panel, viewport and dial rendering (visual/L0 display only)",
    status: "Active",
  },
  "ASM-0091": {
    summary:
      "Calendar link bars (Phase 8.15 follow-up 43), presentation only (L0 visual, ASM-0004): the date, day-of-week, month, leap-year and season wheels are not meshed; each is advanced by a jump from another part (the 24-hour arbor drives the date and day stars, the date star the month star, the month star the leap-year and season wheels), as the chain diagram already lists. So that the whole chain reads as connected, a plain bar with a round hub at each end is drawn from each driver's axis to the driven wheel's axis, in a thin layer just on the dial side of the calendar wheels' mid-plane (0.01 mm in front, 0.03 mm thick) that is clear of every other wheel in the teaching movement (a test checks it). The bars are fixed and show only which part drives which: they are not a modelled lever, pawl, cam or spring, carry no force or timing, and are never read by validation, kinematics or any export. Also in this change, the teaching movement's moon train bends the other way and the 24-hour arbor sits 20 degrees below the 9 o'clock line, because a 3D overlap audit showed Moon wheel 1 cutting through the date and month wheels and the minute pinion 0.03 mm from the 24-hour wheel at the same height (all mesh distances, ratios and the moon window unchanged).",
    scope: "src/geometry/calendarLinks.ts, the viewport (visual/L0 display only); src/app/teachingMovement.ts (layout)",
    status: "Active",
  },
} as const satisfies Record<string, Omit<Assumption, "id">>;

export type AssumptionId = keyof typeof ASSUMPTIONS;

export function listAssumptions(): Assumption[] {
  return (Object.keys(ASSUMPTIONS) as AssumptionId[]).map((id) => ({ id, ...ASSUMPTIONS[id] }));
}
