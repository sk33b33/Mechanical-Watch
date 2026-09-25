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

KIN-001 Every shaft in a kinematic train should be connected to the declared drive.
VAL-001 The validation engine must complete; if it cannot, the design cannot be represented safely.
