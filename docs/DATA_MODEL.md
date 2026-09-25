# Data Model

Example conceptual structure:

Movement
- id
- name
- dimensions
- components[]
- constraints[]
- gearMeshes[]
- simulationSettings
- metadata

Gear
- id
- toothCount
- module
- pressureAngle
- thickness
- axisId
- localTransform

Shaft
- id
- axis
- pivots[]
- angularState

GearMesh
- id
- driverId
- drivenId
- centreDistance
- direction
- validation

ValidationIssue
- id
- severity
- category
- entityIds[]
- message
- rule
- validationLevel

Keep schemas versioned so saved designs can migrate safely.
