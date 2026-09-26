# Architecture

## Data flow

Domain model (authoritative)
→ placement solve (shaft axes from constraints)
→ gear-train solve (angular velocities)
→ validation (structured issues)
→ fixed-step kinematic simulation (shaft angles)
→ geometry generation → Three.js rendering

`src/analysis/analyzeMovement.ts` runs the solves and validation once
per edit. The store owns the movement, the derived analysis, undo
history, selection and simulation playback. The UI and viewport only
read them and submit pure domain updates via `store.edit(fn)`,
`store.remove(id)` or `store.load(movement)`, all of which are undoable.
Playback (play/pause, speed) is UI state and never part of the design.

## Layers

### Domain (`src/domain`)
Authoritative mechanical model: `Movement`, `Frame`, `Shaft`, `Gear`,
`GearMesh`, `Jewel`. Stable IDs, pure update functions. No stored
derived values: shaft positions, bearing positions, centre distances and
clearances are always computed.

### Units (`src/units`)
Branded SI types (`Length`, `Angle`, `TimeSpan`, `AngularVelocity`,
`Torque`, `LinearVelocity`). Conversions to mm, degrees and rev/min
exist only here and at the UI boundary.

### Math (`src/math`)
Gear equations (REF-ENG §5) and 2D geometry (`vec2`).

### Kinematics (`src/kinematics`)
Placement constraints (`solvePlacement`), mesh geometry and the
gear-train solver.

### Assembly (`src/assembly`)
Axial geometry: frame and gear height ranges, bearing support, side
shake, endshake, arbor spans.

### Geometry (`src/geometry`)
Mesh generation for the viewport: gear outlines (L0 visual, ASM-0005),
frame slabs, placeholder arbors and jewels (ASM-0012). Validation never
reads these.

### Simulation (`src/simulation`)
Deterministic fixed-step integration of shaft angles (SIM-002).

### Validation (`src/validation`)
Rule families in `rules/`, each `(context) => ValidationIssue[]`, sharing
one solved context. Rule IDs come from `reference/validation/RULE_IDS.md`.

### Persistence (`src/persistence`)
Versioned design file format, a strict structural decoder for untrusted
input, and browser autosave. See `docs/DATA_MODEL.md`.

### Reference (`src/reference`)
Code mirrors of the assumption register, rule IDs, validation levels and
numerical parameters. Tests keep them in sync with `reference/`.

### UI (`src/app`, `src/viewport`)
Panels, inspector, validation console and the Three.js viewport. UI code
never calculates engineering relationships.

## Coordinate convention

Movement coordinates, in metres. X and Y lie in the mainplate plane;
Z is the shaft axis direction (ASM-0006), increasing from the mainplate
toward the bridges. z = 0 is set by the design (the demo puts it at the
mainplate underside). Angles are measured from +X, counter-clockwise,
looking down from +Z (the bridge side). Positive angular velocity is
counter-clockwise from the same view.
