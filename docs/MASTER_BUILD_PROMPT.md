# Master Build Prompt for Claude Code

You are building the Mechanical Watchmaker 3D project contained in this repository.

Read `CLAUDE.md` first, then read:
- `docs/ARCHITECTURE.md`
- `docs/PRODUCT_SPEC.md`
- `docs/ENGINEERING_RULES.md`
- `docs/ROADMAP.md`
- `docs/CLAUDE_TASKS.md`

Your job is to implement the product incrementally.

## Critical instruction

Do not generate a giant monolithic application in one pass.

Work in small, testable vertical slices. After each slice:
1. run tests;
2. run typecheck/lint;
3. inspect the architecture;
4. fix regressions;
5. update docs;
6. report exactly what is implemented and what remains.

## First milestone

Build a working browser prototype with:
- TypeScript;
- Three.js;
- parametric gears;
- editable tooth count/module;
- calculated pitch diameter;
- calculated centre distance;
- two meshed gears;
- mathematically driven opposite rotation;
- selection and inspector;
- validation messages;
- tests.

The viewport must derive its geometry and animation from the domain model.

Do not implement escapement physics in milestone one.

## Engineering honesty

When an implementation is an approximation, label it in code and UI. Never substitute a visual approximation for a physically validated mechanism without saying so.

Begin by inspecting the repository and creating the minimal foundation required for Milestone 1.
