import type { AppStore } from "@/app/store";
import { millimetres } from "@/units/length";
import { radians } from "@/units/angle";
import { updateYearDigitComplication } from "@/domain/movement";
import { YEAR_DIGIT_LABELS, YEAR_DIGIT_PLACES, YEAR_DIGIT_SLOT_COUNT, type YearDigitComplication, type YearDigitPlace } from "@/domain/yearDigitComplication";
import type { MonthComplicationId } from "@/domain/monthComplication";
import type { ShaftId } from "@/domain/shaft";
import { starPosition } from "@/kinematics/dateComplication";
import { inputRow, mmText, parseRequired, readonlyRow, sectionHeader, selectRow, textRow } from "./fields";
import { deleteRow, positive, type Section } from "./common";

const DIGIT_PLACE_LABEL: Record<YearDigitPlace, string> = {
  ONES: "Ones",
  TENS: "Tens",
  HUNDREDS: "Hundreds",
  THOUSANDS: "Thousands",
};

export function yearDigitComplicationSection(store: AppStore, digit: YearDigitComplication): Section {
  const { movement } = store;
  const edit = (patch: Parameters<typeof updateYearDigitComplication>[2]): void => {
    store.edit((m) => updateYearDigitComplication(m, digit.id, patch));
  };

  const monthSelect = selectRow("Month complication", digit.monthComplicationId in movement.monthComplications ? digit.monthComplicationId : "", [
    { value: "", label: "Choose a month complication…" },
    ...Object.values(movement.monthComplications).map((m) => ({ value: m.id, label: m.name })),
  ], (id) => { if (id !== "") edit({ monthComplicationId: id as MonthComplicationId }); },
    "The month complication whose jump into January, April, July or October drives this wheel, once a year on the December-to-January wrap (same trigger as the leap-year/season wheels). This mechanism has no drive arbor of its own.");

  const digitPlaceSelect = selectRow("Digit place", digit.digitPlace, YEAR_DIGIT_PLACES.map((place) => ({ value: place, label: DIGIT_PLACE_LABEL[place] })),
    (value) => { edit({ digitPlace: value as YearDigitPlace }); },
    "Which decimal digit of the year this wheel shows. On each December-to-January wrap, the ones wheel always advances one step; a more significant place advances in the same event only if every place below it was sitting at 9 (decimal carry).");

  const arborSelect = selectRow("Wheel arbor", digit.wheelShaftId in movement.shafts ? digit.wheelShaftId : "", [
    { value: "", label: "Choose an arbor…" },
    ...Object.values(movement.shafts).map((s) => ({ value: s.id, label: s.name })),
  ], (id) => { if (id !== "") edit({ wheelShaftId: id as ShaftId }); },
    "This digit wheel's own arbor. Must NOT be meshed with anything (YEARDIGIT-001) — it advances only by the jump, never by continuous gear-train propagation.");

  const position = digit.wheelShaftId in movement.shafts
    ? starPosition(store.simulation.shaftAngle[digit.wheelShaftId] ?? radians(0), YEAR_DIGIT_SLOT_COUNT)
    : null;

  return [
    textRow("Name", digit.name, (name) => { edit({ name }); }),
    sectionHeader("Year digit complication (drum clock)"),
    monthSelect,
    digitPlaceSelect,
    arborSelect,
    inputRow({
      label: "Starting digit (0-9)", value: Number.isFinite(digit.startDigit) ? String(digit.startDigit) : "", step: "1",
      invalid: !(Number.isInteger(digit.startDigit) && digit.startDigit >= 0 && digit.startDigit <= 9),
      onCommit: (raw) => { edit({ startDigit: parseRequired(raw) }); },
    }),
    inputRow({
      label: "Wheel tip Ø (mm)", value: mmText(digit.wheelTipDiameter), step: "0.1", invalid: !positive(digit.wheelTipDiameter),
      onCommit: (raw) => { edit({ wheelTipDiameter: millimetres(parseRequired(raw)) }); },
    }),
    inputRow({
      label: "Wheel thickness (mm)", value: mmText(digit.wheelThickness), step: "0.05", invalid: !positive(digit.wheelThickness),
      onCommit: (raw) => { edit({ wheelThickness: millimetres(parseRequired(raw)) }); },
    }),
    inputRow({
      label: "Wheel mid-plane height (mm)", value: mmText(digit.wheelZCentre), step: "0.05", invalid: !Number.isFinite(digit.wheelZCentre),
      onCommit: (raw) => { edit({ wheelZCentre: millimetres(parseRequired(raw)) }); },
    }),
    readonlyRow("Model", "driven by the month complication's own December-to-January wrap, with decimal carry between digit places",
      "A \"drum clock\" year display: four separate digit wheels (ones/tens/hundreds/thousands), each architecturally identical to the leap-year/season wheels, together showing a 4-digit year. No sourced real wristwatch mechanism exists for a year display built this way, so the jump stays instantaneous, the same declared (not invented) treatment the season wheel has. There is no sourced way for a watch to know the real calendar year on its own: each wheel's own starting digit is independently declared, like setting a real digit wheel by hand."),
    readonlyRow("Current position", position === null ? "—" : YEAR_DIGIT_LABELS[position] ?? String(position),
      "Reads 0-9, this wheel's own currently-showing digit."),
    deleteRow(store, digit.id, "Delete year digit complication", "The referenced month complication and wheel arbor are not removed."),
  ];
}
