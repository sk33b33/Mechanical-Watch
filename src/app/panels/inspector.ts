import type { AppStore } from "@/app/store";
import { millimetres, toMillimetres } from "@/units/length";
import { toDegrees } from "@/units/angle";
import { gearPitchDiameter } from "@/domain/gear";
import { isValidModule, isValidToothCount } from "@/math/gearMath";

export function mountInspector(container: HTMLElement, store: AppStore): () => void {
  function render(): void {
    container.innerHTML = "";
    const header = document.createElement("div");
    header.className = "panel-header";
    header.textContent = "Inspector";
    container.appendChild(header);

    const gear = store.selectedGearId === null ? null : store.movement.gears[store.selectedGearId];
    if (gear === null || gear === undefined) {
      const empty = document.createElement("div");
      empty.className = "field";
      empty.textContent = "Select a component to inspect.";
      container.appendChild(empty);
      return;
    }

    const badge = document.createElement("div");
    badge.className = "field";
    badge.innerHTML = `<span>${gear.name}</span><span class="badge badge-geometric">GEOMETRIC</span>`;
    container.appendChild(badge);

    const toothCountField = document.createElement("div");
    toothCountField.className = "field";
    const toothCountLabel = document.createElement("label");
    toothCountLabel.textContent = "Tooth count";
    const toothCountInput = document.createElement("input");
    toothCountInput.type = "number";
    toothCountInput.step = "1";
    toothCountInput.value = String(gear.toothCount);
    toothCountInput.style.borderColor = isValidToothCount(gear.toothCount) ? "" : "var(--error)";
    toothCountInput.addEventListener("input", () => {
      const value = Number(toothCountInput.value);
      if (Number.isFinite(value)) {
        store.updateGearParams(gear.id, { toothCount: Math.trunc(value) });
      }
    });
    toothCountField.append(toothCountLabel, toothCountInput);
    container.appendChild(toothCountField);

    const moduleField = document.createElement("div");
    moduleField.className = "field";
    const moduleLabel = document.createElement("label");
    moduleLabel.textContent = "Module (mm)";
    const moduleInput = document.createElement("input");
    moduleInput.type = "number";
    moduleInput.step = "0.01";
    moduleInput.value = toMillimetres(gear.module).toFixed(3);
    moduleInput.style.borderColor = isValidModule(gear.module) ? "" : "var(--error)";
    moduleInput.addEventListener("input", () => {
      const value = Number(moduleInput.value);
      if (Number.isFinite(value)) {
        store.updateGearParams(gear.id, { module: millimetres(value) });
      }
    });
    moduleField.append(moduleLabel, moduleInput);
    container.appendChild(moduleField);

    const pressureAngleField = document.createElement("div");
    pressureAngleField.className = "field";
    pressureAngleField.innerHTML = `<label>Pressure angle</label><span class="readonly">${toDegrees(gear.pressureAngle).toFixed(1)}°</span>`;
    container.appendChild(pressureAngleField);

    const pitchDiameterField = document.createElement("div");
    pitchDiameterField.className = "field";
    let pitchText = "—";
    try {
      pitchText = `${toMillimetres(gearPitchDiameter(gear)).toFixed(3)} mm`;
    } catch {
      pitchText = "invalid parameters";
    }
    pitchDiameterField.innerHTML = `<label>Pitch diameter (calc.)</label><span class="readonly">${pitchText}</span>`;
    container.appendChild(pitchDiameterField);

    const angularVelocityField = document.createElement("div");
    angularVelocityField.className = "field";
    const angularVelocity = store.solution.shaftAngularVelocity.get(gear.shaftId);
    const rpmText = angularVelocity === undefined ? "unpowered" : `${(angularVelocity * (60 / (2 * Math.PI))).toFixed(2)} rpm`;
    angularVelocityField.innerHTML = `<label>Angular velocity (calc.)</label><span class="readonly">${rpmText}</span>`;
    container.appendChild(angularVelocityField);
  }

  render();
  return store.subscribe(render);
}
