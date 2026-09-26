# Data Model

As implemented in `src/domain`. Lengths in metres, angles in radians.
`null` means unknown and is never defaulted. Nothing listed here stores
a derived value.

Movement
- id, name, isTeachingDemo
- declaredValidationLevel (L0–L5; set by the author, never raised automatically)
- frames, shafts, gears, gearMeshes, jewels (records by ID)
- couplings (friction clutches and mainsprings, by ID)
- tolerances (by ID; see Tolerance)
- keylessWorks (by ID; one expected, KEY-001)
- dials (by ID; one expected, DIAL-001)
- escapements (by ID; one expected, ESC-101)
- drive: null | PRESCRIBED {shaftId, angularVelocity} | NOMINAL_TIME | BALANCE
  (no energy modeled, ASM-0007; nominal time turns the minutes-hand shaft
  once per hour; BALANCE lets the balance's free frequency set the escape
  arbor's speed, ASM-0024)

Frame (mainplate or bridge; flat slab, ASM-0010)
- id, kind (MAINPLATE | BRIDGE), name
- outline: CIRCLE {centre, radius} | POLYGON {points}
- zBottom, thickness

Shaft (arbor)
- id, name
- placement: FIXED {position} | MESH_POLAR {referenceShaftId, meshId, angle} | COAXIAL {referenceShaftId}
- support: PIVOTED | STUD {frameId} | CARRIED
- hand: HOURS | MINUTES | SECONDS | null
- pivotDiameter: {LOWER, UPPER} (each Length | null)
- shoulderSpan: Length | null

Gear
- id, name, shaftId
- toothCount, module, thickness, zCentre
- profileModel (only PITCH_MODEL implemented)
- pressureAngle: Angle | null (null for a pitch model)

GearMesh
- id, drivingGearId, drivenGearId

Jewel (bearing; sits on its shaft's axis, so it has no position)
- id, name, kind (HOLE_JEWEL | PLAIN_HOLE)
- frameId, shaftId, end (LOWER | UPPER)
- boreDiameter: Length | null

Coupling
- id, kind, name, shaftAId, shaftBId
- FRICTION_CLUTCH: engaged while running, slipping while setting (ASM-0015)
- MAINSPRING: shaftA = barrel arbor, shaftB = drum; no kinematic
  constraint; fixes the winding direction (ASM-0018). spring:
  MainspringSpec | null (null = data unknown)
- MainspringSpec (SIMPLIFIED ENERGY MODEL, L3, ASM-0026): usableTurns
  (arbor turns relative to the drum, let-down → fully wound),
  fullyWoundTorque and letDownTorque (N·m; linear between them),
  trainEfficiency: 0–1 | null (ASM-0002; null = not configured, torques
  are the lossless upper bound)

KeylessWorks (ASM-0019)
- id, name
- stemDirection (plan angle toward the crown), stemHeight
- windingPinion, slidingPinion: {toothCount, module} (pitch models)
- crownWheelGearId, settingWheelGearId, ratchetGearId (ordinary gears)
- The stem's plan line passes through the crown wheel's solved axis. The
  stem position (in: winding, out: setting) is UI/simulation state, not
  part of the design.

Escapement (SIMPLIFIED ESCAPEMENT MODEL, ESC-001; ASM-0021…0023)
- id, name, kind (SWISS_LEVER), modelLevel (SIMPLIFIED_KINEMATIC)
- escapeArborShaftId; escapeWheel {toothCount, tipDiameter, thickness, zCentre}
- palletArborShaftId; leverAngle (total swing between bankings)
- pallets: PalletGeometry | null (simplified locking geometry, ASM-0025):
  spanTeeth (pitches between the locking points; k + ½), lockAngle,
  drawAngle, runAngle. lever = lock + impulse + run
- escapementEfficiency: 0–1 | null (energy per beat reaching the balance,
  ASM-0026; null = unknown)
- balanceShaftId; balance {diameter, thickness, zCentre, amplitude
  (declared; replaced in the display by the energy model's prediction
  when it has its inputs), liftAngle, inertia: kg·m² | null,
  hairspringStiffness: N·m/rad | null (both for the simplified dynamic
  model, L3, ASM-0024), qualityFactor: number | null (Q, ASM-0026)}; null
  = unknown
- The pallet arbor and balance staff are ordinary shafts that oscillate;
  they must not be gear-driven (ESC-102).

Dial (ASM-0020)
- id, name, centreShaftId, diameter, thickness, faceHeight (the −Z face)

Tolerance (declared design intent, REF-ENG §14; never manufacturing validation)
- id, entityId, dimension (SHAFT_PIVOT_LOWER | SHAFT_PIVOT_UPPER | SHAFT_SHOULDER_SPAN | JEWEL_BORE | FRAME_Z_BOTTOM | FRAME_THICKNESS)
- lowerDeviation, upperDeviation: signed Lengths from the entity's own
  nominal (so the nominal is stored once, on the entity)
- distribution: NOT_STATED | UNIFORM | NORMAL (recorded; the worst-case
  analysis doesn't use it, ASM-0017)
- source: string | null; validationScope: string
- At most one per dimension. Deleting the entity deletes its tolerances.

ValidationIssue
- id (deterministic), rule (RULE_IDS.md), severity (info | warning | error | blocker)
- entityIds, message, validationLevel, references (REF-ENG sections, ASM, SRC)

Derived, never stored: shaft axis positions, centre distances, angular
velocities (including the stem's), bearing positions, side shake,
endshake, tolerance limits and worst-case stacks, stem engagement
geometry, winding direction, energy chain (reserve, escape torque,
predicted amplitude), shaft and stem angles, the mainspring's state of
wind (simulation state, starting fully wound), and every output (report, BOM,
drawings, STL).

## Saved files (`src/persistence/designFile.ts`)

```
{ "format": "mechanical-watchmaker-3d.design",
  "schemaVersion": 7,
  "savedAt": "<ISO time>",
  "movement": { …Movement as above… } }
```

- Non-finite numbers (a user's empty or invalid entry, held as NaN) are
  written as `{"$nonFinite": "NaN" | "Infinity" | "-Infinity"}` so they
  load back unchanged instead of becoming null or 0.
- Loading checks structure strictly (types, enums, record keys matching
  entity ids) and rejects foreign files and newer schema versions with
  the exact path of the problem. It never repairs engineering problems:
  dangling references or bad dimensions load as saved and validation
  reports them.
- Changing the saved shape of Movement means bumping
  `DESIGN_SCHEMA_VERSION` and adding a migration from the previous
  version to `MIGRATIONS`. v1 → v2 turns the flat drive fields into the
  drive union, makes every shaft PIVOTED with no hand, and adds empty
  couplings. v2 → v3 adds empty tolerances. v3 → v4 adds empty keyless
  works and dials. v4 → v5 adds empty escapements. v5 → v6 adds unknown
  (null) balance inertia and hairspring stiffness. v6 → v7 adds no pallet
  geometry, unknown escapement efficiency and Q, and unknown mainspring
  data (all null).
- Autosave keeps the current design in browser storage under
  `mw3d.autosave`. An unreadable autosave is moved to
  `mw3d.autosave.unreadable` rather than overwritten.
- The project library (`src/persistence/library.ts`) keeps named designs
  under `mw3d.library`, keyed by movement id. Each entry holds a complete
  design file, so it migrates on its own. Entries that can't be opened
  stay listed with the reason. An unreadable library is moved to
  `mw3d.library.unreadable`.

## Creating and deleting (`src/domain/editing.ts`)

- New parts start with every dimension and position empty (NaN or
  null). Validation lists what is missing; nothing is guessed.
- Deleting removes the parts an entity owns: a frame's bearings; a
  shaft's gears, bearings, clutches and mainspring links (and the drive,
  if it was the drive); a gear's meshes; any entity's tolerances. The
  keyless works, dial and escapement own nothing. References that aren't ownership, such as another
  shaft's placement constraint, stay and are reported as ASSY-001.
- Every edit, load and new design is undoable (store history, 200 steps).
