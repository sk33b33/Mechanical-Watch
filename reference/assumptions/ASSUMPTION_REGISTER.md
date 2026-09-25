# Assumption Register

Every approximation used by the application should be recorded here or generated into a machine-readable equivalent.

| ID | Assumption | Scope | Status |
|---|---|---|---|
| ASM-0001 | Ideal rigid gears for initial kinematics | Gear sandbox | Active |
| ASM-0002 | Constant efficiency may be used only when explicitly configured | Torque model | Pending |
| ASM-0003 | Escapement begins as a simplified kinematic model | Escapement | Planned |
| ASM-0004 | Visual mesh does not establish manufacturing validity | Entire app | Permanent |

Rules:
1. Never hide an assumption.
2. Never turn an assumption into a constant without provenance.
3. Tests should identify assumptions where they affect expected values.
