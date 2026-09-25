# REFERENCE_ENGINEERING.md

## Purpose

This directory is the engineering evidence layer for Mechanical Watchmaker 3D.

It exists to prevent Claude Code from confusing:
- a known engineering relationship,
- a sourced watchmaking specification,
- a movement-specific measurement,
- an engineering approximation,
- a design assumption,
- and a visually plausible but unverified result.

The application must remain honest about what is known and what is simulated.

---

# 1. Source hierarchy

When sources disagree, prefer sources in this order unless there is a documented reason otherwise:

1. Primary standards / metrology organizations
2. Peer-reviewed engineering research
3. Manufacturer technical documentation
4. Recognized watchmaking textbooks and professional training material
5. Movement manufacturer service documentation
6. Reputable specialist horology references
7. Community references, forums, videos and informal articles

A lower-tier source may be useful, but it must not silently override a higher-tier source.

---

# 2. Evidence states

Every engineering datum used by the application should have one of these states:

- `VERIFIED_STANDARD`
- `VERIFIED_RESEARCH`
- `VERIFIED_MANUFACTURER`
- `VERIFIED_WATCHMAKING_REFERENCE`
- `MOVEMENT_SPECIFIC`
- `DERIVED`
- `ASSUMPTION`
- `APPROXIMATION`
- `UNKNOWN`

Do not label a derived result as an externally verified fact.

---

# 3. Source records

Each important source should have a small metadata record.

Recommended format:

```yaml
id: SRC-0001
title: Example source
author: Example author
publisher: Example publisher
year: 2026
type: peer_reviewed
url: https://example.com
topics:
  - escapement
claims_supported:
  - escape-wheel kinematics
accessed: 2026-09-25
notes: >
  Used for the contact model. Does not establish manufacturing tolerances.
```

Do not copy large copyrighted passages into the repository. Store concise notes, equations, citations and page/section references.

---

# 4. SI and units

Internal calculations use SI.

Required internal units:

| Quantity | Internal unit |
|---|---|
| length | m |
| time | s |
| mass | kg |
| angle | rad |
| angular velocity | rad/s |
| angular acceleration | rad/s² |
| force | N |
| torque | N·m |
| energy | J |
| power | W |
| pressure/stress | Pa |

NIST identifies rad/s as the SI unit for angular velocity and distinguishes angular frequency from ordinary frequency; this distinction must be preserved to avoid accidental 2π errors.

User-facing units may include:
- mm
- µm
- degrees
- rev/min
- beats per hour
- hours
- days

Conversions belong at boundaries, not inside core equations.

---

# 5. Gear mathematics

## 5.1 Spur gear pitch diameter

For metric module `m` and tooth count `z`:

`d = m z`

where:
- `d` = pitch diameter
- `m` = module
- `z` = tooth count

Use SI units internally.

## 5.2 Ideal external-gear centre distance

For two compatible external gears:

`a = (d1 + d2) / 2`

Therefore:

`a = m(z1 + z2) / 2`

This is an ideal geometric relationship. It does not by itself prove correct tooth-profile engagement, backlash, material suitability or manufacturability.

## 5.3 Ideal gear ratio

For two external gears:

`ω2 / ω1 = -z1 / z2`

The negative sign represents reversal of rotational direction.

For a compound train, calculate the ratio stage-by-stage.

## 5.4 Torque relationship

For an ideal lossless gear pair:

`T2 / T1 = z2 / z1`

Real systems require efficiency and loss terms:

`T2 = η T1 (z2 / z1)`

Do not assign an efficiency value without an explicit source or clearly marked assumption.

## 5.5 Tangential pitch-line velocity

`v = ω r`

where `r = d / 2`.

## 5.6 Gear validation

A gear mesh should validate:
- positive integer tooth counts;
- positive module;
- compatible pressure-angle assumptions;
- valid centre distance;
- nonzero pitch diameters;
- no impossible shaft placement;
- no geometric interference within the model's validated scope.

---

# 6. Gear profile scope

A pitch-circle model is insufficient for manufacturing-grade tooth geometry.

The project should eventually distinguish:

`PITCH_MODEL`
→ `INVOLUTE_PROFILE`
→ `WATCH_SPECIFIC_PROFILE`
→ `MANUFACTURING_VALIDATED_PROFILE`

Do not silently promote a pitch-circle visualization to an involute or watch-specific tooth profile.

If an involute is implemented, document:
- base circle;
- pressure angle;
- addendum;
- dedendum;
- tooth thickness convention;
- backlash;
- root fillet assumption;
- tip/root clearances.

---

# 7. Watch train kinematics

A basic going train is represented as explicit shafts and wheel/pinion relationships.

The domain model must know which wheel and pinion share a shaft.

