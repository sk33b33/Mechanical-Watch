import type { AppStore } from "@/app/store";
import { millimetres } from "@/units/length";
import { updateDialWindow } from "@/domain/movement";
import type { DialWindow } from "@/domain/dialWindow";
import type { DialId } from "@/domain/dial";
import type { EntityId } from "@/domain/ids";
import { findDiscComplication, discComplicationLabel } from "@/domain/discComplication";
import { inputRow, mmText, parseRequired, readonlyRow, sectionHeader, selectRow, textRow } from "./fields";
import { deleteRow, positive, type Section } from "./common";

/** Every disc complication in the movement, as options for the window's own select row. */
function complicationOptions(store: AppStore): { value: string; label: string }[] {
  const { movement } = store;
  return [
    ...Object.values(movement.moonPhases).map((m) => ({ value: m.id, label: `${m.name} (moon phase)` })),
    ...Object.values(movement.dateComplications).map((d) => ({ value: d.id, label: `${d.name} (date)` })),
    ...Object.values(movement.monthComplications).map((m) => ({ value: m.id, label: `${m.name} (month)` })),
    ...Object.values(movement.leapYearComplications).map((y) => ({ value: y.id, label: `${y.name} (leap year)` })),
  ];
}

export function dialWindowSection(store: AppStore, win: DialWindow): Section {
  const { movement } = store;
  const edit = (patch: Parameters<typeof updateDialWindow>[2]): void => {
    store.edit((m) => updateDialWindow(m, win.id, patch));
  };

  const dialSelect = selectRow("Dial", win.dialId in movement.dials ? win.dialId : "", [
    { value: "", label: "Choose a dial…" },
    ...Object.values(movement.dials).map((d) => ({ value: d.id, label: d.name })),
  ], (id) => { if (id !== "") edit({ dialId: id as DialId }); },
    "The dial this window is cut into (ASM-0051).");

  const complication = findDiscComplication(movement, win.complicationId);
  const complicationSelect = selectRow("Shows", complication === undefined ? "" : win.complicationId, [
    { value: "", label: "Choose a complication…" },
    ...complicationOptions(store),
  ], (id) => { if (id !== "") edit({ complicationId: id as EntityId }); },
    "The disc complication visible through this window — a moon phase, date, month or leap-year complication. Must actually overlap the window geometrically (DIALWIN-002), or nothing shows through it.");

  const reading = complication === undefined ? null : discComplicationLabel(movement, store.simulation.shaftAngle, win.complicationId);

  return [
    textRow("Name", win.name, (name) => { edit({ name }); }),
    sectionHeader("Dial window"),
    dialSelect,
    complicationSelect,
    inputRow({
      label: "Centre X (mm)", value: mmText(win.centre.x), step: "0.1", invalid: !Number.isFinite(win.centre.x),
      onCommit: (raw) => { edit({ centre: { ...win.centre, x: millimetres(parseRequired(raw)) } }); },
    }),
    inputRow({
      label: "Centre Y (mm)", value: mmText(win.centre.y), step: "0.1", invalid: !Number.isFinite(win.centre.y),
      onCommit: (raw) => { edit({ centre: { ...win.centre, y: millimetres(parseRequired(raw)) } }); },
    }),
    inputRow({
      label: "Radius (mm)", value: mmText(win.radius), step: "0.1", invalid: !positive(win.radius),
      onCommit: (raw) => { edit({ radius: millimetres(parseRequired(raw)) }); },
    }),
    readonlyRow("Model", "a circular cutout in the dial; a real date window is usually a small rectangle instead (ASM-0051)",
      "Visual only — this project does not claim manufacturing accuracy for the window's shape (same treatment as ASM-0005's tooth proportions and ASM-0020's dial markers)."),
    readonlyRow("Currently shows", reading ?? "—",
      "Read live from the complication's own simulated position, the same value its own inspector section reports."),
    deleteRow(store, win.id, "Delete dial window", "The referenced dial and complication are not removed."),
  ];
}
