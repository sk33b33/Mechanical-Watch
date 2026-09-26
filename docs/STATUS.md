# Status

Validation levels use the L0–L5 scale from REF-ENG §15 (confirmed).

## Phase 4 — Watchmaker workspace: complete

- **Measurement tool.** Measure, then pick two parts (viewport or tree).
  The values come from the design model and solved placement, never
  from rendered meshes. Each row states its model level and basis
  (hover):
  - axis distance;
  - axial gap or overlap;
  - pitch-circle clearance (L1);
  - drawn tip clearance for unmeshed gears (L0, ASM-0005);
  - for meshed pairs, ideal centre distance and deviation.
  A line marks the measured pair.
- **Exploded view.** A slider spreads parts along the shaft axes,
  stretching positions but not thicknesses.
- **Section view.** A vertical cutting plane set by angle and offset, or
  placed through the selected part's axis.
- Both views are **display only**. They never change the design,
  validation or measurements (checked: measured values are identical
  when exploded).
- **Project library.** Projects… lists designs saved in this browser,
  with save, open (undoable) and delete. Entries that can't be opened
  stay listed with the reason, and a damaged library is set aside, not
  overwritten. Downloaded files remain the durable copy.
- The assembly tree and validation console from earlier phases complete
  the workspace. The toolbar now fits down to 1280 px without scrolling
  the page.

159 tests pass. Checked in a browser: measuring meshed gears and
frames, explode and section (including through a selected arbor), and
saving, switching, reloading and deleting library projects.

## Phase 3 — Kinematic movement: complete

- **Time display as the requirement.** Arbors can carry the hours,
  minutes or seconds hand. TIME-002 checks the train's ratios against a
  12-hour dial (1 : 12 : 720, all clockwise from the dial) and reports
  the period a wrong hand would actually have. These rates are
  definitions of reading a dial (ASM-0014), not watch specifications.
- **Nominal-time drive.** Besides a prescribed arbor speed, the train
  can run "at nominal time": the minutes hand is prescribed at 1 rev/h
  and every other arbor's rotation (barrel, escape arbor…) is derived
  and shown in its inspector. A prescribed drive reports how far from
  nominal the hands run (TIME-004).
- **Motion works as a separate subsystem (REF-ENG §8).** Coaxial
  placement, parts carried on another arbor or on a stud, and friction
  clutches. Running: the clutch turns with its arbor. Setting the hands:
  the clutch slips, the hands move at 1 h per second, and the going
  train keeps its running speed (ASM-0015). SET-001 warns when the hands
  can't be set without turning the train, and CPL-001 requires a
  clutch's two parts to be coaxial.
- **Teaching movement (new default).** Barrel 72 → centre pinion 12;
  centre wheel 80 → third 10; third 75 → fourth 10; fourth 80 → escape
  pinion 8. Motion works: cannon pinion 10 → minute wheel 30, minute
  pinion 8 → hour wheel 32 (10 + 30 = 8 + 32, so the coaxial cannon
  pinion and hour wheel share one centre distance). At nominal time the
  barrel turns once per 6 h, the fourth arbor once per minute and the
  escape arbor once per 6 s. It validates with no errors or warnings.
  All values are illustrative (ASM-0009). The escape wheel itself is
  not modeled (not a gear; Phase 5).
- **UI.** Mode switch (running / set hands forward / backward), dial
  reading from the simulated hand angles, hands drawn on the dial side
  (visual only, ASM-0016), bridge-side and dial-side views, inspector
  controls for hand, support, coaxial placement, clutches and drive.
- **Save format v2**, with a migration that opens v1 files unchanged in
  meaning.

145 tests pass. Checked in a browser: 60× playback, hand setting
forward and backward (hands advance hours while the seconds hand keeps
time), removing the clutch (SET-001, setting refused), undo, the dial
view, and opening a schema-1 file saved in an earlier session.

## Working tool: save/load, simulation controls, building from scratch — complete

- **Save / Open / autosave.** Versioned JSON (schema 1). Invalid
  entries survive a round trip unchanged. Foreign files, newer versions
  and malformed files are rejected with the exact path of the problem.
  Every change autosaves to the browser, and an unreadable autosave is
  set aside, not overwritten.
- **Simulation controls.** Play/pause, single step, reset, playback
  speed 0.1× to 60×, and a simulated-time readout. The simulation still
  advances in fixed steps.
- **Drive editing.** Make any arbor the drive, set its speed in rev/min,
  or remove it (SIM-001 when the speed is missing; KIN-001 info when
  there is no drive).
- **Build from scratch.** New → Empty movement or Demo template. Add a
  mainplate, bridge or arbor from the component list, and add gears,
  meshes and bearings from the inspector. New parts start empty and
  validation lists what is missing.
- **Editing.** Rename anything. Edit frame outlines (circle or polygon
  points), kind, height and thickness. Switch an arbor between fixed
  coordinates and mesh-centre-distance placement, and choose its mesh.
  Change bearing type. Set the movement's name and declared level (L0–L2;
  higher levels are disabled because no model supports them).
- **Delete and undo.** Deleting removes owned parts; other shafts'
  constraints are left and reported, never re-placed silently. Undo/redo
  (toolbar, Ctrl+Z / Ctrl+Shift+Z) covers every edit, delete, New and
  Open.

121 tests pass, including one that builds a valid two-arbor movement from
an empty one. Checked in a browser by building a complete movement from
scratch through the UI to zero errors, then deleting, undoing and
redoing.

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

- **Sources for the teaching movement's tooth counts.** They satisfy the
  dial ratios by construction, but aren't taken from any caliber. For a
  movement meant to match a real one, the counts need a source recorded
  under `reference/sources/09-movement-specific/`.
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
- The selected-arbor highlight is hard to see behind large wheels.
- The section view has no caps: cut parts show their hollow inside
  rather than a filled cross-section.
- Measurements are between whole parts. There is no point-to-point
  picking on surfaces yet.
- Long dropdown labels are truncated in the narrow inspector.
- The camera is framed once per loaded design or view change. A design
  built up from empty keeps the default view until you orbit or switch
  view.
- No dial or keyless works are modeled. Hand setting is applied
  directly to the minutes-hand arbor.

## Next (see `docs/ROADMAP.md`)

- A dial and keyless works (winding and setting), if you want hand
  setting driven through a real setting train.
- Phase 5 escapement: escape wheel, pallet fork and balance as a
  separately declared, simplified model (ESC-001/002). It needs a source
  for the escape-wheel/beat relationship before any beat rate is shown.
