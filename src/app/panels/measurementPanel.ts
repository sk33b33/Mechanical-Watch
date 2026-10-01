import type { AppStore } from "@/app/store";
import { findEntity } from "@/domain/lookup";
import { measureBetween, pointToPointRow } from "@/assembly/measure";
import { VALIDATION_LEVEL_LABELS } from "@/reference/validationLevels";

/** Floating panel over the viewport showing the current measurement. */
export function mountMeasurementPanel(container: HTMLElement, store: AppStore): void {
  const panel = document.createElement("div");
  panel.className = "measurement-panel";
  container.appendChild(panel);

  const render = (): void => {
    panel.hidden = !store.measuring;
    if (!store.measuring) return;
    panel.innerHTML = "";
    const [idA, idB] = store.measureIds;
    const nameOf = (id: typeof idA): string =>
      id === null ? "—" : findEntity(store.movement, id)?.name ?? "missing part";

    const title = document.createElement("div");
    title.className = "measurement-title";
    title.textContent = idA === null ? "Measure: pick a point" : idB === null ? `A: ${nameOf(idA)}. Pick a second point` : `${nameOf(idA)} ↔ ${nameOf(idB)}`;
    panel.appendChild(title);
    if (idA === null || idB === null) return;

    const result = measureBetween(store.movement, store.analysis.placement, idA, idB);
    if (result === null) return;
    if (idA === idB) {
      const same = document.createElement("div");
      same.className = "muted";
      same.textContent = "Both picks are the same part.";
      panel.appendChild(same);
    }
    const rows = [...result.rows, pointToPointRow(...store.measurePoints)];
    const table = document.createElement("table");
    for (const row of rows) {
      const tr = document.createElement("tr");
      const label = document.createElement("td");
      label.textContent = row.label;
      const value = document.createElement("td");
      value.className = "measurement-value";
      value.textContent = row.value === null ? "—" : `${(row.value * 1000).toFixed(4)} mm`;
      const level = document.createElement("td");
      level.className = `measurement-level${row.level === "L0_VISUAL" ? " visual" : ""}`;
      level.textContent = VALIDATION_LEVEL_LABELS[row.level];
      tr.title = [row.note, ...(row.references.length > 0 ? [`Basis: ${row.references.join(", ")}`] : [])].join(". ");
      tr.append(label, value, level);
      table.appendChild(tr);
    }
    panel.appendChild(table);
    const foot = document.createElement("div");
    foot.className = "muted measurement-foot";
    foot.textContent = "From the design model at assembled positions. Hover a row for its basis.";
    panel.appendChild(foot);
  };
  render();
  store.subscribe(render);
}
