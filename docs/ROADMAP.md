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

- 7.1 — Pallet/escape-wheel contact geometry (lift, lock, draw, drop
  faces), replacing ASM-0025's tangential-locking-point abstraction.
  Moderate sourcing risk (standard lever-escapement geometry is in
  recognized watchmaking texts).
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
- 7.5 — Nonlinear mainspring torque curve and bridle slip (REF-ENG §11;
  ASM-0026 is currently a straight line between two entered points).
  Research-risk; movement-specific curves are usually proprietary.
- 7.6 — Positional and temperature effects (REF-ENG §10's "Physical
  model"). Depends on 7.3. Highest research risk.

Order: 7.1 before 7.2; 7.3 independent (recommended first); 7.4/7.5 can
run in parallel as research; 7.6 depends on 7.3.
