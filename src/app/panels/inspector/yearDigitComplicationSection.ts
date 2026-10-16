import type { AppStore } from "@/app/store";
import { millimetres } from "@/units/length";
import { degrees, radians, toDegrees } from "@/units/angle";
import { updateYearDigitComplication } from "@/domain/movement";
import { YEAR_DIGIT_LABELS, YEAR_DIGIT_PLACES, YEAR_DIGIT_SLOT_COUNT, type YearDigitComplication, type YearDigitPlace } from "@/domain/yearDigitComplication";
import { starPosition } from "@/kinematics/dateComplication";
import type { MonthComplicationId } from "@/domain/monthComplication";
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
    "The month complication whose jump into January, April, July or October drives this barrel segment, once a year on the December-to-January wrap (same trigger as the leap-year/season wheels). This mechanism has no drive arbor of its own.");

  const digitPlaceSelect = selectRow("Digit place", digit.digitPlace, YEAR_DIGIT_PLACES.map((place) => ({ value: place, label: DIGIT_PLACE_LABEL[place] })),
    (value) => { edit({ digitPlace: value as YearDigitPlace }); },
    "Which decimal digit of the year this segment shows. On each December-to-January wrap, the ones segment always advances one step; a more significant place advances in the same event only if every place below it was sitting at 9 (decimal carry).");

  const position = digit.id in store.simulation.yearDigitAngle
    ? starPosition(store.simulation.yearDigitAngle[digit.id] ?? radians(0), YEAR_DIGIT_SLOT_COUNT)
    : null;

  return [
    textRow("Name", digit.name, (name) => { edit({ name }); }),
    sectionHeader("Year digit complication (horizontal-axis barrel)"),
    monthSelect,
    digitPlaceSelect,
    inputRow({
      label: "Starting digit (0-9)", value: Number.isFinite(digit.startDigit) ? String(digit.startDigit) : "", step: "1",
      invalid: !(Number.isInteger(digit.startDigit) && digit.startDigit >= 0 && digit.startDigit <= 9),
      onCommit: (raw) => { edit({ startDigit: parseRequired(raw) }); },
    }),
    sectionHeader("Axle (horizontal, ASM-0019-style exception to ASM-0006)"),
    inputRow({
      label: "Axle origin X (mm)", value: mmText(digit.axleOrigin.x), step: "0.1", invalid: !Number.isFinite(digit.axleOrigin.x),
      onCommit: (raw) => { edit({ axleOrigin: { ...digit.axleOrigin, x: millimetres(parseRequired(raw)) } }); },
    }),
    inputRow({
      label: "Axle origin Y (mm)", value: mmText(digit.axleOrigin.y), step: "0.1", invalid: !Number.isFinite(digit.axleOrigin.y),
      onCommit: (raw) => { edit({ axleOrigin: { ...digit.axleOrigin, y: millimetres(parseRequired(raw)) } }); },
    }),
    inputRow({
      label: "Axle direction (°)", value: Number.isFinite(digit.axleDirection) ? String(toDegrees(digit.axleDirection)) : "", step: "1",
      invalid: !Number.isFinite(digit.axleDirection),
      title: "Plan direction of the barrel's rotation axis, from +X, counter-clockwise seen from the bridge side.",
      onCommit: (raw) => { edit({ axleDirection: degrees(parseRequired(raw)) }); },
    }),
    inputRow({
      label: "Axle height (mm)", value: mmText(digit.axleHeight), step: "0.05", invalid: !Number.isFinite(digit.axleHeight),
      onCommit: (raw) => { edit({ axleHeight: millimetres(parseRequired(raw)) }); },
    }),
    inputRow({
      label: "Barrel Ø (mm)", value: mmText(digit.barrelDiameter), step: "0.1", invalid: !positive(digit.barrelDiameter),
      onCommit: (raw) => { edit({ barrelDiameter: millimetres(parseRequired(raw)) }); },
    }),
    inputRow({
      label: "Segment length (mm)", value: mmText(digit.segmentLength), step: "0.1", invalid: !positive(digit.segmentLength),
      title: "Length of this segment along the axle (the along-axis width of its digit face).",
      onCommit: (raw) => { edit({ segmentLength: millimetres(parseRequired(raw)) }); },
    }),
    readonlyRow("Model", "driven by the month complication's own December-to-January wrap, with decimal carry between digit places",
      "A \"page-flip\" year display: a horizontal-axis barrel, divided along its own axle into one segment per declared digit place (ones/tens/hundreds/thousands), together showing a 4-digit year through one shared rectangular dial window. Not a Shaft (ASM-0019-style exception to ASM-0006, Phase 8.15); driven only by the jump, never by continuous gear-train propagation. No sourced real wristwatch mechanism exists for a year display built this way, so the jump stays instantaneous, the same declared (not invented) treatment the season wheel already has. There is no sourced way for a watch to know the real calendar year on its own: this segment's own starting digit is independently declared, like setting a real digit wheel by hand."),
    readonlyRow("Current position", position === null ? "—" : YEAR_DIGIT_LABELS[position] ?? String(position),
      "Reads 0-9, this segment's own currently-facing digit."),
    deleteRow(store, digit.id, "Delete year digit complication", "The referenced month complication is not removed."),
  ];
}
