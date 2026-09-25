import type { AppStore } from "@/app/store";
import type { EntityId } from "@/domain/ids";
import { listAssumptions } from "@/reference/assumptions";

export function mountComponentTree(container: HTMLElement, store: AppStore): () => void {
  function item(label: string, id: EntityId, depth: number, detail?: string): HTMLDivElement {
    const el = document.createElement("div");
    el.className = "tree-item" + (id === store.selectedId ? " selected" : "");
    el.style.paddingLeft = `${String(10 + depth * 14)}px`;
    el.textContent = label;
    if (detail !== undefined) {
      const muted = document.createElement("span");
      muted.className = "muted";
      muted.textContent = ` ${detail}`;
      el.appendChild(muted);
    }
    el.addEventListener("click", () => {
      store.select(id);
    });
    return el;
  }

  function header(text: string): HTMLDivElement {
    const el = document.createElement("div");
    el.className = "panel-header";
    el.textContent = text;
    return el;
  }

  function render(): void {
    container.innerHTML = "";
    const { movement } = store;

    if (Object.keys(movement.frames).length > 0) {
      container.appendChild(header("Frames"));
      for (const frame of Object.values(movement.frames)) {
        container.appendChild(item(frame.name, frame.id, 0));
      }
    }

    container.appendChild(header("Arbors"));
    for (const shaft of Object.values(movement.shafts)) {
      const driving = shaft.id === movement.drivingShaftId ? "(drive)" : undefined;
      container.appendChild(item(shaft.name, shaft.id, 0, driving));
      for (const gear of Object.values(movement.gears).filter((g) => g.shaftId === shaft.id)) {
        container.appendChild(item(gear.name, gear.id, 1, `${String(gear.toothCount)} teeth`));
      }
      for (const jewel of Object.values(movement.jewels).filter((j) => j.shaftId === shaft.id)) {
        container.appendChild(item(jewel.name.replace(`${shaft.name} `, ""), jewel.id, 1));
      }
    }

    container.appendChild(header("Assumptions"));
    for (const assumption of listAssumptions()) {
      const el = document.createElement("div");
      el.className = `assumption assumption-${assumption.status.toLowerCase()}`;
      el.title = `Scope: ${assumption.scope}`;
      const id = document.createElement("span");
      id.className = "assumption-id";
      id.textContent = `${assumption.id} · ${assumption.status}`;
      const text = document.createElement("div");
      text.textContent = assumption.summary;
      el.append(id, text);
      container.appendChild(el);
    }
  }

  render();
  return store.subscribe(render);
}
