import type { AppStore } from "@/app/store";
import { millimetres } from "@/units/length";
import { radians, toDegrees } from "@/units/angle";
import { radiansPerSecond } from "@/units/angularVelocity";
import { updateLeapYearComplication } from "@/domain/movement";
import { LEAP_YEAR_SLOT_COUNT, type LeapYearComplication } from "@/domain/leapYearComplication";
import type { MonthComplicationId } from "@/domain/monthComplication";
import type { ShaftId } from "@/domain/shaft";
import { starPosition } from "@/kinematics/dateComplication";
import { genevaDriverMotionAngle, genevaLambda, genevaWheelAdvanceAngle, genevaWheelAngularVelocity } from "@/kinematics/genevaDrive";
import { inputRow, mmText, parseRequired, readonlyRow, sectionHeader, selectRow, textRow } from "./fields";
import { deleteRow, positive, type Section } from "./common";

const YEAR_LABELS = ["Year 1", "Year 2", "Year 3", "Year 4 (leap)"];

export function leapYearComplicationSection(store: AppStore, year: LeapYearComplication): Section {
  const { movement } = store;
  const edit = (patch: Parameters<typeof updateLeapYearComplication>[2]): void => {
    store.edit((m) => updateLeapYearComplication(m, year.id, patch));
  };

  const monthSelect = selectRow("Month complication", year.monthComplicationId in movement.monthComplications ? year.monthComplicationId : "", [
    { value: "", label: "Choose a month complication…" },
    ...Object.values(movement.monthComplications).map((m) => ({ value: m.id, label: m.name })),
  ], (id) => { if (id !== "") edit({ monthComplicationId: id as MonthComplicationId }); },
    "The month complication whose December-to-January wrap drives this wheel (ASM-0050). This mechanism has no drive arbor of its own.");

  const arborSelect = selectRow("Wheel arbor", year.wheelShaftId in movement.shafts ? year.wheelShaftId : "", [
    { value: "", label: "Choose an arbor…" },
    ...Object.values(movement.shafts).map((s) => ({ value: s.id, label: s.name })),
  ], (id) => { if (id !== "") edit({ wheelShaftId: id as ShaftId }); },
    "The year wheel's own arbor. Must NOT be meshed with anything (YEAR-001) — it advances only by the jump, never by continuous gear-train propagation.");

  const position = year.wheelShaftId in movement.shafts
    ? starPosition(store.simulation.shaftAngle[year.wheelShaftId] ?? radians(0), LEAP_YEAR_SLOT_COUNT)
    : null;

  const n = LEAP_YEAR_SLOT_COUNT;
  const indexAngle = toDegrees(genevaWheelAdvanceAngle(n));
  const motionAngle = toDegrees(genevaDriverMotionAngle(n));
  const lambda = genevaLambda(n);
  const peakRatio = genevaWheelAngularVelocity(radiansPerSecond(1), radians(0), n);

  return [
    textRow("Name", year.name, (name) => { edit({ name }); }),
    sectionHeader("Leap-year complication"),
    monthSelect,
    arborSelect,
    inputRow({
      label: "Wheel tip Ø (mm)", value: mmText(year.wheelTipDiameter), step: "0.1", invalid: !positive(year.wheelTipDiameter),
      onCommit: (raw) => { edit({ wheelTipDiameter: millimetres(parseRequired(raw)) }); },
    }),
    inputRow({
      label: "Wheel thickness (mm)", value: mmText(year.wheelThickness), step: "0.05", invalid: !positive(year.wheelThickness),
      onCommit: (raw) => { edit({ wheelThickness: millimetres(parseRequired(raw)) }); },
    }),
    inputRow({
      label: "Wheel mid-plane height (mm)", value: mmText(year.wheelZCentre), step: "0.05", invalid: !Number.isFinite(year.wheelZCentre),
      onCommit: (raw) => { edit({ wheelZCentre: millimetres(parseRequired(raw)) }); },
    }),
    readonlyRow("Model", "driven by the month complication's own December-to-January wrap, one step per year (ASM-0050)",
      "Only the net kinematic effect is simulated: one discrete step once a year. SRC-0044's real mechanism is a year cam plus a Maltese cross; only the Geneva-drive component is modeled here."),
    readonlyRow("Reference Geneva figures", `${String(n)}-slot: ${indexAngle.toFixed(0)}° index / ${motionAngle.toFixed(0)}° driver motion, λ = ${lambda.toFixed(4)}, peak speed ratio ${peakRatio.toFixed(3)}`,
      "A real single-pin Geneva drive's own closed-form reference figures (SRC-0047) — not simulated continuously here, only reported (YEAR-002)."),
    readonlyRow("Current position", position === null ? "—" : YEAR_LABELS[position] ?? String(position + 1),
      "Position 0 reads as Year 1, an arbitrary reference; position 3 is the leap year by this entity's own convention. Century-exception leap-year rules are not modeled."),
    deleteRow(store, year.id, "Delete leap-year complication", "The referenced month complication and wheel arbor are not removed."),
  ];
}
