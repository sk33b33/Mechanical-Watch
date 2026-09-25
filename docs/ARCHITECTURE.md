# Architecture

## Layers

### Domain
Authoritative mechanical model.

### Math
Units, geometry, gear equations, transforms and numerical utilities.

### Kinematics
Gear meshes, shafts, constraints and rotational state propagation.

### Geometry
Parametric mesh/curve generation.

### Simulation
Time stepping and mechanical state.

### Validation
Rules that produce structured issues.

### UI
Panels, editors, viewport and simulation controls.

## Suggested repository structure

src/
  app/
  components/
  domain/
  geometry/
  kinematics/
  simulation/
  validation/
  units/
  persistence/
  viewport/
  tests/

Do not let UI components directly calculate engineering relationships.