For each mesh:
- driver entity;
- driven entity;
- tooth counts;
- ratio;
- direction;
- centre distance;
- validation state.

Never infer a train from visual proximity alone.

---

# 8. Motion works

Motion works should be represented as a separate subsystem.

Do not assume the going train and motion works have identical constraints.

At minimum model:
- cannon pinion;
- minute wheel;
- hour wheel;
- relevant friction/slip relationship.

A friction clutch or slipping interface must not be represented as a rigid gear constraint if the intended behaviour requires relative motion.

---

# 9. Escapement

The Swiss lever escapement requires a dedicated engineering model.

Relevant elements include:
- escape wheel;
- pallet fork/lever;
- entry pallet;
- exit pallet;
- impulse surfaces;
- locking surfaces;
- banking limits;
- balance interaction.

The mechanism has distinct phases including release, impulse and fall. Peer-reviewed research describes the escapement as involving impact and sliding contact, so a simple rigid gear mesh is not an adequate physical model.

The first implementation may be kinematic and simplified, but the UI must label it:

`SIMPLIFIED ESCAPEMENT MODEL`

Do not claim physical contact-pressure, wear, friction or timing accuracy unless those models have actually been implemented and validated.

---

# 10. Balance and hairspring

The balance/hairspring subsystem should eventually distinguish:

### Kinematic model
Oscillation angle and frequency.

### Simplified dynamic model
Moment of inertia, restoring torque and damping.

### Physical model
Nonlinear hairspring behaviour, temperature effects, amplitude dependence, positional effects, escapement interaction and friction.

Do not jump directly from a sinusoidal animation to a claim of chronometric accuracy.

---

# 11. Mainspring and barrel

The barrel subsystem should model, as data:
- barrel dimensions;
- arbor dimensions;
- mainspring dimensions;
- spring material;
- available energy;
- torque curve;
- winding state;
- bridle/slipping behaviour where applicable.

A constant torque assumption is acceptable only when explicitly marked as a simplified model.

Power reserve should be calculated from an explicit energy/torque-speed model rather than an arbitrary timer.

---

# 12. Jewels, pivots and bearings

Model separately:
- pivot diameter;
- pivot length;
- jewel bore;
- endshake;
- side shake;
- jewel type;
- bearing clearance.

A visually aligned shaft does not prove acceptable bearing clearance.

---

# 13. Materials

Material data must carry provenance.

Do not hard-code generic values for:
- Young's modulus;
- density;
- yield strength;
- hardness;
- friction coefficient;
- thermal expansion;
- fatigue limits.

Material properties vary by alloy, treatment, temperature and manufacturing process.

Store sourced values with:
- source;
- material designation;
- condition/treatment;
- temperature;
- test standard where known;
- uncertainty/range.

---

# 14. Tolerances

Nominal geometry is not manufacturing geometry.

Where tolerances are introduced, represent:

`nominal`
`lower_limit`
`upper_limit`
`distribution` (optional)
`source`
`validation_scope`

The application must be able to show:

`Nominally valid`

without incorrectly claiming:

`Manufacturing validated`.

---

# 15. Validation levels

Every subsystem reports one or more validation levels:

### L0 — Visual
Only visual representation is validated.

### L1 — Geometric
Dimensions, transforms and basic geometry are internally consistent.

### L2 — Kinematic
Motion relationships and constraints are mathematically consistent.

### L3 — Simplified dynamic
Forces/torques/energy are modeled with declared assumptions.

### L4 — Engineering validated
The model has been checked against appropriate engineering evidence.

### L5 — Physical validation
The physical part/system has been measured or tested.

The software must never automatically upgrade a validation level.

---

# 16. Claim discipline

Use:

- "model predicts"
- "idealized"
- "kinematically valid"
- "based on source X"
- "assumption"
- "requires physical validation"

Avoid:

- "guaranteed"
- "manufacturing ready"
- "will work"
- "accurate to X" without evidence
- "chronometer-grade" without appropriate testing

---

# 17. Engineering change control

When a formula, constant or specification changes:

1. identify affected source;
2. identify affected equations;
3. identify affected tests;
4. identify affected components;
5. rerun validation;
6. record the change.

Do not modify engineering constants merely to make a demo movement animate correctly.

---

# 18. Required source metadata

For every external source used materially by the application, record:

- source ID;
- title;
- author/organization;
- publication year;
- source type;
- URL/DOI/book identifier;
- exact chapter/page/section if applicable;
- claim supported;
- limitations;
- date accessed.

---

# 19. Reference pack rule

Claude Code must consult this reference layer before implementing nontrivial watchmaking equations.

If evidence is absent:
- ask for a source;
- mark the value as `UNKNOWN`;
- or implement a configurable assumption.

Never invent an engineering constant.
