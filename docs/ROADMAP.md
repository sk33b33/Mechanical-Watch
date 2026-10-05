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
  - 7.1.2 — Tooth type (CLUB | RATCHET) and the tooth/pallet width split
    within the existing per-beat wheel-angle budget (ASM-0036). Club:
    lift split between tooth and pallet (Playtner's 15-tooth example:
    4½° tooth, 6° pallet, from a 12° budget less 1½° drop); ratchet
    (English): all lift on the (wider) pallet, tooth is a bare point.
    Interacts with 7.1.1 (English wheels are usually paired with
    circular pallets per Playtner).
  - 7.1.3 — Real draw-angled locking faces, replacing `drawAngle`'s
    current role as a bare validated number with an actual face
    direction: pallet face inclined at the declared draw angle from the
    radial line at the locking point; escape-tooth locking face at
    (conventionally) double that, for point contact (Playtner: 12°
    pallet / 24° tooth). Builds on 7.1.1/7.1.2's locking-point geometry.
  - 7.1.4 — Full 2D outline construction for the pallet stones and
    escape-wheel teeth, replacing the current placeholder shapes
    (`generateEscapeWheelOutline`'s fixed trapezoid, `createForkGeometry`'s
    plain stone boxes, both in `src/geometry/assemblyGeometry3d.ts`) with
    real locking-face + lifting-face + back profiles. The capstone:
    combines 7.1.1-7.1.3 into actual renderable/checkable geometry, by
    far the largest single piece — same risk category that sank the
    trochoidal-fillet attempt (SRC-0025/ASM-0031, not shipped when its
    own verification didn't pass), so budget for a construction that may
    not close cleanly on the first attempt.
  - 7.1.5 — Fork and roller action (ruby pin, safety roller, guard pin,
    crescent, horn) — REF-ENG §9's "balance interaction," currently
    modeled only as an abstract `forkRatio` with no actual roller/pin
    geometry at all. Mostly independent of 7.1.1-7.1.4; could ship
    separately. Playtner devotes four chapters to this specifically.
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
