# Status

Validation levels use the L0–L5 scale from REF-ENG §15 (confirmed).

## Elevation drawing, and tolerances on gear/placement dimensions

- **Elevation drawing (`src/outputs/drawing/elevationDrawing.ts`).** A
  second technical drawing alongside the plan: an orthographic
  projection onto the X-Z plane (horizontal X, vertical Z, the shaft-axis
  direction, ASM-0006), viewed along Y. It draws frame bodies across
  their outline's X-extent at their Z-range, each arbor's centreline over
  the axial span it actually occupies, gear and escapement bodies at
  pitch/tip diameter and thickness (REF-ENG §6 defines no tooth profile),
  bearing markers flush with their frame's inner face (ASM-0011), the
  dial as a hidden band, and an overall-height dimension. Parts at
  different Y overlap in this single-direction view, and the keyless
  works, stem and dial hand pipes aren't shown (the stem has no single
  faithful elevation here) — both stated limitations, not silent gaps.
  Exported as SVG and DXF (`elevation-svg`, `elevation-dxf`), from the
  Outputs dialog and in the engineering report (new §4, renumbering the
  sections after it).
- **The plan and elevation renderers are now generic** (`viewLabel` on
  the shared drawing type, plus two new layers, `GEAR` and `JEWEL`, for
  the elevation's gear/escapement bodies and bearing markers); the plan
  builder is unchanged in what it draws.
- **New toleranceable dimensions:** `GEAR_MODULE` (per gear) and, only
  for a **FIXED**-placement shaft, `SHAFT_POSITION_X` / `SHAFT_POSITION_Y`
  (a solved MESH_POLAR or COAXIAL position stays untoleranced — its
  variation isn't chained through here, ASM-0027). Both appear in the
  existing generic tolerance UI (gear and shaft inspectors) with no new
  UI code.
- **Mesh centre-distance stack (`meshCentreDistanceStack`,
  `src/assembly/toleranceAnalysis.ts`).** A first-order (Taylor)
  expansion around the placement solver's own distance: exact for the
  module term (distance scales linearly with it; only the driving gear's
  declared module tolerance is read, since GEAR-003 requires one shared
  module) and a linear approximation for a FIXED shaft's position term (a
  direction cosine along the mesh's centre line, matching the same
  one-directional worst-case approach already used for side shake and
  endshake). Registered as ASM-0027. `evaluateStack`'s `StackTerm` gained
  an optional `scale` (a signed coefficient, not just ±1), used here and
  left at its default (1) everywhere else.
- **Where it shows up:** the gear inspector (a "Centre distance (tol.,
  with …)" row per mesh); the movement report's Meshes table (a "Worst
  case (tol., ASM-0027)" column, only once something is toleranced) and
  each gear's component report; the plan drawing's centre-distance
  dimension (appends "· tol min…max"); TOL-002 now also warns if a
  mesh's worst-case centre distance could reach zero; MFG-001's summary
  now mentions it.
- **On the elevation drawing:** an arbor with a toleranced endshake gets
  a dimension beside its centreline, from its lower bearing's face to its
  upper's, reusing the existing `endshakeStack` (no new derivation).
- The design file decoder's tolerance-dimension enum gained the three
  new values (a real fix: without it, saving a design with one of these
  tolerances and reloading it would fail to decode). No schema bump: the
  `Tolerance` record's shape is unchanged, only which dimension strings
  it accepts.

342 unit tests and 27 browser tests pass.

## Workspace: panel windows and focus view

- Each side panel (Components, Inspector, Validation) has a title bar
  with controls: dock, float over the movement, open in its own browser
  window (e.g. on a second screen), or hide.
- Floating panels are dragged by the title bar and resized from the
  corner, and always keep their title bar on screen.
- A separate window shares the page's styles and stays live. Selecting in
  the main window updates it, edits made in it change the design, and
  undo/redo shortcuts work there too. Closing it docks the panel back. If
  the browser blocks the window, the panel floats instead and says why.
- The header has a button per panel (hide, or reopen where it was) and
  **Focus**, which hides the docked panels so the movement fills the
  window. Panels opened in focus view float.
- The simulation readouts (time, dial reading, spring wind and reserve)
  moved from the toolbar onto the viewport, so the toolbar no longer
  overflows at 1400 px and the readouts stay visible in focus view.
- Docked panels resize by dragging their inner edge (the one facing the
  movement). The handle also takes the arrow keys (Shift for bigger
  steps, Home/End for the limits); double-click restores the default
  size. Each panel has a minimum size, and the movement view never
  shrinks below 320 × 200 px. When the browser window gets smaller the
  panels give way, and they return to the chosen sizes when it grows.
- The layout is remembered per browser. A separate window reopens in the
  page after a reload, since browsers only open windows on a click.
- SIM-003's wording no longer says no power reserve is modeled; it now
  points to the separate simplified energy model.

319 unit tests and 25 browser tests pass.

## Pallet geometry (L1) and the energy chain (L3)

- **Pallet geometry (ASM-0025).** Optional per escapement: span in
  teeth, lock, draw and run angles. The pallets lock on the escape
  wheel's tip circle at two points (k + ½) pitches apart, and the pallet
  arbor must sit where the tangents at those points meet, R / cos(span/2).
  ESC-104 flags a whole-tooth span, a span of 180° or more and a pallet
  arbor off that distance. ESC-105 flags lock and run that leave no
  impulse within the lever angle, and warns about a draw angle that isn't
  positive. Whether the draw overcomes friction is not checked. The
  viewport puts the pallet stones on the locking points.
- **Mainspring data (ASM-0026).** Optional on the mainspring link:
  usable turns, torque fully wound and let down (linear between them),
  and an optional train efficiency (ASM-0002, now Active). Without an
  efficiency, torques are the lossless upper bound, and are labelled so.
- **Energy chain.** Power reserve from the drum's running speed; escape
  wheel torque by power balance through the train; energy per beat =
  torque × π/z × escapement efficiency; steady amplitude where the energy
  in per period balances the loss 2πE/Q, A = √(2 Q E_beat / (π k)). The
  balance stops once the amplitude falls to half the lift angle, which
  gives a stop wind and a running reserve. SPR-001 checks the spring
  data, SPR-002 reports the chain and names what the amplitude still
  needs, SPR-003 warns when the balance stops before let-down (error when
  it cannot start even fully wound).
- **No invented losses.** Q and the escapement efficiency can only come
  from measurement or a source, so the teaching movement leaves both
  unknown. It shows the reserve (39 h) and the lossless escape torque,
  and keeps its declared amplitude.
- **Simulation.** The mainspring's state of wind is simulation state,
  starting fully wound. The running drum unwinds it; winding at the crown
  winds it, clamped at let-down and fully wound. A balance-governed
  movement stops at the stop wind (or at let-down when the amplitude
  can't be predicted): the balance rests and the fork lies on a banking.
  Winding above the stop restarts it (the model assumes it self-starts).
  The stop is checked before every fixed step, so it happens at the same
  step however frame time is split (SIM-002). An imposed drive (nominal
  time, prescribed) keeps turning when let down. The toolbar shows the
  wind and the running time left; when predicted, the displayed amplitude
  follows the wind (A ∝ √T).
- **Outputs.** The escapement's component report and the movement
  report add the pallet values (L1) and the energy chain (L3) with their
  equations. The BOM lists the pallet angles and the spring data.
- Design files move to schema 7.
- The movement's declared level stays capped at L2.

303 unit tests and 20 browser tests passed at that point.

## Balance dynamics: simplified dynamic model (L3)

- **Inputs.** The balance takes an optional moment of inertia (mg·cm²)
  and hairspring stiffness (µN·mm/rad), stored in SI. Empty means
  unknown, and the model stays kinematic. They are entered directly;
  nothing is derived from material or hairspring geometry.
- **Model.** A linear, undamped torsional oscillator: f = √(k/I)/2π
  (ASM-0024). It is isochronous by construction. Amplitude, escapement
  disturbance, position, temperature and damping are not modeled, so it
  is not a complete regulator model.
- **The balance governs.** A new drive, "Governed by the balance", sets
  the escape arbor to one tooth per balance period (ASM-0021), turning
  the way that runs the hands forward. The train follows, so the hands
  run fast or slow by however much the balance differs from what nominal
  time needs.
- **Derived.** Free frequency, the frequency nominal time needs, the
  hairspring stiffness that would give it for the entered inertia, and
  the predicted daily rate (s/day). BAL-002 reports them at L3, with the
  limits stated. BAL-001 checks the inputs and that a balance-governed
  drive can run.
- **Teaching movement.** Now governed by its balance: 10 mg·cm² and
  246.7 µN·mm/rad (illustrative, ASM-0009) give 2.4998 Hz against the
  2.5 Hz nominal needs, so the model predicts about −7 s/day. The
  stiffness is deliberately a rounded entered value, not solved from the
  train. Tests of exact nominal speeds use an explicit nominal-time
  variant.
- The movement's declared level stays capped at L2. Only the balance
  model is L3; the train still has no torque or energy model.
- Design files move to schema 6.

272 unit tests and 16 browser tests pass.

## Phase 5 — Escapement: simplified kinematic model

A Swiss lever escapement labelled SIMPLIFIED ESCAPEMENT MODEL (ESC-001),
at the kinematic level (L2):
- **Rate.** Two beats per escape tooth (ASM-0021, a declared assumption
  with the source pending, accepted). The beat rate and the balance
  frequency the train requires come from the escape arbor's speed. The
  teaching movement gives 18 000 beats/h and 2.5 Hz (escape arbor at
  10 rev/min, 15 teeth).
- **Balance.** A sinusoidal swing at a declared amplitude (ASM-0022). No
  inertia, hairspring or damping is modeled, so the amplitude is an
  input, and the balance does not set the rate: the drive does.
- **Ticking.** The going train is shown locked between beats and released
  in an impulse window. The window is the share of each swing spent
  within half the lift angle of the dead point, so it follows from lift
  angle and amplitude. The pallet fork crosses between its bankings in
  the window (ASM-0023). The simulation keeps the average motion; the
  ticking is a derived display, so hand readings and measurements are
  unaffected. While the crown sets the hands, they move freely and the
  going train keeps ticking.
- **Validation.** ESC-001/002 state the model level and what it does not
  claim. ESC-101 checks references and inputs (amplitude above half the
  lift angle). ESC-102 flags a gear-driven pallet arbor or balance.
  ESC-103 checks clearances. The oscillating arbors are no longer
  reported as unpowered.
- **UI and outputs.** An inspector section with the derived beat rate,
  balance frequency and impulse window, "+ Escapement", and a viewport
  label. The escape wheel, fork and balance are drawn with visual
  shapes. The report, BOM and plan drawing include the escapement; the
  hairspring, roller and stones are listed as not modeled.
- **Teaching movement.** Adds a balance cock, pallet arbor and balance
  staff with jewels, and a 15-tooth escape wheel (tip Ø 4.6 mm). The
  amplitude (270°), lift (50°) and lever angle (10°) are illustrative
  inputs (ASM-0009), not sourced values.

258 unit tests and 15 browser tests pass.

## Browser test suite: added

`npm run test:e2e` runs 12 Playwright tests against the production build
(see docs/ARCHITECTURE.md, Testing). Writing them exposed one bug, now
fixed: a field that commits its unchanged value again on blur added a
second, identical undo step, so one edit could need two undos. Edits
that change nothing are no longer recorded.

## Dial and keyless works: complete

- **Model.** Keyless works (stem direction and height, winding pinion,
  sliding pinion, crown wheel, setting wheel, ratchet wheel), a dial (a
  disc on the dial side, centred on an arbor), and a mainspring link from
  the barrel arbor to its drum. The mainspring carries no energy; it
  fixes which way winding turns the arbor (ASM-0018). Schema 4.
- **Right-angle meshes (ASM-0019).** The stem lies flat. Its pinions
  engage their wheels at right angles, modeled as rolling pitch circles:
  the ratio comes from tooth counts, the direction from the layout (stem
  above or below the wheel). Derived and checked against an independent
  3D velocity test. KEY-002 checks each engagement geometrically: the
  wheel's axis on the stem line, and the stem one pitch radius from the
  wheel.
- **Setting through the crown.** Crown out: the sliding pinion drives
  the setting wheel → minute wheel → cannon pinion, the friction clutch
  slips, and the going train keeps time. The hands' speed follows from
  the ratios (teaching movement: 2 minute-hand turns per crown turn).
- **Winding.** Crown in: turned the winding way, the ratchet teeth drive
  the winding pinion → crown wheel → ratchet wheel → barrel arbor. The
  winding way is derived: the one that turns the arbor the way the drum
  runs. Turned the other way, the teeth slip and nothing is wound. The
  click holds the ratchet otherwise, and a running train that turns the
  ratchet is reported (KEY-003).
- **UI.** The toolbar modes are Running, crown out (set forward or
  backward), and crown in (wind, or turn backward). The crown turns at
  1 rev/s. The inspector shows the stem, pinions, wheel choices,
  engagement errors, winding direction and crown ratios, and there is a
  mainspring editor on arbors. The viewport draws the dial with hour
  markers (it can be hidden), hands below the dial face, and the stem,
  crown and pinions turning; the crown moves out when pulled. Without
  keyless works, setting still turns the minutes hand directly.
- **Validation.** KEY-001…004 and DIAL-001…003 (dial dimensions, clear
  of everything it covers, every hand over it).
- **Outputs.** The report has a crown section and component reports for
  the keyless works and dial. The BOM lists the stem, crown, pinions,
  lever/yoke and click (unmodeled parts marked so) and the dial. The plan
  drawing shows the dial as a hidden outline and the stem with its
  pinions edge-on. The STL includes the dial.
- **Teaching movement.** It gains a barrel arbor with a 40-tooth ratchet
  wheel and mainspring, a 20-tooth crown wheel, a 16-tooth setting wheel
  meshing the minute wheel, a stem at 3 o'clock (winding pinion 14,
  sliding pinion 20, module 0.1) and a 28 mm dial. All values are
  illustrative (ASM-0009). The ratchet and crown wheel sit just above the
  mainplate, with the crown wheel above the stem, so the winding pinion
  (14 teeth) engages it from below. The derived winding direction is
  clockwise seen from the crown.

233 tests pass. Checked in a browser:
- setting through the crown (3 h of hand motion in 1.5 s);
- winding, and the slipping notice when turned backward;
- the dial view with the crown at 3 o'clock, and the dial hidden;
- the stem, crown and pinions turning.

## Phase 6 — Engineering outputs: complete (Phase 5 not started)

Phase 6 was done before Phase 5 because it needs no new engineering
data. Phase 5 is waiting on a source for the escape-wheel/beat
relationship.

- **Tolerance model (REF-ENG §14).** Pivot and bore diameters, shoulder
  span, and frame position and thickness can carry a tolerance: signed
  lower/upper deviations from the model's own nominal, plus distribution,
  source and "checked against". A new tolerance starts with empty limits;
  no default band is assumed. Side shake and endshake get worst-case
  stacks (min … max), and each stack says whether all, some or none of
  its inputs are toleranced (ASM-0017). New rules:
  - TOL-001: a tolerance must be well formed;
  - TOL-002: warns when a nominally positive clearance can close within
    the declared tolerances;
  - MFG-001: a reminder that tolerances are declared intent and
    everything else is nominal.

  Design files move to schema 3, with a v2 migration.
- **Outputs… (toolbar)** lists each format with the model level it
  represents:
  - **Engineering report** (HTML, open or download, printable). It opens
    with a claims box: declared level and whether it is met, issue
    counts, tolerance status, and "manufacturing readiness: not
    validated (MFG-002)". Then validation, the gear train (ratios, ideal
    and placed centre distances), arbor speeds and directions, the plan
    drawing, BOM, tolerances, per-part component reports (entered
    parameters, then derived values with equation, level and basis) and
    the assumption register, with cited entries marked.
  - **Bill of materials** (CSV): one row per modeled part, with gears
    nested under their arbor. Material is "not specified", and a clutch
    is a note, not a part.
  - **Plan drawing** (SVG and DXF R12): frame outlines, axes (coaxial
    arbors share one mark), pitch circles, and centre-distance
    dimensions (the ideal distance is added when the placed one
    differs), plus a gear table. It is nominal and labelled "not a
    manufacturing drawing". The scale is chosen to fit a page; the DXF
    is 1:1 in mm.
  - **Visual mesh** (STL, mm): frames and gears as drawn, labelled L0,
    because tooth shapes are visual (ASM-0005).
  - **Solid model** (STEP): listed as unavailable. It would need a
    B-rep kernel and real tooth profiles; a pitch model has no flank to
    export.
