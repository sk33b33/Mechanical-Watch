# Status

## Milestone 1 — complete

Implemented per `docs/MASTER_BUILD_PROMPT.md` "First milestone":

- TypeScript strict-mode project (Vite, Vitest, typescript-eslint strict + stylistic type-checked).
- SI-internal domain units: `Length`, `Angle`, `TimeSpan`, `AngularVelocity`, `Torque` (`src/units/`).
- Parametric gear mathematics: pitch diameter, ideal centre distance, achievable-centre-distance check, signed mesh speed ratio (direction reversal), compound-train ratio, ideal torque propagation (`src/math/gearMath.ts`).
- Domain model: `Gear`, `Shaft`, `GearMesh`, `Movement` with stable IDs and pure update functions (`src/domain/`).
- Deterministic gear-train solver: BFS propagation of angular velocity across meshes, conflict detection for over-constrained trains, unreachable-shaft reporting (`src/kinematics/solveGearTrain.ts`).
- Three.js viewport: gear geometry generated from domain parameters (approximate trapezoidal teeth — explicitly not a true involute profile), positioned from shaft placement, rotation driven exclusively by the kinematic solver + simulation stepper, click-to-select (`src/viewport/`, `src/geometry/`).
- Selection + properties inspector: edit tooth count / module (mm), read calculated pitch diameter and angular velocity; a gear with currently-invalid parameters is simply not rendered (not silently coerced) while the validation console reports why (`src/app/panels/`).
- Validation engine + always-visible console: gear-parameter validity, mesh module/pressure-angle compatibility, achievable centre distance, unintended interference between unmeshed gears, gear-train consistency conflicts, unreachable-shaft warnings (`src/validation/`).
- Two-gear teaching demo movement, explicitly flagged `isTeachingDemo: true` (`src/app/demoMovement.ts`).
- 33 unit tests covering the math, kinematics, geometry outline and validation layers; `npm run typecheck`, `npm run lint` and `npm run build` all pass clean.

## Validation level

Everything above is `GEOMETRIC` / `KINEMATIC` per `docs/MASTER_BUILD_PROMPT.md` "Validation levels": rigid-body, lossless, frictionless assumptions throughout. No `DYNAMIC_SIMPLIFIED` or `PHYSICAL_VALIDATION_PENDING` claims are made anywhere in the UI.

## Not yet implemented (see `docs/ROADMAP.md`)

- Component creation/deletion from the UI (the demo movement is currently fixed; only parameter edits are exposed).
- Assembly-level constraints beyond shaft placement (Phase 2).
- Persistence / save-load (Phase 2/4).
- Exploded view, section/cutaway mode, measurement tools (Phase 4).
- Escapement, balance, hairspring, timing simulation (Phase 5).
- BOM, technical drawings, STL/STEP/DXF export (Phase 6).
- Torque propagation is implemented in `src/math/gearMath.ts` but not yet wired into the UI or solver output (the solver currently only propagates angular velocity).
