# Three.js Viewport Skill

Rules:
- Three.js visualizes domain state.
- Selection maps back to stable domain IDs.
- Transform edits update the domain model, then regenerate/update geometry.
- Keep scene objects disposable.
- Use instancing for repeated simple hardware where appropriate.
- Keep measurement overlays separate from mechanical geometry.
- Provide camera reset, fit-to-selection and exploded-view controls.