- Every output is a pure function of the design model and its analysis.
  None reads the viewport.

203 tests pass. Checked in a browser:
- entering pivot and bore dimensions and their tolerances (TOL-001 while
  a limit is empty, TOL-002 when the worst case closes the side shake);
- downloading every format, and opening the report and drawing;
- STEP disabled with its reason.

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
- **Right-angle (stem) mesh relationship.** Derived here from rolling
  pitch circles and tested. Two candidate citations are recorded,
  SRC-0007 (ISO 23509:2016) and SRC-0008 (SDP/SI), but neither has been
  read: this environment's network policy blocks the sites, and ISO
  23509 is paid. Both cover generic machine bevel gears, so a
  horological source for contrate or winding gearing would be better.
- **Two beats per escape tooth (ASM-0021).** Accepted as a declared
  assumption for the simplified model; a source should be recorded under
  `reference/sources/03-escapements/` (e.g. SRC-0004, not yet read).
- **Oscillator equation (ASM-0024).** Standard linear-oscillator physics,
  marked DERIVED with the citation pending, like the gear equations.
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
- Resizing the viewport (docking, floating or closing panels, focus
  view) keeps the camera where it is; it does not re-fit the movement.
- The camera is framed once per loaded design or view change. A design
  built up from empty keeps the default view until you orbit or switch
  view.
