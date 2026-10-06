import type { AppStore } from "@/app/store";
import type { KeyValueStore } from "@/persistence/autosave";
import { findEntity, type SelectableEntity } from "@/domain/lookup";
import type { EntityId } from "@/domain/ids";
import { declaredLevelStatus } from "@/validation/validationIssue";
import { VALIDATION_LEVEL_LABELS } from "@/reference/validationLevels";
import { readonlyRow, sectionHeader } from "./fields";
import { frameSection, gearSection, jewelSection, movementSection } from "./sections";
import { shaftSection } from "./shaftSection";
import { dialSection, keylessSection } from "./keylessSection";
import { escapementSection } from "./escapementSection";
import { moonPhaseSection } from "./moonPhaseSection";
import { dateComplicationSection } from "./dateComplicationSection";
import { monthComplicationSection } from "./monthComplicationSection";
import { leapYearComplicationSection } from "./leapYearComplicationSection";

const TYPE_LABEL: Record<SelectableEntity["type"], string> = {
  Gear: "Gear",
  Shaft: "Arbor",
  Frame: "Frame",
  Jewel: "Bearing",
  KeylessWorks: "Keyless works",
  Dial: "Dial",
  Escapement: "Escapement",
  MoonPhase: "Moon phase",
  DateComplication: "Date",
  MonthComplication: "Month",
  LeapYearComplication: "Leap year",
};

/** Entities whose issues bear on the selected one's status. */
function relatedIds(entity: SelectableEntity): EntityId[] {
  switch (entity.type) {
    case "Gear":
      return [entity.id, entity.shaftId];
    case "Jewel":
      return [entity.id, entity.shaftId, entity.frameId];
    case "KeylessWorks":
      return [entity.id, entity.crownWheelGearId, entity.settingWheelGearId, entity.ratchetGearId];
    case "Dial":
      return [entity.id];
    case "Escapement":
      return [entity.id, entity.escapeArborShaftId, entity.palletArborShaftId, entity.balanceShaftId];
    case "MoonPhase":
      return [entity.id, entity.shaftId];
    case "DateComplication":
      return [entity.id, entity.driveShaftId, entity.starShaftId];
    case "MonthComplication":
      return [entity.id, entity.starShaftId, entity.dateComplicationId];
    case "LeapYearComplication":
      return [entity.id, entity.wheelShaftId, entity.monthComplicationId];
    default:
      return [entity.id];
  }
}

export function mountInspector(
  container: HTMLElement,
  store: AppStore,
  storage: KeyValueStore | null,
  notify: (message: string, kind: "error" | "info") => void,
): () => void {
  function render(): void {
    // Preserve which field had focus across the re-render an edit causes.
    // The panel may live in a separate window, so ask its own document.
    const focused = (container.ownerDocument.activeElement as HTMLElement | null)?.dataset.field;

    container.innerHTML = "";

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
      entity.type === "Gear" ? gearSection(store, entity, storage, notify)
      : entity.type === "Shaft" ? shaftSection(store, entity, storage, notify)
      : entity.type === "Jewel" ? jewelSection(store, entity, storage, notify)
      : entity.type === "KeylessWorks" ? keylessSection(store, entity)
      : entity.type === "Dial" ? dialSection(store, entity)
      : entity.type === "Escapement" ? escapementSection(store, entity)
      : entity.type === "MoonPhase" ? moonPhaseSection(store, entity)
      : entity.type === "DateComplication" ? dateComplicationSection(store, entity)
      : entity.type === "MonthComplication" ? monthComplicationSection(store, entity)
      : entity.type === "LeapYearComplication" ? leapYearComplicationSection(store, entity)
      : frameSection(store, entity, storage, notify);
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
