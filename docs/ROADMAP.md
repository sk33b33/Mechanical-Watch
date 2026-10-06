# Roadmap

## Phase 0 — Foundation
- Vite/TypeScript setup
- strict linting
- test runner
- domain IDs
- unit system
- design serialization

## Phase 1 — Gear sandbox
- gear parameters
- pitch geometry
- centre distance
- gear mesh
- speed ratio
- direction
- editable inspector
- 3D gear preview

## Phase 2 — Movement assembly
- mainplate
- bridges
- shafts
- jewels
- wheel placement
- constraints
- collision/interference

## Phase 3 — Kinematic movement
- barrel
- centre/third/fourth/escape wheels
- motion works
- animation driven by calculated state

## Phase 4 — Watchmaker workspace
- assembly tree
- exploded view
- section view
- measurement tools
- validation console
- saved projects

## Phase 5 — Escapement
- pallet geometry
- escape wheel
- balance
- hairspring
- beat rate
- amplitude approximation
- explicit assumptions

## Phase 6 — Engineering outputs
- BOM
- dimensioned drawings
- component reports
- STL/STEP/DXF architecture
- tolerance model

## Phase 7 — Advanced simulation
Only after the earlier layers are robust. Scoped 2026-10-04 (see
`docs/STATUS.md`) into six ordered items, each targeting a physical
model REF-ENG §9/§10/§11 already calls for and naming which current
ASM-00xx simplification it would tighten or replace. An item with no
available source is scoped to stay a documented assumption, not
implemented as if solved (CLAUDE.md: never silently raise a validation
level).

