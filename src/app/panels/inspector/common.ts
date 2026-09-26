import type { AppStore } from "@/app/store";
import type { EntityId } from "@/domain/ids";
import type { Movement } from "@/domain/movement";
import type { GearMesh } from "@/domain/gearMesh";
import { actionRow } from "./fields";

export type Section = HTMLElement[];

export function positive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

export function meshLabel(movement: Movement, mesh: GearMesh): string {
  return `${movement.gears[mesh.drivingGearId]?.name ?? "missing gear"} → ${movement.gears[mesh.drivenGearId]?.name ?? "missing gear"}`;
}

export function deleteRow(store: AppStore, id: EntityId, label: string, cascade: string): HTMLDivElement {
  return actionRow(label, `${cascade} Undo with Ctrl+Z.`, () => {
    store.remove(id);
  }, true);
}
