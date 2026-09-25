import type { AppStore } from "@/app/store";

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
      item.textContent = `${gear.name} — ${String(gear.toothCount)}t`;
      item.addEventListener("click", () => {
        store.selectGear(gear.id);
      });
      container.appendChild(item);
    }
  }

  render();
  return store.subscribe(render);
}