- 7.1 — **Partly done, remainder scoped 2026-10-04** (see
  `docs/STATUS.md`). Drop (ESC-106/107, ASM-0036) is modeled. The
  remaining real tooth/pallet FACE geometry is scoped into six ordered
  sub-items, ALL already sourced from Playtner 1908 (SRC-0036, read in
  full) — the risk here is construction correctness, not source
  availability (the one place in Phase 7 where that's true):
  - 7.1.1 — **Done** (see `docs/STATUS.md`). Pallet type (EQUIDISTANT |
    CIRCULAR, ASM-0037) and declared pallet width. The project's existing
    tangential-locking math turned out to already *be* the equidistant
    construction (Playtner's own identification); CIRCULAR is a visible,
    disabled stub (no closed-form locking offset in the source). Pallet
    width completes the tooth/pallet/drop wheel-angle partition ASM-0036
    started: escape-tooth width is now derived (`toothWidthAngle`), not
    missing, and ESC-106/107 check and report the full partition.
  - 7.1.2 — **Done** (see `docs/STATUS.md`). Tooth type (CLUB | RATCHET,
    ASM-0038) and the tooth/pallet width split within the existing
    per-beat wheel-angle budget (ASM-0036). Club: lift split between
    tooth and pallet (Playtner's 15-tooth example: 4½° tooth, 6°
    pallet, from a 12° budget less 1½° drop), tooth width must stay
    positive; ratchet (English): all lift on the (wider) pallet, tooth
    is a bare point, so tooth width may be exactly zero (ESC-106
    relaxed for this case only). Drop advisory (ESC-107) now cites the
    type-specific figure (1.5° club / 2° ratchet). Note: 7.1.1's
    English-wheels-usually-paired-with-circular-pallets observation
    from Playtner is not itself enforced — CIRCULAR pallets remain an
    unimplemented stub, so a RATCHET + EQUIDISTANT combination is
    accepted without a cross-check; not a gap this pass closes.
  - 7.1.3 — **Done** (see `docs/STATUS.md`). Gave `drawAngle` its real
    geometric referent (ASM-0039): the pallet locking face's inclination
    from the radial line through the locking point (Playtner: "inclined
    12° from EB, and FB"), rather than a bare validated number. Derived
    the escape tooth's own locking face as conventionally double that,
    for point contact (Playtner: 12° pallet / 24° tooth) — not a strict
    formula, checked against a cited practical 20°-28° range (ESC-108).
    Note: this does not yet build the actual 2D face/outline geometry
    (lines, not just angles) — that needs the engaging/disengaging
    asymmetry and locked-vs-unlocked correction 7.1.4 is scoped to
    tackle alongside the full outline construction.
  - 7.1.4 — **Done** (see `docs/STATUS.md`), scoped down from "full".
    Replaced the placeholder shapes (`generateEscapeWheelOutline`'s
    fixed trapezoid, `createForkGeometry`'s plain stone boxes) with
    real, straight-edged outlines (ASM-0040) using the model's own
    angles: a flat-top tooth of `toothWidthAngle` with a locking edge
    leaning `toothDrawAngle` off the radial (found by exact ray–circle
    intersection); a pallet stone whose face sits through the locking
    point in the declared/derived draw direction. Not the "real locking-
    face + lifting-face + back profiles" originally envisioned here:
    true face curvature, the actual tooth/pallet contact geometry, the
    real/primitive-circle correction and the engaging/disengaging
    asymmetry remain unmodeled (same gaps ASM-0039 already named) — a
    deliberate, declared simplification rather than an attempt at full
    fidelity without the source's own diagrams fully reverse-engineered.
  - 7.1.5 — **Done**, all six sub-items (see `docs/STATUS.md`). Fork and
    roller action (ruby pin, safety roller, guard pin, crescent, horn) —
    REF-ENG §9's "balance interaction," previously modeled only as an
    abstract `forkRatio` with no actual roller/pin geometry at all.
    Mostly independent of 7.1.1-7.1.4; shipped separately. Playtner
    devotes four chapters to this specifically
    ("The Fork and Roller Action", "The Safety Action", "The Crescent",
    "The Horn") — more raw material than 7.1.1-7.1.4 combined, so
    scoped into its own sub-items, same pattern as 7.1 itself:
    - 7.1.5.1 — **Done** (see `docs/STATUS.md`). Impulse radius
      (declared, mm: balance staff to ruby pin) and the real fork
      acting length, derived via Playtner's own stated law ("the
      angles are in the inverse ratio to the radii"):
      `forkActingLength = impulseRadius × forkRatio` (ASM-0041,
      ESC-109). Turns the existing `forkRatio` from a bare dimensionless
      number into an actual lever-arm length. Note: does NOT touch the
      viewport's cosmetic `leverLength = toBalance * 0.85` fork-bar
      length as originally envisioned here — that's a different
      quantity (real placed geometry vs. declared/derived theoretical
      radius) and reconciling them without risking a visually broken
      drawing needs the real ruby-pin/roller shapes, left to 7.1.5.6.
    - 7.1.5.2 — **Done** (see `docs/STATUS.md`). Ruby pin entry freedom
      and slot shake (ASM-0042): entry freedom must be strictly less
      than the total lock (a genuine hard necessity Playtner states,
      not just a cited convention — ESC-110), with the cited 1-1.25°/
      0.25-0.5° figures as non-blocking advisories; the suggested ruby
      pin width (half the fork's angular motion, "we would choose", not
      a strict rule) is derived and reported, same genre as ESC-108.
    - 7.1.5.3 — **Done** (see `docs/STATUS.md`). `Balance.rollerKind`
      (SINGLE | DOUBLE, ASM-0043): single roller trades off impulse
      against the safety action on one roller; double decouples them,
      per Playtner's own stated reasoning. When SINGLE, a fork ratio
      below his cited floor (3 to 1) is a non-blocking advisory
      (ESC-111), not checked for DOUBLE. Guard-point freedom/radius
      (declared) and the derived clearance (`guardPointClearance`,
      same arc-length formula as `dropClearance`): guard-point freedom
      must be strictly less than the total lock, the same hard
      necessity as 7.1.5.2's ruby-pin entry freedom. The dart's own
      shape and the fuller roller/crescent geometric relationship
      remain unmodeled.
    - 7.1.5.4 — **Done** (see `docs/STATUS.md`). Single-roller crescent
      angular opening (ASM-0044, ESC-112), reconstructed as closed-form
      trigonometry (`crescentHalfAngle`/`ringCrossingAngle`/
      `rubyPinAngleAtBalance`) from Fig. 14/Fig. 24 and the chapter's
      verbal compass construction — this is the author's own reading of
      a construction with no stated formula and no worked numeric
      example, not a quoted equation, and clearly marked as such.
      `Balance.rollerRadius` (new, declared, optional) is left unknown
      everywhere including the teaching movement, since its own placed
      pallet-to-balance distance doesn't admit its own fork acting
      length/impulse radius as a consistent triangle. Uses the actual
      placed pallet-arbor/balance-staff distance (same source ESC-103
      already uses) rather than a second, redundant declared figure;
      an inconsistent triangle is reported as a warning, not a wrong
      number. Double roller's own "dart" construction (a different,
      partly empirical allowance) is not reconstructed — remains
      unmodeled, with the dart's own shape and "The Horn" chapter.
    - 7.1.5.5 — **Done** (see `docs/STATUS.md`). Horn freedom
      (ASM-0045, ESC-113): turned out simpler than scoped here — the
      horn's end lies on the *same* pallet-centred arc as the ruby pin
      (the fork's own acting length), not a cross-centre construction
      like the crescent, so `hornClearance` reuses
      `dropClearance`/`guardPointClearance`'s arc-length formula with
      no new radius or real-placement dependency. Must be strictly
      less than the total lock, the same hard necessity as
      `rubyPinEntryFreedom`/`guardPointFreedom`. The cited ¼°-½°
      margin above the guard-point freedom is a non-blocking advisory.
      The horn's own physical length/shape remains unmodeled, left to
      7.1.5.6.
    - 7.1.5.6 — **Done, grounded slice** (see `docs/STATUS.md`). Fig. 25
      ("The Horn") was fetched and viewed before implementing, showing
      the real shape: curved horn jaws cradling a roller with a
      crescent notch. Scoped down from the full capstone (which this
      entry originally envisioned) after confirming with the user: the
      ruby pin and single roller are now drawn at their real
      declared/derived position and size (`impulseRadius`/
      `rollerRadius`, ASM-0041/ASM-0044) in the 3D viewport, and the
      fork bar's own drawn length now uses the real `forkActingLength`
      when it fits the actual placed pallet-to-balance distance — the
      reconciliation flagged as deferred since 7.1.5.1. The crescent
      notch and horn jaw curvature are NOT drawn: their angular bounds
      are derived but their physical outline is not, and drawing them
      would mean inventing curvature rather than computing it.
    Suggested order: 7.1.5.1 → 7.1.5.2 → 7.1.5.3 → 7.1.5.4 → 7.1.5.5 →
    7.1.5.6, each independently shippable; 7.1.5.1-3 are low-risk
    declared/derived scalars, 7.1.5.4-5 are real geometric
    constructions needing source figures first, 7.1.5.6 is the visual
    capstone. All six sub-items are now done.
  - 7.1.6 — **Researched, deliberately not implemented** (see
    `docs/STATUS.md`). Looked simplest of all the 7.1.x items from its
    one-line description, but read in full (plus Figs. 2-4, fetched and
    viewed) it needs a genuinely new domain concept this project has
    consistently deferred throughout 7.1: a separate tooth-side
    *lifting* angle, distinct from the tooth's own declared *width*
    (ASM-0037) — "the lifting angle on the tooth must be less in
    proportion to its width than it is on the pallet," with fine
    watches even using curved (not flat) lifting planes. Playtner's own
    worked "heel of the tooth" distance depends on this tooth-face lift
    distribution, which is exactly the "tooth/pallet FACE contact
    geometry... true lifting-face curvature" this project's own
    SOURCES.yml has repeatedly and deliberately scoped out since 7.1.1.
    Implementing it well would mean quietly reopening that boundary for
    an item explicitly flagged as smallest/lowest-priority — not done;
    left genuinely open rather than approximated with an uncited
    substitute.
  Suggested order: 7.1.1 → 7.1.2 → 7.1.3 → 7.1.4, each independently
  shippable and testable (same incremental pattern as the
  WATCH_SPECIFIC_PROFILE gear work); 7.1.5 and 7.1.6 can run separately,
  in any order, whenever picked up.
- 7.2 — **Researched, deliberately not implemented** (see
  `docs/STATUS.md`). Impact and sliding-contact dynamics at
  unlock/impulse (REF-ENG §9: "a simple rigid gear mesh is not an
  adequate physical model"). SRC-0004/0005/0006 registered and corrected
  (real titles/authors/years via Crossref), but all three remain unread
  (paywalled); SRC-0041 (Naperkoski 2022, Virginia Tech, open-access) was
  found and read in full — a dedicated FEM thesis on exactly this
  mechanism that needed a custom physical rig and over a year of
  calibration and still couldn't sustain long-term stable operation. A
  standing research problem, not a sourcing gap; left unimplemented
  rather than approximated.
- 7.3 — **Done** (see `docs/STATUS.md`). Amplitude-dependent rate
  (circular error), via a declared/measured isochronism coefficient
  (ASM-0034) rather than a universal formula: no source found gives a
  closed-form rate-vs-amplitude equation (Phillips 1861, SRC-0033, gives
  zero-error *conditions* for an ideal spring, not a residual for a real
  one), so the model is a first-order local linearization around the
  declared amplitude, same pattern as Q/escapement efficiency.
- 7.4 — **Further researched, remains genuinely open** (see
  `docs/STATUS.md`). Q has an informal ~100-300 advisory (SPR-004,
  ASM-0035, SRC-0034, Tier 6/secondhand). Escapement efficiency only has
  a geometric-only upper bound (91%/88% by tooth count, SRC-0035) at two
  data points, not a general formula. SRC-0041's own author reports that
  quantifying escapement error/efficiency from this kind of model is
  "impossible... without a watchmaker's expertise... and data from
  prolonged stable operation" — not yet implementable as a rule; remains
  genuinely open.
- 7.5 — **Researched, genuinely open; reconfirmed** (see
  `docs/STATUS.md`). Three independent sources (SRC-0037/0038/0039)
  confirm no accessible closed-form "real" torque curve exists — standard
  spring theory is itself linear (no improvement on ASM-0026's own
  two-point line); the real nonlinearity needs measurement, not a
  formula. Bridle slip (~1.3-1.5×, SRC-0038, unread/unverified) is scoped
  to automatic winding, which this project doesn't model at all.
  SRC-0041 independently corroborates the sourcing problem: its author
  could not find a published mainspring torque figure even for a
  dedicated thesis, and used an unverified public-forum value instead.
- 7.6 — **Temperature done; position researched, deliberately not
  implemented** (see `docs/STATUS.md`). A Tier 1 primary source (Gould
  1934, NIST RP670, SRC-0040) gives the same kind of declared/measured
  first-order linearization already used for isochronism (ASM-0034), now
  for temperature (`Balance.temperatureCoefficient`, ASM-0046), cites a
  20 °C middle-temperature reference and a 5 °C-35 °C reporting range
  used as-is. Positional error does not fit this pattern — it is a
  spread across several rotational axes, not a sensitivity to one scalar
  — and is left unmodeled rather than squeezed into a scalar coefficient
  that would misrepresent it.

Order: 7.1 before 7.2; 7.3 independent (recommended first); 7.4/7.5 can
run in parallel as research; 7.6 depends on 7.3.

## Phase 8 — Calendar complications (date, month, season, year)

**User request, flagged 2026-10-05: pick this up once Phase 7 is done.**
The user wants to design a watch that shows date, month, season and
year in addition to time, and asked to be reminded about it once Phase
7 wraps up. Checked the codebase at the time of the request: none of
this exists yet.

Not currently modeled, confirmed by inspection:
- No calendar domain entities at all (no date wheel, month wheel,
  jumper spring, snail cam, star wheel, or any instantaneous-jump
  mechanism — a real date/month complication needs a discrete midnight
  "jump," not a smoothly-turning gear, which is a different kind of
  mechanism than anything in the current gear-train/escapement model).
- No way to display one even if the gearing existed: hands are
  hard-coded to HOURS/MINUTES/SECONDS only (`HAND_VISUALIZATION` in
  `src/geometry/assemblyGeometry3d.ts`); the dial draws hour markers
  only, no date window, sub-dial or disc.
- "Season" specifically is a rare, high-end complication even in real
  watchmaking — usually only seen alongside equation-of-time/perpetual-
  calendar grand complications (tracking the ~365.2422-day tropical
  year), not a standard calendar-watch feature. Worth the user knowing
  this going in, independent of what the app supports.

**Scoped 2026-10-06** (see `docs/STATUS.md`) into ordered sub-items,
same pattern as Phase 7.1. Five new patent sources were found and read
(SRC-0042 through SRC-0045 — US/granted patents, two from major Swiss
manufacturers, ETA SA and Omega SA) plus one astronomical reference
(SRC-0046, NASA), closing the "no sourcing yet" gap the first pass of
this entry flagged. Key architectural finding from reading them: **the
driving side of every one of these complications is an ordinary
continuous gear reduction** — this project's existing gear-mesh/
shaft-angular-velocity engine (Phase 2/3) already covers a "24-hour
wheel" off the hour wheel, or a moonphase reduction, with zero new
kinematics. The one genuinely new concept, needed by date/month/leap-
year but *not* moonphase, is the discrete **jump**: a spring stores
energy continuously and releases it abruptly at a trigger point,
snapping a star wheel forward one tooth and holding it there with a
jumper until the next trigger — closer in kind to this project's own
escapement phase model (lock/impulse/drop, ASM-0021, and specifically
the pattern in `src/simulation/escapementDisplay.ts` of deriving a
discrete-looking display from an underlying continuous simulation
state, not a separate state machine) than to the smooth gear-train
propagation used everywhere else.

- 8.1 — **Done** (see `docs/STATUS.md`). Moonphase: a continuously-
  turning disc off the going train, no jump mechanism at all (SRC-0045,
  confirmed directly from a patent's own abstract and figures — "driven
  to continuously rotate around the axle at a rotation period related to
  the moon phase period"). New `MoonPhase` domain entity, declared on its
  own arbor — reuses the existing gear-mesh engine entirely, zero new
  kinematics, confirming this item's own scoping. Phase read cyclically
  from the arbor's solved angle (`moonPhaseFraction`), the implied
  lunation reported against the real synodic month, 29.53059 days
  (SRC-0046, NASA) via `impliedLunationDays`/`lunationDriftMinutes` — a
  comparison only, never fed back into the model (ASM-0047). The
  teaching movement's own two-stage 8:87 reduction lands on a ~29.57-day
  lunation, about 55 minutes off the real figure, reported rather than
  engineered away.
- 8.2 — **Done** (see `docs/STATUS.md`). Simple instantaneous date: the
  jump-mechanism question settled. A new `DateComplication` entity whose
  star wheel is NOT a continuous gear-train member — its own arbor is
  absent from the solver's angular-velocity map (exempted from the
  "unpowered" warning, same pattern as the escapement's oscillating
  arbors) and is instead advanced directly inside `stepSimulation`
  itself, once per revolution of an ordinary, continuously-driven drive
  arbor (a 24-hour wheel, 2:1 off the hour wheel, SRC-0042), detected as
  a forward-only threshold crossing (reversing the drive never
  un-advances the star — a real jump mechanism's ratchet behaviour).
  SRC-0042's own "a concave portion... preventing the latter from moving
  by more than one step" and its 31-tooth worked example are used
  directly. No jumper-spring energy storage or finger/cam contact
  geometry is modeled — only this net kinematic effect.
- 8.3 — **Done** (see `docs/STATUS.md`). Month / annual calendar: SRC-0043
  (ETA SA's own production design, a granted patent)'s date disc with a
  second toothing and month star, modeled as the net kinematic effect —
  the same simplification 8.2 applied to the date jump itself, not a
  literal simulation of the drive wheel set's engaged/disengaged
  positions. A new `MonthComplication` entity references an existing
  `DateComplication` (a new "entity references another entity's id"
  pattern) and has no drive arbor or gear train of its own: it is driven
  entirely by the date complication's own jumps, via a `monthEndCorrection`
  formula that enlarges the date star's jump by exactly the days the
  current month is short, in the same event that advances the month star —
  built directly into 8.2's own jump-application loop, no new top-level
  simulation-state field needed. Does not by itself handle leap years — an
  annual calendar in the real-watchmaking sense still needs manual
  correction once a year (end of Feb, by design); that is a legitimate,
  sourced design point, not a bug, left to 8.4.
- 8.4 — **Done** (see `docs/STATUS.md`). Leap year / four-year cycle: the
  research gate cleared first — SRC-0047 (a peer-reviewed mechanism-design
  paper), independently re-derived and cross-checked, confirms a genuine
  single-pin Geneva (Maltese-cross) drive has real closed-form position
  and velocity kinematics (`src/kinematics/genevaDrive.ts`), not a
  hand-waved claim. SRC-0044 (Omega SA)'s real mechanism is "a rotatable
  assembly journalled on the month star... including a year cam and a
  Maltese cross" — a cam-plus-Geneva hybrid; this item models only the
  Geneva-drive component (the year cam, which would carry real leap-year
  logic such as century exceptions, is not modeled). Like 8.2/8.3, only
  the net kinematic effect is simulated (one 90° index step per calendar
  year, triggered by the month star's own December-to-January wrap, the
  same jump-chaining pattern 8.3 established) — but unlike 8.2/8.3, the
  real continuous, non-uniform indexing-stroke kinematics genuinely exist
  and are implemented, tested and cited as a reusable library module, and
  surfaced as reference figures rather than left unused.
- 8.5 — "Season" / equation of time — **confirmed out of scope, not
  reconsidered without the user asking.** Re-researched this pass
  (beyond the original flag): the real mechanism (per auction-house and
  manufacturer technical descriptions) is a "very specifically
  bean-shaped cam that can take into account the analemma curve... over
  the course of a year" — a fundamentally different mechanism class
  (a profile cam encoding empirical orbital-mechanics curve data) from
  every other item here, "rarely featured in a wristwatch" even among
  grand complications, and would need real analemma/equation-of-time
  data this project has not sourced. Left deliberately unscoped.
- 8.6 — Display/UI groundwork (cross-cutting, needed by 8.1-8.4): a new
  disc/window display concept distinct from the continuously-rotating
  `HandFunction` hands (`src/kinematics/timeDisplay.ts`,
  `HAND_VISUALIZATION` in `src/geometry/assemblyGeometry3d.ts`), dial
  windows or sub-dials to show it through, in both the inspector and the
  3D viewport.
- 8.7 — Validation rules (cross-cutting, needed by 8.2-8.4): jump-timing
  sanity (a trigger genuinely near the driving wheel's own period
  boundary, not an arbitrary angle), interference between the new discs/
  stars and existing components at their z-height, same discipline as
  the existing GEAR-1xx/ESC-1xx rules.

Order: 8.1 first (ships independently, no jump-mechanism risk, proves
the display groundwork 8.6 needs). 8.2 next (the jump-mechanism design
decision, needed by everything after it). 8.3 after 8.2. 8.4 after 8.3,
gated on checking its Geneva-drive kinematics claim against a real
mechanism-design source first. 8.5 stays out of scope. 8.6/8.7 are
cross-cutting — do the display groundwork alongside 8.1, and the
validation rules alongside whichever jump-mechanism item is current.

8.1–8.4 are done (see `docs/STATUS.md` for each). 8.6/8.7's
cross-cutting work was folded into 8.1–8.4 as they shipped, rather than
built as separate items. 8.5 remains confirmed out of scope. No further
Phase 8 sub-item is scoped to start without the user's next explicit
instruction.
