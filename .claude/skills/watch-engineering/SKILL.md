# Watch Engineering Skill

When working on mechanical-watch functionality:

1. State the physical quantity and unit.
2. State the governing relationship.
3. Identify assumptions.
4. Implement a pure function when possible.
5. Add tests for nominal, boundary and invalid cases.
6. Expose assumptions in the UI where users could mistake an approximation for a fact.

For gears, start with:
- pitch diameter = module × tooth count
- ideal centre distance = (pitch diameter A + pitch diameter B) / 2
- ideal speed relationship = -teeth A / teeth B

Do not extend these formulas to real tooth-profile manufacturing claims without the necessary geometry and tolerances.
