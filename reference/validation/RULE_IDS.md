# Rule IDs

UNIT-001  Internal calculations must use declared SI units.
UNIT-002  Angle conversion must distinguish degrees and radians.

GEAR-001 Tooth count must be positive.
GEAR-002 Module must be positive.
GEAR-003 Gear mesh requires compatible profile assumptions.
GEAR-004 Centre distance must match the declared model.
GEAR-005 Gear ratio must be finite.
GEAR-006 External mesh reverses direction.

SHAFT-001 Shaft axis must be valid.
SHAFT-002 Coupled wheels must share the intended shaft.

ASSY-001 Required constraints must be resolved.
ASSY-002 No forbidden interference.

SIM-001 Simulation state must remain finite.
SIM-002 Simulation must be deterministic.
SIM-003 Energy sources must be explicitly defined.

ESC-001 Escapement model level must be declared.
ESC-002 Simplified escapement must not claim physical contact validation.

MFG-001 Nominal dimensions must not be treated as toleranced dimensions.
MFG-002 Manufacturing readiness requires explicit validation evidence.

## Project additions

These IDs were added by the project, not the original reference pack.
Additions to a pack family are numbered from 101 so they can't collide
with future pack IDs.

GEAR-101 Meshed gears must overlap axially (share a meshing plane).
GEAR-102 Gear thickness must be positive and its axial position finite.

KIN-001 Every shaft in a kinematic train should be connected to the declared drive.

FRAME-001 A frame must have a positive thickness, a finite axial position and a valid outline.

BRG-001 In a movement with frames, every shaft needs exactly one lower and one upper bearing, in different frames, with the upper frame above the lower one.
BRG-002 A bearing must lie within its frame's outline.
BRG-003 A pivot must be smaller than its bearing bore (positive side shake).
BRG-004 The shoulder span must fit between the bearing faces (positive endshake).
BRG-005 Bearing clearances are computed but not judged until acceptable ranges have a source.

VAL-001 The validation engine must complete; if it cannot, the design cannot be represented safely.
