# Status

Validation levels use the L0–L5 scale from REF-ENG §15 (confirmed).

## Phase 2 — Movement assembly: complete

- **Placement constraints.** A shaft is either FIXED or placed at a
  mesh's ideal centre distance from a reference shaft (MESH_POLAR).
  Positions are solved in dependency order. Changing tooth counts or
  module moves dependent shafts because the user declared the
  constraint. Cycles, dangling references and invalid meshes are
  reported (ASSY-001), never guessed.
- **Frames.** Mainplate and bridges are flat slabs (ASM-0010) with
  circle or polygon outlines, a height and a thickness.
- **Bearings.** Jewels (or plain holes) support each shaft end in a
  frame. They sit on the shaft's solved axis, so a shaft's two bearings
  are always coaxial. Pivot diameters, bores and shoulder span are
  optional: unknown stays null, and side shake and endshake are computed
  only from values actually given. They are never judged against a
  range, because no range has a source (BRG-005).
- **Wheel placement in 3D.** Every gear has an axial position. Meshing
  requires axial overlap (GEAR-101).
- **Interference (ASSY-002) in 3D.** It covers:
  - unmeshed gears at the same height;
  - two gears on one arbor;
  - a gear inside a frame slab;
  - a wheel crossing another shaft's arbor.
- **Viewport.** Frames, arbors, jewels and gears drawn at their solved
  positions and heights. Click any part to select it. Parts with unknown
  sizes are drawn at placeholder sizes (ASM-0012).
- **Inspector.** Sections for gears, arbors (placement, pivots,
  clearances), bearings and frames. The tree groups parts under their
  arbors, and clicking an issue selects the part it concerns.
- **Demo.** A three-arbor compound train (60/10, 48/8, plus an output
  wheel) in a mainplate and one bridge. All dimensions are illustrative
  (ASM-0009), bearing dimensions are unknown, and it validates with no
  errors or warnings.

89 unit tests pass, typecheck, lint and build are clean, and it was
checked in a browser: edits propagate through placement, unknown
dimensions round-trip, and picking and issue selection work.

## Earlier work

- Milestone 1 / Phase 1: gear math, gear-train solver, viewport,
  inspector, validation console.
- Reference-pack alignment: rule IDs, severities, cited bases, no
  invented constants, deterministic simulation, assumption register,
  traceability (`reference/TRACEABILITY.md`).

## Open decisions

- **External citations for gear equations.** REF-ENG §5 cites no primary
  source for d = m z etc. They are marked DERIVED with the citation
  pending.
- **Side-shake convention (ASM-0013).** Reported as diametral clearance
  until a source confirms the horological convention.
- **Acceptable bearing clearances.** Side shake and endshake are
  computed but not judged. Judging them needs sourced ranges.

## Known limitations

- Arbor diameters aren't modeled. The wheel/arbor check treats the
  arbor as its axis line, a lower bound.
- Frame outlines are read-only in the UI. Parts can't yet be
  added or removed from the UI; the demo is the only movement.
- The selected-arbor highlight is hard to see behind large wheels.

## Next (see `docs/ROADMAP.md`)

- Persistence with a versioned schema (Phase 0 "design serialization"
  is still outstanding).
- Phase 3, kinematic movement: barrel, centre/third/fourth/escape wheels,
  and motion works as a separate subsystem with a slipping cannon pinion
  (REF-ENG §8).
- Phase 4 workspace: exploded view, section view, measurement tools.
