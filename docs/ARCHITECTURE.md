# Architecture

## Data flow

Domain model (authoritative)
→ placement solve (shaft axes from constraints)
→ gear-train solve (angular velocities)
→ validation (structured issues)
→ fixed-step kinematic simulation (shaft angles)
→ geometry generation → Three.js rendering
→ engineering outputs (report, BOM, drawings, exports), from the same model and analysis

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
gear-train solver. The solver's bodies are shafts (turning about +Z) and
the stem's two bodies (stem with crown and sliding pinion; winding
pinion), which turn about the stem direction. Right-angle stem meshes,
the ratchet teeth and the click are edges and seeds in the same graph
(`keylessGeometry.ts`, ASM-0019). Modes: running, direct hand setting
(no keyless works), winding and crown setting. `keylessSummary.ts`
derives the winding direction and crown ratios for the UI and outputs.
`balance.ts` holds the simplified dynamic balance (L3, ASM-0024), and
`balanceSummary.ts` compares its free frequency with what nominal time
needs. Under the BALANCE drive, the solver seeds the escape arbor from
the balance's frequency.

### Assembly (`src/assembly`)
Axial geometry: frame and gear height ranges, bearing support, side
shake, endshake, arbor spans. Measurements between parts. Worst-case
tolerance stacks (`toleranceAnalysis.ts`, ASM-0017).

### Outputs (`src/outputs`)
Pure functions from `(movement, analysis)` to documents. Component
reports and the BOM are data; the HTML report, CSV, SVG, DXF and STL
are renderings of that data. `exporters.ts` is the registry: each format
declares the model level it represents and its caveats, and formats that
can't be produced honestly (STEP) are listed with the reason. Outputs
round only for display and never read the viewport.

### Geometry (`src/geometry`)
Mesh generation for the viewport: gear outlines (L0 visual, ASM-0005),
frame slabs, placeholder arbors and jewels (ASM-0012). Validation never
reads these.

### Simulation (`src/simulation`)
Deterministic fixed-step integration of shaft angles (SIM-002). The
simulation state holds the train's average motion. `escapementDisplay.ts`
derives, from simulated time, the balance and fork angles and how far
each escapement-governed arbor is held back between beats, so the
viewport shows the train ticking without changing the simulation state
(ASM-0023). The beat rate and impulse window come from
`src/kinematics/escapement.ts`.

The state also holds each mainspring's state of wind (ASM-0026),
integrated from the arbor and drum speeds. `advanceSimulation` accepts a
state-dependent solution source, which the store uses to switch to a
stopped going train (`solveGearTrain` with `goingTrainStopped`) at the
exact step a balance-governed movement runs down; the energy chain
itself (`src/kinematics/energySummary.ts`) is derived from the running
solve, like validation.

### Validation (`src/validation`)
Rule families in `rules/`, each `(context) => ValidationIssue[]`, sharing
one solved context. Rule IDs come from `reference/validation/RULE_IDS.md`.

### Persistence (`src/persistence`)
Versioned design file format, a strict structural decoder for untrusted
input, browser autosave, and a project library in browser storage. See
`docs/DATA_MODEL.md`.

### Reference (`src/reference`)
Code mirrors of the assumption register, rule IDs, validation levels and
numerical parameters. Tests keep them in sync with `reference/`.

### UI (`src/app`, `src/viewport`)
Panels, inspector, validation console and the Three.js viewport. UI code
never calculates engineering relationships.

Workspace views are display only. The exploded view stretches axial
positions (not thicknesses), and the section view clips with a vertical
plane. Neither changes the design, validation or measurements.
Measurements (`src/assembly/measure.ts`) are computed from the design
model and solved placement at assembled positions. The viewport only
draws an indicator line.

## Coordinate convention

Movement coordinates, in metres. X and Y lie in the mainplate plane;
Z is the shaft axis direction (ASM-0006), increasing from the mainplate
toward the bridges. z = 0 is set by the design (the demos put it at the
mainplate underside). Angles are measured from +X, counter-clockwise,
looking down from +Z (the bridge side). Positive angular velocity is
counter-clockwise from the same view.

The dial is on the −Z side of the mainplate (ASM-0014), so a positive
angular velocity is clockwise seen from the dial, which is how hands
turn. A hand at shaft angle 0 points along +Y, which is 12 o'clock.

Kinematic modes: validation always uses the running solve (clutches
engaged). The simulation integrates either the running solve or, while
setting the hands, a solve where clutches slip and the minutes-hand side
is driven by the setting input (REF-ENG §8, ASM-0015).

## Testing

- `npm test`: unit tests (Vitest) for every formula, rule, solver mode,
  persistence path and output generator.
- `npm run test:e2e`: browser tests (Playwright, `e2e/`) against the
  production build (`vite build` + `vite preview` on port 4174). Each test
  starts from a clean browser profile with the teaching movement and fails
  on any uncaught page error. They cover loading and validation, editing
  and undo, autosave, setting and winding through the crown, the dial
  view, every output format, the project library, measuring and building
  from empty. Chromium comes from `PLAYWRIGHT_CHROMIUM_EXECUTABLE`, the
  cloud image's preinstalled browser, or `npx playwright install chromium`.
- Toolbar controls the tests drive carry `data-testid` attributes
  (`new-design`, `crown-action`, `sim-clock`, `dial-reading`,
  `toolbar-notice`).
