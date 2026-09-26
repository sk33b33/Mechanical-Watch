import type { AppStore } from "@/app/store";
import { findEntity, type SelectableEntity } from "@/domain/lookup";
import type { EntityId } from "@/domain/ids";
import { declaredLevelStatus } from "@/validation/validationIssue";
import { VALIDATION_LEVEL_LABELS } from "@/reference/validationLevels";
import { readonlyRow, sectionHeader } from "./fields";
import { frameSection, gearSection, jewelSection, movementSection } from "./sections";
import { shaftSection } from "./shaftSection";

const TYPE_LABEL: Record<SelectableEntity["type"], string> = {
  Gear: "Gear",
  Shaft: "Arbor",
  Frame: "Frame",
  Jewel: "Bearing",
};

/** Entities whose issues bear on the selected one's status. */
function relatedIds(entity: SelectableEntity): EntityId[] {
  switch (entity.type) {
    case "Gear":
      return [entity.id, entity.shaftId];
    case "Jewel":
      return [entity.id, entity.shaftId, entity.frameId];
    default:
      return [entity.id];
  }
}

export function mountInspector(container: HTMLElement, store: AppStore): () => void {
  function render(): void {
    // Preserve which field had focus across the re-render an edit causes.
    const focused = (document.activeElement as HTMLElement | null)?.dataset.field;

    container.innerHTML = "";
    const header = document.createElement("div");
    header.className = "panel-header";
    header.textContent = "Inspector";
    container.appendChild(header);

    const entity = store.selectedId === null ? undefined : findEntity(store.movement, store.selectedId);
    if (entity === undefined) {
      container.append(...movementSection(store));
      restoreFocus(focused);
      return;
    }

    const status = declaredLevelStatus(store.movement.declaredValidationLevel, store.issues, relatedIds(entity));
    const title = document.createElement("div");
    title.className = "field";
    const name = document.createElement("span");
    name.innerHTML = `<span class="muted">${TYPE_LABEL[entity.type]}</span> `;
    name.append(entity.name);
    const badge = document.createElement("span");
    badge.className = `badge ${status.satisfied ? "badge-ok" : "badge-fail"}`;
    badge.textContent = `${VALIDATION_LEVEL_LABELS[status.declared]} · ${
      status.satisfied ? "consistent" : `${String(status.blockingIssues.length)} blocking`
    }`;
    badge.title = "Declared model level for this design. Shows whether it is currently satisfied. The level is never raised automatically.";
    title.append(name, badge);
    container.appendChild(title);

    const section =
      entity.type === "Gear" ? gearSection(store, entity)
      : entity.type === "Shaft" ? shaftSection(store, entity)
      : entity.type === "Jewel" ? jewelSection(store, entity)
      : frameSection(store, entity);
    container.append(...section);

    container.append(
      sectionHeader("Validation scope"),
      readonlyRow("Physical validation", "pending (L5 not claimed)"),
      readonlyRow("Manufacturing", "not validated (ASM-0004)"),
    );

    restoreFocus(focused);
  }

  function restoreFocus(field: string | undefined): void {
    if (field === undefined) return;
    container.querySelector<HTMLElement>(`[data-field="${CSS.escape(field)}"]`)?.focus();
  }

  render();
  return store.subscribe(render);
}
