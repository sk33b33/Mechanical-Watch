import type { AppStore } from "@/app/store";
import { millimetres } from "@/units/length";
import { radians } from "@/units/angle";
import { updateMonthComplication } from "@/domain/movement";
import type { MonthComplication } from "@/domain/monthComplication";
import { GREGORIAN_MONTH_LENGTHS, MONTHS_PER_YEAR, MONTH_NAMES } from "@/kinematics/monthComplication";
import type { DateComplicationId } from "@/domain/dateComplication";
import type { ShaftId } from "@/domain/shaft";
import { starPosition } from "@/kinematics/dateComplication";
import { inputRow, mmText, parseRequired, readonlyRow, sectionHeader, selectRow, textRow } from "./fields";
import { deleteRow, positive, type Section } from "./common";

export function monthComplicationSection(store: AppStore, month: MonthComplication): Section {
  const { movement } = store;
  const edit = (patch: Parameters<typeof updateMonthComplication>[2]): void => {
    store.edit((m) => updateMonthComplication(m, month.id, patch));
  };

  const dateSelect = selectRow("Date complication", month.dateComplicationId in movement.dateComplications ? month.dateComplicationId : "", [
    { value: "", label: "Choose a date complication…" },
    ...Object.values(movement.dateComplications).map((d) => ({ value: d.id, label: d.name })),
  ], (id) => { if (id !== "") edit({ dateComplicationId: id as DateComplicationId }); },
    "The date complication this month star corrects and is driven by (ASM-0049). This mechanism has no drive arbor of its own.");

  const arborSelect = selectRow("Star arbor", month.starShaftId in movement.shafts ? month.starShaftId : "", [
    { value: "", label: "Choose an arbor…" },
    ...Object.values(movement.shafts).map((s) => ({ value: s.id, label: s.name })),
  ], (id) => { if (id !== "") edit({ starShaftId: id as ShaftId }); },
    "The month star's own arbor. Must NOT be meshed with anything (MONTH-001) — it advances only by the jump, never by continuous gear-train propagation.");

  const position = month.starShaftId in movement.shafts
    ? starPosition(store.simulation.shaftAngle[month.starShaftId] ?? radians(0), MONTHS_PER_YEAR)
    : null;

  const shortMonths = GREGORIAN_MONTH_LENGTHS
    .map((days, i) => ({ name: MONTH_NAMES[i] ?? String(i), days }))
    .filter((m) => m.days < 31);
  const scheduleSummary = shortMonths.map((m) => `${m.name} (${String(m.days)}d, +${String(31 - m.days)})`).join(", ");

  return [
    textRow("Name", month.name, (name) => { edit({ name }); }),
    sectionHeader("Month complication"),
    dateSelect,
    arborSelect,
    inputRow({
      label: "Star tip Ø (mm)", value: mmText(month.starTipDiameter), step: "0.1", invalid: !positive(month.starTipDiameter),
      onCommit: (raw) => { edit({ starTipDiameter: millimetres(parseRequired(raw)) }); },
    }),
    inputRow({
      label: "Star thickness (mm)", value: mmText(month.starThickness), step: "0.05", invalid: !positive(month.starThickness),
      onCommit: (raw) => { edit({ starThickness: millimetres(parseRequired(raw)) }); },
    }),
    inputRow({
      label: "Star mid-plane height (mm)", value: mmText(month.starZCentre), step: "0.05", invalid: !Number.isFinite(month.starZCentre),
      onCommit: (raw) => { edit({ starZCentre: millimetres(parseRequired(raw)) }); },
    }),
    readonlyRow("Model", "driven by the date complication's own jumps, one step per month (ASM-0049)",
      "No jumper-spring energy storage or finger/cam contact geometry is modeled — only the net kinematic effect: one discrete step once a month, timed by the date star's own enlarged end-of-month jump (SRC-0043)."),
    readonlyRow("Correction schedule", scheduleSummary === "" ? "—" : scheduleSummary,
      "Months shorter than 31 days, and the extra date-star step each gets at month end. February is fixed at 28 days — a leap-year complication, where present (Phase 8.4), tracks the 4-year cycle as an indicator only and is not wired back into this schedule (MONTH-002)."),
    readonlyRow("Current position", position === null ? "—" : MONTH_NAMES[position] ?? String(position + 1),
      "Position 0 reads as January, an arbitrary reference like the date star's own day 1."),
    deleteRow(store, month.id, "Delete month complication", "The referenced date complication and star arbor are not removed."),
  ];
}
