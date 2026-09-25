# Validation Rules

## Severity

- `INFO`: informational
- `WARNING`: model is usable but limited
- `ERROR`: invalid within the declared model
- `BLOCKER`: operation cannot be represented safely within the model

## Required rule families

### Units
- mixed units must be converted before calculation;
- no unitless physical values;
- no degree/radian ambiguity.

### Gear
- tooth count > 0;
- module > 0;
- compatible mesh parameters;
- centre distance within configured tolerance;
- no impossible overlap.

### Shafts
- unique axis IDs;
- valid transforms;
- compatible pivots and bearings.

### Assembly
- no unresolved required constraints;
- no component assigned to an invalid parent;
- no hidden duplicate authoritative transform.

### Simulation
- finite state;
- deterministic timestep;
- no NaN/Infinity;
- no unconstrained energy source;
- simulation state reproducible from design + initial conditions.

### Escapement
- explicit model level;
- no claim of physical contact accuracy from rigid-body animation;
- locking/impulse/banking geometry must be separately represented when implemented.

### Manufacturing
- nominal geometry and toleranced geometry are separate;
- export must state its validation level;
- manufacturing-ready status requires explicit evidence.

## Validation output

Each issue should include:
- rule ID;
- severity;
- affected entity IDs;
- human-readable message;
- validation level;
- source/assumption reference where relevant.
