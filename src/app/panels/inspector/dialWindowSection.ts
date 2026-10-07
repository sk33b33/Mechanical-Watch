import type { AppStore } from "@/app/store";
import { millimetres } from "@/units/length";
import { updateDialWindow } from "@/domain/movement";
import type { DialWindow, DialWindowOutline } from "@/domain/dialWindow";
import type { DialId } from "@/domain/dial";
import type { EntityId } from "@/domain/ids";
import { findDiscComplication, discComplicationLabel } from "@/domain/discComplication";
import { inputRow, mmText, parseRequired, readonlyRow, sectionHeader, selectRow, textRow } from "./fields";
import { deleteRow, positive, type Section } from "./common";

const EMPTY = millimetres(Number.NaN);

function emptyOutline(kind: DialWindowOutline["kind"]): DialWindowOutline {
  return kind === "CIRCLE" ? { kind: "CIRCLE", radius: EMPTY } : { kind: "RECTANGLE", width: EMPTY, height: EMPTY };
}

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
    selectRow("Shape", win.outline.kind, [
      { value: "CIRCLE", label: "Circle" },
      { value: "RECTANGLE", label: "Rectangle" },
    ], (kind) => {
      if (kind !== win.outline.kind) edit({ outline: emptyOutline(kind as DialWindowOutline["kind"]) });
    }, "A circular aperture (a real simple-date window) or an axis-aligned rectangle (a real month/year window, wide enough for a word or short label) — ASM-0051."),
    ...(win.outline.kind === "CIRCLE"
      ? [
        inputRow({
          label: "Radius (mm)", value: mmText(win.outline.radius), step: "0.1", invalid: !positive(win.outline.radius),
          onCommit: (raw) => { edit({ outline: { kind: "CIRCLE", radius: millimetres(parseRequired(raw)) } }); },
        }),
      ]
      : [
        inputRow({
          label: "Width (mm)", value: mmText(win.outline.width), step: "0.1", invalid: !positive(win.outline.width),
          onCommit: (raw) => {
            const height = win.outline.kind === "RECTANGLE" ? win.outline.height : EMPTY;
            edit({ outline: { kind: "RECTANGLE", width: millimetres(parseRequired(raw)), height } });
          },
        }),
        inputRow({
          label: "Height (mm)", value: mmText(win.outline.height), step: "0.1", invalid: !positive(win.outline.height),
          onCommit: (raw) => {
            const width = win.outline.kind === "RECTANGLE" ? win.outline.width : EMPTY;
            edit({ outline: { kind: "RECTANGLE", width, height: millimetres(parseRequired(raw)) } });
          },
        }),
      ]),
    readonlyRow("Model", "a circular or rectangular cutout in the dial, in plan — not a real date/month window's actual bevelled aperture (ASM-0051)",
      "Visual only — this project does not claim manufacturing accuracy for the window's shape (same treatment as ASM-0005's tooth proportions and ASM-0020's dial markers)."),
    readonlyRow("Currently shows", reading ?? "—",
      "Read live from the complication's own simulated position, the same value its own inspector section reports."),
    deleteRow(store, win.id, "Delete dial window", "The referenced dial and complication are not removed."),
  ];
}
