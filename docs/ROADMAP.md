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
  - 7.1.5 — Fork and roller action (ruby pin, safety roller, guard pin,
    crescent, horn) — REF-ENG §9's "balance interaction," currently
    modeled only as an abstract `forkRatio` with no actual roller/pin
    geometry at all. Mostly independent of 7.1.1-7.1.4; could ship
    separately. Playtner devotes four chapters to this specifically
    ("The Fork and Roller Action", "The Safety Action", "The Crescent",
    "The Horn") — more raw material than 7.1.1-7.1.4 combined, so
    scoped into its own sub-items, same pattern as 7.1 itself:
    - 7.1.5.1 — Impulse radius (declared, mm: balance staff to ruby
      pin) and the real fork acting length, derived via Playtner's own
      stated law ("the angles are in the inverse ratio to the radii"):
      `forkActingLength = impulseRadius × forkRatio`. Turns the
      existing `forkRatio` from a bare dimensionless number into an
      actual lever-arm length, and replaces the viewport's current
      cosmetic `leverLength = toBalance * 0.85` guess with a derived
      value. Lowest risk, most directly answers "no actual roller/pin
      geometry at all" — recommended first.
    - 7.1.5.2 — Ruby pin width and slot freedom. Playtner's own cited
      figures (freedom 1-1.25° at the acting edge, 0.25-0.5° shake in
      the slot, a suggested width of half the fork's angular motion —
      "we would choose", not a strict rule) as declared/derived values
      with advisories, same genre as ESC-107/108.
    - 7.1.5.3 — Roller and guard-point/dart freedom (1.25° cited).
      Single vs. double roller is a real domain distinction Playtner
      draws (double roller trades a larger safety roller for a smaller,
      more secure one) — may need its own `rollerKind` field, same
      pattern as `toothKind`/`PalletKind`.
    - 7.1.5.4 — Crescent angular opening: a genuine geometric
      construction (the guard point's circular path around the pallet
      axis intersecting the roller circle around the balance axis),
      analogous to the existing `tangentialCentreDistance`/
      `lockingPoints` pallet-locking construction. Needs the source's
      own figures (Fig. 14, Fig. 24) fetched and viewed first, the same
      diligence as 7.1.3/7.1.4's fig05/fig28 — this geometry has
      multiple interacting circles and letters that are hard to get
      right from text alone.
    - 7.1.5.5 — Horn length and freedom: a similar circle-intersection
      construction along the pallet-to-ruby-pin line; freedom 0.25-0.5°
      more than the guard-point freedom (cited, relational).
    - 7.1.5.6 — Visual 2D/3D construction for the ruby pin, roller(s),
      crescent and horn shapes, replacing the current symbolic fork bar
      and plain stone-style placeholders — the capstone for this area,
      same role 7.1.4 played for pallets/teeth. By far the largest
      single piece here; likely the highest-risk item in the whole of
      7.1.5, same caution as 7.1.4's own risk flag.
    Suggested order: 7.1.5.1 → 7.1.5.2 → 7.1.5.3 → 7.1.5.4 → 7.1.5.5 →
    7.1.5.6, each independently shippable; 7.1.5.1-3 are low-risk
    declared/derived scalars, 7.1.5.4-5 are real geometric
    constructions needing source figures first, 7.1.5.6 is the visual
    capstone.
  - 7.1.6 — Center-distance refined for manufacturing clearance (pallet
    arbor thickness, working stock) rather than the current pure
    idealized tangent-circle construction (`tangentialCentreDistance`).
    Smallest, lowest-priority item; a polish-level refinement in
    Playtner's own "Center Distance" chapter.
  Suggested order: 7.1.1 → 7.1.2 → 7.1.3 → 7.1.4, each independently
  shippable and testable (same incremental pattern as the
  WATCH_SPECIFIC_PROFILE gear work); 7.1.5 and 7.1.6 can run separately,
  in any order, whenever picked up.
- 7.2 — Impact and sliding-contact dynamics at unlock/impulse (REF-ENG
  §9: "a simple rigid gear mesh is not an adequate physical model").
  Candidate sources: SRC-0004/0005/0006 (registered, unused). Builds on
  7.1; likely L3 idealized bookkeeping before true contact mechanics.
- 7.3 — **Done** (see `docs/STATUS.md`). Amplitude-dependent rate
  (circular error), via a declared/measured isochronism coefficient
  (ASM-0034) rather than a universal formula: no source found gives a
  closed-form rate-vs-amplitude equation (Phillips 1861, SRC-0033, gives
  zero-error *conditions* for an ideal spring, not a residual for a real
  one), so the model is a first-order local linearization around the
  declared amplitude, same pattern as Q/escapement efficiency.
- 7.4 — **Partly done** (see `docs/STATUS.md`). Q has an informal
  ~100-300 advisory (SPR-004, ASM-0035, SRC-0034, Tier 6/secondhand).
  Escapement efficiency only has a geometric-only upper bound (91%/88%
  by tooth count, SRC-0035) at two data points, not a general formula —
  not yet implementable as a rule; remains genuinely open.
- 7.5 — **Researched, genuinely open** (see `docs/STATUS.md`). Three
  independent sources (SRC-0037/0038/0039) confirm no accessible
  closed-form "real" torque curve exists — standard spring theory is
  itself linear (no improvement on ASM-0026's own two-point line); the
  real nonlinearity needs measurement, not a formula. Bridle slip
  (~1.3-1.5×, SRC-0038, unread/unverified) is scoped to automatic
  winding, which this project doesn't model at all.
- 7.6 — Positional and temperature effects (REF-ENG §10's "Physical
  model"). Depends on 7.3. Highest research risk.

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

Rough shape of what adding this would need (not yet scoped into
sub-items the way Phase 7.1 was):
1. Domain entities for calendar components (date wheel/disc, month
   wheel, year indicator) and their place in the component model listed
   in `CLAUDE.md`.
2. A jumper/cam mechanism model — genuinely new kinematics, not a
   continuous gear ratio: energy storage (spring) release at a trigger
   point, distinct from the steady-state gear-train propagation this
   project models today.
3. Display support: new hand/disc kinds, dial windows or sub-dials.
4. Validation rules for the new components (interference, jumper
   timing, etc.), consistent with the project's existing validation-
   level discipline.
5. Sourcing: cited mechanisms and assumptions for whichever calendar
   mechanism design is chosen (simple date, annual calendar, or full
   perpetual calendar each work differently), same engineering-
   traceability standard as the rest of this project — nothing
   invented without a source.

Do not start this without the user's go-ahead; it's a new domain area,
not a refinement of existing Phase 7 work.
