import type { AppStore } from "@/app/store";
import { millimetres } from "@/units/length";
import { radians } from "@/units/angle";
import { updateSeasonComplication } from "@/domain/movement";
import { SEASON_LABELS, SEASON_SLOT_COUNT, type SeasonComplication } from "@/domain/seasonComplication";
import type { MonthComplicationId } from "@/domain/monthComplication";
import type { ShaftId } from "@/domain/shaft";
import { starPosition } from "@/kinematics/dateComplication";
import { inputRow, mmText, parseRequired, readonlyRow, sectionHeader, selectRow, textRow } from "./fields";
import { deleteRow, positive, type Section } from "./common";

export function seasonComplicationSection(store: AppStore, season: SeasonComplication): Section {
  const { movement } = store;
  const edit = (patch: Parameters<typeof updateSeasonComplication>[2]): void => {
    store.edit((m) => updateSeasonComplication(m, season.id, patch));
  };

  const monthSelect = selectRow("Month complication", season.monthComplicationId in movement.monthComplications ? season.monthComplicationId : "", [
    { value: "", label: "Choose a month complication…" },
    ...Object.values(movement.monthComplications).map((m) => ({ value: m.id, label: m.name })),
  ], (id) => { if (id !== "") edit({ monthComplicationId: id as MonthComplicationId }); },
    "The month complication whose jump into January, April, July or October drives this wheel (ASM-0057). This mechanism has no drive arbor of its own.");

  const arborSelect = selectRow("Wheel arbor", season.wheelShaftId in movement.shafts ? season.wheelShaftId : "", [
    { value: "", label: "Choose an arbor…" },
    ...Object.values(movement.shafts).map((s) => ({ value: s.id, label: s.name })),
  ], (id) => { if (id !== "") edit({ wheelShaftId: id as ShaftId }); },
    "The season wheel's own arbor. Must NOT be meshed with anything (SEASON-001) — it advances only by the jump, never by continuous gear-train propagation.");

  const position = season.wheelShaftId in movement.shafts
    ? starPosition(store.simulation.shaftAngle[season.wheelShaftId] ?? radians(0), SEASON_SLOT_COUNT)
    : null;

  return [
    textRow("Name", season.name, (name) => { edit({ name }); }),
    sectionHeader("Season complication"),
    monthSelect,
    arborSelect,
    inputRow({
      label: "Wheel tip Ø (mm)", value: mmText(season.wheelTipDiameter), step: "0.1", invalid: !positive(season.wheelTipDiameter),
      onCommit: (raw) => { edit({ wheelTipDiameter: millimetres(parseRequired(raw)) }); },
    }),
    inputRow({
      label: "Wheel thickness (mm)", value: mmText(season.wheelThickness), step: "0.05", invalid: !positive(season.wheelThickness),
      onCommit: (raw) => { edit({ wheelThickness: millimetres(parseRequired(raw)) }); },
    }),
    inputRow({
      label: "Wheel mid-plane height (mm)", value: mmText(season.wheelZCentre), step: "0.05", invalid: !Number.isFinite(season.wheelZCentre),
      onCommit: (raw) => { edit({ wheelZCentre: millimetres(parseRequired(raw)) }); },
    }),
    readonlyRow("Model", "driven by the month complication's own jump into Jan/Apr/Jul/Oct, once a quarter (ASM-0057)",
      "A quarter indicator, not the real equation-of-time \"season\" complication — that is a different, unsourced mechanism this project has deliberately left unscoped. Labeled with the Southern Hemisphere's own astronomical seasons (Summer/Autumn/Winter/Spring for Q1–Q4), a declared choice (ASM-0057) since season names are hemisphere-dependent — the Northern Hemisphere reading of the same quarters would be Winter/Spring/Summer/Autumn. The jump is instantaneous: unlike the leap-year wheel, no sourced real mechanism exists here to simulate a real stroke shape from."),
    readonlyRow("Current position", position === null ? "—" : SEASON_LABELS[position] ?? String(position + 1),
      "Position 0 reads as Summer (the Southern Hemisphere's Q1, January–March), an arbitrary reference, same convention as the other jump-driven complication wheels."),
    deleteRow(store, season.id, "Delete season complication", "The referenced month complication and wheel arbor are not removed."),
  ];
}
