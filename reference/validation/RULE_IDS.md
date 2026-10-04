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
GEAR-103 An INVOLUTE_PROFILE gear needs a positive pressure angle; below the no-undercut tooth-count threshold is an advisory, not an error (REF-ENG §6, ASM-0030).
GEAR-104 A WATCH_SPECIFIC_PROFILE gear needs at least 6 teeth, the cited cycloidal tooth-form table's lower bound (REF-ENG §6, ASM-0032, ASM-0033).

KIN-001 Every shaft in a kinematic train should be connected to the declared drive.

FRAME-001 A frame must have a positive thickness, a finite axial position and a valid outline.

BRG-001 In a movement with frames, every shaft needs exactly one lower and one upper bearing, in different frames, with the upper frame above the lower one.
BRG-002 A bearing must lie within its frame's outline.
BRG-003 A pivot must be smaller than its bearing bore (positive side shake).
BRG-004 The shoulder span must fit between the bearing faces (positive endshake).
BRG-005 Bearing clearances are computed but not judged until acceptable ranges have a source.
BRG-006 Endshake compared to an informal, unconfirmed reference figure (info only, not a validated limit).
BRG-007 Side shake compared to an informal, unconfirmed reference figure (info only, not a validated limit).

CPL-001 A friction clutch or mainspring must join two different shafts on the same axis.

SUP-001 A carried part must be placed coaxially on the shaft that carries it.
SUP-002 A stud-mounted part's axis must lie within its frame.

TIME-001 At most one shaft carries each hand (hours, minutes, seconds).
TIME-002 Hand speeds must keep 12-hour-dial ratios (hours : minutes : seconds = 1 : 12 : 720) and turn the same way.
TIME-003 A nominal-time drive needs a shaft that carries the minutes hand.
TIME-004 Under a prescribed drive, the hand rates are reported relative to nominal.

SET-001 The hands must be settable without turning the rest of the train (a slipping clutch must isolate them).

KEY-001 At most one keyless works; its wheel references must exist, be three different gears on different arbors, and its stem pinions must have valid tooth counts and modules.
KEY-002 A stem pinion must engage its wheel at a right angle: same module, the wheel's axis on the stem's plan line, and the stem height one pitch radius from the wheel's mid-plane.
KEY-003 Winding must be derivable: the ratchet's arbor needs a declared mainspring to a drum the running train turns, and the running train must not turn the ratchet (the click holds it).
KEY-004 Setting through the crown: the sliding pinion's train must reach the minutes hand and be isolated from the going train by a friction clutch.

DIAL-001 At most one dial, with a positive diameter and thickness, a finite face height and an existing centre arbor.
DIAL-002 The dial must be clear of the movement: nothing may share its height where it overlaps the dial in plan.
DIAL-003 Every hand arbor must lie within the dial.

ESC-101 At most one escapement; its arbors must exist and be distinct, the escape arbor must be driven by the train, and its escape wheel, lever and balance inputs must be valid (amplitude above half the lift angle).
ESC-102 The pallet arbor and balance staff oscillate under the escapement and must not be gear-driven.
ESC-104 Pallet geometry: the locking points must be a whole number of pitches plus a half apart, under 180°, and the pallet arbor at the tangential-locking distance from the escape axis.
ESC-105 Lever angles: lock positive, run not negative, impulse (lever − lock − run) positive, and draw positive.
ESC-103 The escape wheel must clear the pallet arbor and balance staff, and the balance must clear the pallet arbor.

BAL-001 A balance-governed drive needs an escapement with a valid escape wheel and a positive balance inertia and hairspring stiffness; entered inertia and stiffness must be positive.
BAL-002 The simplified dynamic balance model reports its free frequency, the frequency nominal time needs, and the predicted daily rate, with its assumptions.

SPR-001 Mainspring data must be valid: positive usable turns and torques, fully-wound torque not below let-down torque, efficiencies in (0, 1], a positive balance quality factor.
SPR-002 The simplified energy model reports power reserve, escape-wheel torque, energy per beat and predicted amplitude, with its assumptions.
SPR-003 The predicted amplitude must exceed half the lift angle while the spring is wound, or the balance cannot unlock the escapement.
SPR-004 An entered balance quality factor Q outside the informally cited range for a mechanical wristwatch is an advisory, not an error (REF-ENG §10, ASM-0035).

TOL-001 A declared tolerance must apply to an existing dimension once, with finite limits, lower ≤ upper, and a positive lower limit for a size.
TOL-002 A clearance or gear-mesh centre distance that is positive at nominal should stay positive at its worst-case declared tolerance limits.

VAL-001 The validation engine must complete; if it cannot, the design cannot be represented safely.
