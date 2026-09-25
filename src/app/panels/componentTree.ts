import type { AppStore } from "@/app/store";
import { listAssumptions } from "@/reference/assumptions";

export function mountComponentTree(container: HTMLElement, store: AppStore): () => void {
  function render(): void {
    container.innerHTML = "";
    const header = document.createElement("div");
    header.className = "panel-header";
    header.textContent = "Components";
    container.appendChild(header);

    for (const gear of Object.values(store.movement.gears)) {
      const item = document.createElement("div");
      item.className = "tree-item" + (gear.id === store.selectedGearId ? " selected" : "");
      item.textContent = `${gear.name} (${String(gear.toothCount)} teeth)`;
      item.addEventListener("click", () => {
        store.selectGear(gear.id);
      });
      container.appendChild(item);
    }

    const assumptionsHeader = document.createElement("div");
    assumptionsHeader.className = "panel-header";
    assumptionsHeader.textContent = "Assumptions";
    container.appendChild(assumptionsHeader);

    for (const assumption of listAssumptions()) {
      const item = document.createElement("div");
      item.className = `assumption assumption-${assumption.status.toLowerCase()}`;
      item.title = `Scope: ${assumption.scope}`;
      const id = document.createElement("span");
      id.className = "assumption-id";
      id.textContent = `${assumption.id} · ${assumption.status}`;
      const text = document.createElement("div");
      text.textContent = assumption.summary;
      item.append(id, text);
      container.appendChild(item);
    }
  }

  render();
  return store.subscribe(render);
}
