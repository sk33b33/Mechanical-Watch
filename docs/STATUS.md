# Status

## Milestone 1: complete, aligned with the engineering reference pack

A two-gear kinematic sandbox (`docs/MASTER_BUILD_PROMPT.md` "First milestone"):
TypeScript/Vite/Three.js, SI domain units, parametric gear math, a
Gear/Shaft/GearMesh domain model, a deterministic gear-train solver, a
domain-driven viewport, an inspector and an always-visible validation
console.

After `reference/` was added, the code was brought in line with it:

- **Rule IDs and severities.** Validation issues use the rule IDs in
  `reference/validation/RULE_IDS.md` and the four severities
  (info/warning/error/blocker). Each issue cites its basis (REF-ENG
  section, assumption or source). Issue IDs are deterministic.
- **Validation levels.** The code uses the L0–L5 levels (REF-ENG §15).
  A movement declares its target level (the demo declares L2 Kinematic).
  The UI shows whether that level is satisfied and never raises it.
- **No invented constants.** The unsourced 4-tooth minimum and 20°
  default pressure angle are gone. GEAR-001 only requires a positive
  integer, and a PITCH_MODEL gear has no pressure angle (`null`, shown
  as "not modeled"). The visual tooth proportions, numerical tolerances
  and the simulation timestep are named config objects tied to
  registered assumptions (ASM-0005, ASM-0008).
- **Profile scope.** Gears carry `profileModel` (REF-ENG §6). Only
  `PITCH_MODEL` exists, and meshing different profile models is a
  GEAR-003 error.
- **Interference.** Overlapping pitch circles are an ASSY-002 error.
  Overlap of only the visual tooth tips is an L0 warning citing
  ASM-0005, because tip geometry isn't modeled.
- **Deterministic simulation (SIM-002).** A fixed-timestep accumulator
  replaces frame-time stepping. A non-finite state halts the simulation
  with a SIM-001 blocker.
- **User input is never altered.** 6.5 teeth is kept and flagged, not
  truncated. An empty field is "no value" (NaN), not 0. Edits commit on
  change, so typing isn't interrupted.
- **Assumptions are visible.** The left panel lists every registered
  assumption. The header shows teaching-demo status, the declared level
  and "physical validation pending". SIM-003 always states that the
  drive is prescribed, not an energy source.
- **New math.** §5.4 torque takes an optional efficiency that must cite a
  source or assumption; there is no default η. §5.5 pitch-line velocity
  is added.
- **Traceability.** `reference/TRACEABILITY.md` maps each equation to
  its code, basis, assumptions, evidence state, level and tests.
  `reference/sources/SOURCES.yml` gives SRC IDs to the indexed sources,
  with metadata only as far as the index provides it.

60 unit tests pass, including register/code sync checks. Typecheck, lint
and build are clean. Verified in a browser with real keyboard input.

## Open decisions

- **Validation-level scheme.** CLAUDE.md and the reference pack define
  different scales. The code adopts L0–L5 with a mapping (see CLAUDE.md,
  "Validation levels"). Confirm or choose otherwise.
- **External citations for gear equations.** REF-ENG §5 cites no primary
  source for d = m z etc. They are marked DERIVED with the citation
  pending.

## Not yet implemented (see `docs/ROADMAP.md`)

- Creating/deleting components in the UI; the demo is fixed and only
  parameters can be edited.
- Assembly constraints beyond shaft placement; pivots, jewels and
  bearings (REF-ENG §12).
- Persistence / save-load.
- Exploded view, section view, measurement tools.
- Involute profile (REF-ENG §6), torque in the solver, motion works
  (§8), escapement (§9), balance/hairspring (§10), mainspring (§11).
- Tolerance model (§14) and any export.
