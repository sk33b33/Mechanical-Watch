# Mechanical Watch CAD & Simulation — Claude Code Instructions

## Mission

Build a serious browser-based interactive 3D mechanical-watch design environment. The application is a parametric CAD-like system and mechanical simulation sandbox, not merely a 3D watch viewer.

The central promise is **engineering traceability**:
- geometry is generated from explicit parameters;
- assemblies use explicit constraints;
- gear trains use mathematically defined relationships;
- simulations use the same model that drives the 3D view;
- every engineering assumption is visible and attributable;
- the application must never imply manufacturing or physical accuracy beyond what has actually been validated.

## Product goals

Users should be able to:
1. Start with an empty movement.
2. Create and edit watch components parametrically.
3. Place components in a 3D assembly.
4. Inspect dimensions, relationships and constraints.
5. Simulate kinematic behaviour.
6. Detect interference, invalid geometry and mechanical inconsistencies.
7. Save/load designs.
8. Generate engineering-oriented documentation.
9. Eventually export manufacturable geometry and technical drawings.

## Non-goals for the first release

Do NOT:
- pretend that visually plausible geometry is physically validated;
- implement a fake physics engine hidden behind decorative animation;
- hard-code a single watch movement;
- claim CNC/manufacturing readiness without explicit validation;
- invent watchmaking specifications;
- silently alter user dimensions to make a model work.

## Engineering principles

### Single source of truth

The domain model is authoritative. Three.js is a presentation layer.

Flow:

Domain model
→ validation
→ kinematics/simulation
→ geometry generation
→ Three.js rendering

Never make the rendered mesh the authoritative mechanical state.

### Units

Use SI units internally:
- length: metres
- angle: radians
- time: seconds
- angular velocity: rad/s
- torque: N·m
- mass: kg

User-facing watch dimensions may be displayed in mm, degrees and common watchmaking units, but conversion must happen at the UI/domain boundary.

### Precision

Do not round internal calculations for convenience. Round only for display.

### Explicit assumptions

Any engineering model that is simplified must declare its assumptions in code and documentation.

Examples:
- ideal involute gear approximation;
- rigid-body assumption;
- frictionless kinematic simulation;
- simplified pallet/escape geometry.

### Validation levels

Use explicit validation levels:

1. `GEOMETRIC`
2. `KINEMATIC`
3. `DYNAMIC_SIMPLIFIED`
4. `PHYSICAL_VALIDATION_PENDING`

A design must never silently move from one level to another.

## Core component model

Initial domain entities:

- Movement
- Mainplate
- Bridge
- Barrel
- Mainspring
- Gear
- Wheel
- Pinion
- Shaft
- Jewel
- Pivot
- EscapeWheel
- PalletFork
- PalletStone
- BalanceWheel
- Hairspring
- CannonPinion
- MinuteWheel
- HourWheel
- Screw
- Constraint
- GearMesh
- Assembly
- SimulationState
- ValidationIssue

Use stable IDs and immutable-ish domain updates where practical.

## Mechanical rules

The engine must eventually support:
- gear pitch diameter;
- tooth count;
- module;
- pressure angle;
- centre distance;
- gear ratio;
- rotational direction;
- angular velocity propagation;
- torque propagation;
- shaft/pivot alignment;
- component clearance;
- collision/interference checks;
- escapement timing;
- balance oscillation;
- mainspring torque curve.

Do not implement detailed escapement physics until the basic gear-train engine is tested.

## Development order

1. Project scaffolding.
2. Domain types and units.
3. Parametric gear mathematics.
4. Gear-train kinematics.
5. Constraint/assembly model.
6. Three.js viewport.
7. Component creation/editing UI.
8. Validation engine.
9. Basic simulation controls.
10. Watch movement starter template.
11. Persistence.
12. Technical documentation/export.
13. Advanced escapement and balance simulation.

## Required testing

Every mechanical formula gets unit tests.

At minimum test:
- gear ratio;
- centre distance;
- RPM ↔ rad/s;
- direction reversal;
- compound gear train;
- torque multiplication;
- invalid tooth counts;
- invalid module;
- impossible centre distance;
- shaft alignment;
- interference detection.

Use property-based testing where practical.

## UI philosophy

The application should feel like a professional engineering tool:
- dark technical workspace;
- clear 3D viewport;
- component/assembly tree;
- properties inspector;
- validation panel;
- simulation controls;
- measurement tools;
- exploded view;
- section/cutaway mode.

Avoid decorative UI that does not help design, inspect or simulate.

## Safety of claims

Use language such as:
- "kinematically valid"
- "geometrically valid"
- "simulation approximation"
- "requires physical validation"

Avoid:
- "guaranteed to work"
- "manufacturing-ready"
- "physically accurate"

unless the relevant validation has actually been performed.

## Coding standards

- TypeScript strict mode.
- Small domain modules.
- No `any` unless justified.
- No magic engineering constants.
- Engineering constants belong in named configuration objects.
- Pure mathematical functions wherever possible.
- Keep simulation deterministic and testable.
- Separate UI state from domain state.
- Add comments explaining engineering assumptions, not obvious code.

## Definition of done

A feature is complete only when:
- domain logic exists;
- UI exposes it where appropriate;
- validation exists;
- tests exist;
- errors are understandable;
- the feature does not bypass the domain model;
- documentation is updated.
