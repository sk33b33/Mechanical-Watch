import type { AppStore } from "@/app/store";
import { millimetres } from "@/units/length";
import { radians } from "@/units/angle";
import { updateDateComplication } from "@/domain/movement";
import type { DateComplication } from "@/domain/dateComplication";
import type { ShaftId } from "@/domain/shaft";
import { DAYS_PER_WEEK, WEEKDAY_NAMES, starPosition } from "@/kinematics/dateComplication";
import type { DateDisplay } from "@/domain/dateComplication";
import { formatPeriod } from "@/kinematics/timeDisplay";
import { inputRow, mmText, parseRequired, readonlyRow, sectionHeader, selectRow, textRow } from "./fields";
import { deleteRow, positive, type Section } from "./common";

export function dateComplicationSection(store: AppStore, date: DateComplication): Section {
  const { movement } = store;
  const edit = (patch: Parameters<typeof updateDateComplication>[2]): void => {
    store.edit((m) => updateDateComplication(m, date.id, patch));
  };
  const arborSelect = (label: string, value: ShaftId, key: "driveShaftId" | "starShaftId", title: string): HTMLDivElement =>
    selectRow(label, value in movement.shafts ? value : "", [
      { value: "", label: "Choose an arbor…" },
      ...Object.values(movement.shafts).map((s) => ({ value: s.id, label: s.name })),
    ], (id) => { if (id !== "") edit({ [key]: id as ShaftId }); }, title);

  const omega = store.analysis.train.shaftAngularVelocity.get(date.driveShaftId);
  const position = Number.isInteger(date.starToothCount) && date.starToothCount > 0 && date.starShaftId in movement.shafts
    ? starPosition(store.simulation.shaftAngle[date.starShaftId] ?? radians(0), date.starToothCount)
    : null;

  return [
    textRow("Name", date.name, (name) => { edit({ name }); }),
    sectionHeader("Date complication"),
    arborSelect("Drive arbor", date.driveShaftId, "driveShaftId",
      "An ordinary, continuously-driven arbor (e.g. a 24-hour wheel geared 2:1 from the hour wheel, SRC-0042) — built with the normal arbor/gear/mesh tools, nothing special about it. One of its own revolutions fires one jump (ASM-0048)."),
    arborSelect("Star arbor", date.starShaftId, "starShaftId",
      "The date star's own arbor. Must NOT be meshed with anything (DATE-002) — it advances only by the jump, never by continuous gear-train propagation."),
    selectRow("Display", date.display, [
      { value: "DAY_OF_MONTH", label: "Day of the month (1-31)" },
      { value: "DAY_OF_WEEK", label: "Day of the week (Mon-Sun)" },
    ], (display) => { edit({ display: display as DateDisplay }); },
    `What the star's positions are labelled with. A day-of-week star needs ${String(DAYS_PER_WEEK)} teeth, Monday first, and advances one step per 24-hour drive revolution (ASM-0081, SRC-0048, SRC-0049, DATE-004).`),
    inputRow({
      label: "Star tooth count", value: Number.isFinite(date.starToothCount) ? String(date.starToothCount) : "", step: "1",
      invalid: !(Number.isInteger(date.starToothCount) && date.starToothCount > 0),
      title: "Number of discrete positions (31 for a date, SRC-0042's own worked example; 7 for a day of the week, SRC-0048).",
      onCommit: (raw) => { edit({ starToothCount: parseRequired(raw) }); },
    }),
    inputRow({
      label: "Star tip Ø (mm)", value: mmText(date.starTipDiameter), step: "0.1", invalid: !positive(date.starTipDiameter),
      onCommit: (raw) => { edit({ starTipDiameter: millimetres(parseRequired(raw)) }); },
    }),
    inputRow({
      label: "Star thickness (mm)", value: mmText(date.starThickness), step: "0.05", invalid: !positive(date.starThickness),
      onCommit: (raw) => { edit({ starThickness: millimetres(parseRequired(raw)) }); },
    }),
    inputRow({
      label: "Star mid-plane height (mm)", value: mmText(date.starZCentre), step: "0.05", invalid: !Number.isFinite(date.starZCentre),
      onCommit: (raw) => { edit({ starZCentre: millimetres(parseRequired(raw)) }); },
    }),
    readonlyRow("Model", "jump mechanism, one step per drive revolution (ASM-0048)",
      "No jumper-spring energy storage, finger/cam contact geometry or quick-correction mechanism is modeled — only the net kinematic effect: one discrete step forward per drive-arbor revolution, never backward (SRC-0042)."),
    readonlyRow("Implied jump period", omega === undefined || omega === 0 ? "not driven" : formatPeriod(omega),
      "From the drive arbor's own solved angular velocity, versus one day (24 h) for a standard date mechanism (DATE-003, SRC-0042)."),
    readonlyRow("Current position", position === null ? "—"
      : date.display === "DAY_OF_WEEK" ? (WEEKDAY_NAMES[position] ?? String(position + 1))
      : `${String(position + 1)} of ${String(date.starToothCount)}`,
      "Position 0 reads as 1 (or Monday), an arbitrary reference like the hands' own 12 o'clock zero."),
    deleteRow(store, date.id, "Delete date complication", "The drive and star arbors are not removed."),
  ];
}
