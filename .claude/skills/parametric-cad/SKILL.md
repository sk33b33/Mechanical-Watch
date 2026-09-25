# Parametric CAD Skill

Every generated component should have:
- stable ID;
- type;
- parameters;
- local coordinate system;
- parent assembly;
- constraints;
- generated geometry metadata;
- validation status.

Changing a parameter should regenerate dependent geometry and invalidate dependent calculations where required.
