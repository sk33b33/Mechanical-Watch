# Data Model

As implemented in `src/domain`. Lengths in metres, angles in radians.
`null` means unknown and is never defaulted. Nothing listed here stores
a derived value.

Movement
- id, name, isTeachingDemo
- declaredValidationLevel (L0–L5; set by the author, never raised automatically)
- frames, shafts, gears, gearMeshes, jewels (records by ID)
- couplings (friction clutches, by ID)
- drive: null | PRESCRIBED {shaftId, angularVelocity} | NOMINAL_TIME
  (kinematic inputs only, ASM-0007; nominal time turns the minutes-hand
  shaft once per hour)

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

Coupling (friction clutch; engaged while running, slipping while setting, ASM-0015)
- id, kind (FRICTION_CLUTCH), name, shaftAId, shaftBId

ValidationIssue
- id (deterministic), rule (RULE_IDS.md), severity (info | warning | error | blocker)
- entityIds, message, validationLevel, references (REF-ENG sections, ASM, SRC)

Derived, never stored: shaft axis positions, centre distances, angular
velocities, bearing positions, side shake, endshake, shaft angles.

## Saved files (`src/persistence/designFile.ts`)

```
{ "format": "mechanical-watchmaker-3d.design",
  "schemaVersion": 2,
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
  couplings.
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
  shaft's gears, bearings and clutches (and the drive, if it was the
  drive); a gear's meshes. References that aren't ownership, such as another
  shaft's placement constraint, stay and are reported as ASSY-001.
- Every edit, load and new design is undoable (store history, 200 steps).
