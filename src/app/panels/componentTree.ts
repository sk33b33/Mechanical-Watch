import type { AppStore } from "@/app/store";
import type { EntityId } from "@/domain/ids";
import { addFrame, addShaft, drivenShaftId, type Movement } from "@/domain/movement";
import { newFrame, newShaft } from "@/domain/editing";
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

  function addButton(label: string, title: string, create: (m: Movement) => { movement: Movement; id: EntityId }): HTMLButtonElement {
    const el = document.createElement("button");
    el.type = "button";
    el.textContent = label;
    el.title = title;
    el.addEventListener("click", () => {
      const { movement, id } = create(store.movement);
      store.edit(() => movement);
      store.select(id);
    });
    return el;
  }

  function empty(text: string): HTMLDivElement {
    const el = document.createElement("div");
    el.className = "tree-empty muted";
    el.textContent = text;
    return el;
  }

  function render(): void {
    container.innerHTML = "";
    const { movement } = store;

    const actions = document.createElement("div");
    actions.className = "tree-actions";
    actions.append(
      addButton("+ Mainplate", "Add a mainplate with every dimension empty", (m) => {
        const frame = newFrame(m, "MAINPLATE");
        return { movement: addFrame(m, frame), id: frame.id };
      }),
      addButton("+ Bridge", "Add a bridge with every dimension empty", (m) => {
        const frame = newFrame(m, "BRIDGE");
        return { movement: addFrame(m, frame), id: frame.id };
      }),
      addButton("+ Arbor", "Add an arbor with an empty position", (m) => {
        const shaft = newShaft(m);
        return { movement: addShaft(m, shaft), id: shaft.id };
      }),
    );
    container.appendChild(actions);

    container.appendChild(header("Frames"));
    if (Object.keys(movement.frames).length === 0) container.appendChild(empty("No frames yet."));
    for (const frame of Object.values(movement.frames)) {
      container.appendChild(item(frame.name, frame.id, 0));
    }

    container.appendChild(header("Arbors"));
    if (Object.keys(movement.shafts).length === 0) container.appendChild(empty("No arbors yet."));
    const driven = drivenShaftId(movement);
    for (const shaft of Object.values(movement.shafts)) {
      const driving = shaft.id === driven ? "(drive)" : shaft.hand === null ? undefined : `(${shaft.hand.toLowerCase()} hand)`;
      container.appendChild(item(shaft.name, shaft.id, 0, driving));
      for (const gear of Object.values(movement.gears).filter((g) => g.shaftId === shaft.id)) {
        container.appendChild(item(gear.name, gear.id, 1, Number.isNaN(gear.toothCount) ? "no tooth count" : `${String(gear.toothCount)} teeth`));
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