- Keyless works: the setting lever, yoke, springs, click geometry and
  the ratchet teeth' form are not modeled. The stem's two positions stand
  for them. The stem passes through the mainplate slab (grooves are not
  modeled, ASM-0010), and stem parts aren't checked for interference.
  There is no stop-seconds (hacking) and no third crown position (date).
  Winding moves the spring's state of wind, but winding torque, the
  slipping bridle and a spring's hysteresis are not modeled.
- Escapement: no drop, impact or sliding contact, and no tooth or
  pallet faces; locking is checked only as tangential locking points
  (ASM-0025); the balance is a sinusoid at a declared or predicted
  amplitude, and amplitude does not change its rate (isochronous,
  ASM-0024); the escape
  wheel's tooth form, the fork and the balance's arms are visual. The STL
  omits the escapement parts. The toolbar's dial reading follows the
  average motion, not the ticks.
- The dial has no feet or holes. The hand pipes that pass through it are
  not checked.
- Only worst-case stacks exist; distributions are recorded, not used. A
  mesh's centre-distance stack is a first-order approximation for a
  FIXED shaft's position term (exact for module, ASM-0027), and only a
  FIXED shaft's own position can be toleranced — a solved (MESH_POLAR,
  COAXIAL) position can't be, so its variation isn't chained through.
- The plan drawing is a single view; the elevation is a single
  projection direction (X-Z, along Y) with no hidden-line removal, so
  parts at different Y overlap. Neither has a detail drawing per part,
  and only the centre-distance (plan) and endshake (elevation)
  dimensions carry a tolerance annotation. Dimensions can crowd where
  several axes are close.
- The STL leaves out arbors and jewels (placeholder sizes, ASM-0012), and
  frames are solid slabs without bearing holes.

## Next (see `docs/ROADMAP.md`)

- Elevation/plan follow-ups, if useful: a section (cut) drawing with
  filled faces, tolerances on gear placement other than a FIXED shaft's
  own coordinates (chaining through MESH_POLAR/COAXIAL), a chosen or
  auto-fit elevation projection direction instead of the fixed X-Z one.
- Escapement beyond the simplified models: sourced or measured values
  for Q and escapement efficiency; tooth and pallet faces (drop, impulse
  geometry); amplitude-dependent rate; sources for ASM-0021, ASM-0024,
  ASM-0025 and ASM-0026.
