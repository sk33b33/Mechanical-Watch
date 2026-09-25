import type { AppStore } from "@/app/store";
import { millimetres, toMillimetres } from "@/units/length";
import { toDegrees } from "@/units/angle";
import { toRpm } from "@/units/angularVelocity";
import { toMillimetresPerSecond } from "@/units/linearVelocity";
import { gearPitchDiameter } from "@/domain/gear";
import { updateGear } from "@/domain/movement";
import { isValidModule, isValidToothCount, pitchLineVelocity } from "@/math/gearMath";
import { declaredLevelStatus } from "@/validation/validationIssue";
import { VALIDATION_LEVEL_LABELS } from "@/reference/validationLevels";

/** Empty input is "no value" (NaN), which validation reports. It is never coerced. */
function parseNumberInput(input: HTMLInputElement): number {
  return input.value.trim() === "" ? Number.NaN : Number(input.value);
}

function row(label: string, value: string, title?: string): HTMLDivElement {
  const field = document.createElement("div");
  field.className = "field";
  const labelEl = document.createElement("label");
  labelEl.textContent = label;
  const valueEl = document.createElement("span");
  valueEl.className = "readonly";
  valueEl.textContent = value;
  if (title !== undefined) field.title = title;
  field.append(labelEl, valueEl);
  return field;
}

function numberInputRow(
  label: string,
  value: string,
  step: string,
  valid: boolean,
  onCommit: (value: number) => void,
): HTMLDivElement {
  const field = document.createElement("div");
  field.className = "field";
  const labelEl = document.createElement("label");
  labelEl.textContent = label;
  const input = document.createElement("input");
  input.type = "number";
  input.step = step;
  input.value = value;
  if (!valid) input.classList.add("invalid");
  // Commit on change (Enter / blur / spinner), not per keystroke.
  input.addEventListener("change", () => {
    onCommit(parseNumberInput(input));
  });
  field.append(labelEl, input);
  return field;
}

function sectionHeader(text: string): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "section-header";
  el.textContent = text;
  return el;
}

export function mountInspector(container: HTMLElement, store: AppStore): () => void {
  function render(): void {
    container.innerHTML = "";
    const header = document.createElement("div");
    header.className = "panel-header";
    header.textContent = "Inspector";
    container.appendChild(header);

    const gear = store.selectedGearId === null ? undefined : store.movement.gears[store.selectedGearId];
    if (gear === undefined) {
      const empty = document.createElement("div");
      empty.className = "field muted";
      empty.textContent = "Select a component to inspect.";
      container.appendChild(empty);
      return;
    }

    const status = declaredLevelStatus(store.movement.declaredValidationLevel, store.issues, [
      gear.id,
      gear.shaftId,
    ]);
    const title = document.createElement("div");
    title.className = "field";
    const name = document.createElement("span");
    name.textContent = gear.name;
    const badge = document.createElement("span");
    badge.className = `badge ${status.satisfied ? "badge-ok" : "badge-fail"}`;
    badge.textContent = `${VALIDATION_LEVEL_LABELS[status.declared]} · ${
      status.satisfied ? "consistent" : `${String(status.blockingIssues.length)} blocking`
    }`;
    badge.title =
      "Declared model level for this design. Shows whether it is currently satisfied. The level is never raised automatically.";
    title.append(name, badge);
    container.appendChild(title);

    container.appendChild(sectionHeader("Parameters"));
    container.appendChild(
      numberInputRow("Tooth count", String(gear.toothCount), "1", isValidToothCount(gear.toothCount), (v) => {
        store.edit((m) => updateGear(m, gear.id, { toothCount: v }));
      }),
    );
    container.appendChild(
      numberInputRow(
        "Module (mm)",
        Number.isFinite(gear.module) ? String(toMillimetres(gear.module)) : "",
        "0.01",
        isValidModule(gear.module),
        (v) => {
          store.edit((m) => updateGear(m, gear.id, { module: millimetres(v) }));
        },
      ),
    );
    container.appendChild(
      row(
        "Tooth profile",
        gear.profileModel,
        "Pitch-circle model (REF-ENG §6). The drawn teeth are a visual approximation (ASM-0005).",
      ),
    );
    container.appendChild(
      row(
        "Pressure angle",
        gear.pressureAngle === null ? "not modeled" : `${toDegrees(gear.pressureAngle).toFixed(1)}°`,
        "A pitch model has no tooth flank, so no pressure angle is assumed.",
      ),
    );

    container.appendChild(sectionHeader("Calculated (model predicts)"));
    let pitchText = "invalid parameters";
    let pitchDiameterValue = null;
    if (isValidToothCount(gear.toothCount) && isValidModule(gear.module)) {
      pitchDiameterValue = gearPitchDiameter(gear);
      pitchText = `${toMillimetres(pitchDiameterValue).toFixed(4)} mm`;
    }
    container.appendChild(row("Pitch diameter", pitchText, "d = m z (REF-ENG §5.1)"));

    const angularVelocity = store.analysis.train.shaftAngularVelocity.get(gear.shaftId);
    container.appendChild(
      row(
        "Angular velocity",
        angularVelocity === undefined ? "unpowered" : `${toRpm(angularVelocity).toFixed(3)} rev/min`,
        "Propagated stage by stage, ω2/ω1 = −z1/z2 (REF-ENG §5.3). Sign gives direction.",
      ),
    );
    container.appendChild(
      row(
        "Pitch-line velocity",
        angularVelocity === undefined || pitchDiameterValue === null
          ? "—"
          : `${toMillimetresPerSecond(pitchLineVelocity(angularVelocity, pitchDiameterValue)).toFixed(4)} mm/s`,
        "v = ω r (REF-ENG §5.5)",
      ),
    );

    container.appendChild(sectionHeader("Validation scope"));
    container.appendChild(row("Physical validation", "pending (L5 not claimed)"));
    container.appendChild(row("Manufacturing", "not validated (ASM-0004)"));
  }

  render();
  return store.subscribe(render);
}
