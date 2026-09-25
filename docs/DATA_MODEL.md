# Data Model

As implemented in `src/domain`. Lengths in metres, angles in radians.
`null` means unknown and is never defaulted. Nothing listed here stores
a derived value.

Movement
- id, name, isTeachingDemo
- declaredValidationLevel (L0–L5; set by the author, never raised automatically)
- frames, shafts, gears, gearMeshes, jewels (records by ID)
- drivingShaftId, drivingAngularVelocity (prescribed kinematic input, ASM-0007)

Frame (mainplate or bridge; flat slab, ASM-0010)
- id, kind (MAINPLATE | BRIDGE), name
- outline: CIRCLE {centre, radius} | POLYGON {points}
- zBottom, thickness

Shaft (arbor)
- id, name
- placement: FIXED {position} | MESH_POLAR {referenceShaftId, meshId, angle}
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

ValidationIssue
- id (deterministic), rule (RULE_IDS.md), severity (info | warning | error | blocker)
- entityIds, message, validationLevel, references (REF-ENG sections, ASM, SRC)

Derived, never stored: shaft axis positions, centre distances, angular
velocities, bearing positions, side shake, endshake, shaft angles.

Not yet versioned or serialized: persistence (with a schema version for
migration) is still to do.
