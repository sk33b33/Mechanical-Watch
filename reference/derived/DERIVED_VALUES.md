# Derived Values

This directory contains values calculated from sourced inputs.

Every derived record should identify:
- inputs;
- equation;
- units;
- source IDs for inputs;
- software version;
- date generated.

Example:

```yaml
id: DER-0001
name: center_wheel_pitch_diameter
inputs:
  module: 0.08 mm
  teeth: 80
equation: d = m*z
result: 6.40 mm
source_inputs:
  - SRC-...
status: DERIVED
```
