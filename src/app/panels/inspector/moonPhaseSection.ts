import type { AppStore } from "@/app/store";
import { millimetres } from "@/units/length";
import { updateMoonPhase } from "@/domain/movement";
import type { MoonPhase } from "@/domain/moonPhase";
import { windowsPerRevolution } from "@/domain/moonPhase";
import type { ShaftId } from "@/domain/shaft";
import { impliedLunationDays, lunationDriftMinutes, SYNODIC_MONTH_DAYS } from "@/kinematics/moonPhase";
import { inputRow, mmText, parseRequired, readonlyRow, sectionHeader, selectRow, textRow } from "./fields";
import { deleteRow, positive, type Section } from "./common";

export function moonPhaseSection(store: AppStore, moon: MoonPhase): Section {
  const { movement } = store;
  const edit = (patch: Parameters<typeof updateMoonPhase>[2]): void => {
    store.edit((m) => updateMoonPhase(m, moon.id, patch));
  };

  const omega = store.analysis.train.shaftAngularVelocity.get(moon.shaftId);
  const windows = windowsPerRevolution(moon.windowCount);
  const impliedDays = omega === undefined ? null : impliedLunationDays(omega, windows);
  const drift = impliedDays === null ? null : lunationDriftMinutes(impliedDays);

  return [
    textRow("Name", moon.name, (name) => { edit({ name }); }),
    sectionHeader("Moon phase disc"),
    selectRow("Mounted on", moon.shaftId in movement.shafts ? moon.shaftId : "", [
      { value: "", label: "Choose an arbor…" },
      ...Object.values(movement.shafts).map((s) => ({ value: s.id, label: s.name })),
    ], (id) => { if (id !== "") edit({ shaftId: id as ShaftId }); },
      "Turns continuously with this arbor (ASM-0047) — no jumper/cam mechanism, an ordinary gear-train reduction."),
    inputRow({
      label: "Diameter (mm)", value: mmText(moon.diameter), step: "0.1", invalid: !positive(moon.diameter),
      onCommit: (raw) => { edit({ diameter: millimetres(parseRequired(raw)) }); },
    }),
    inputRow({
      label: "Thickness (mm)", value: mmText(moon.thickness), step: "0.05", invalid: !positive(moon.thickness),
      onCommit: (raw) => { edit({ thickness: millimetres(parseRequired(raw)) }); },
    }),
    inputRow({
      label: "Face height (mm)", value: mmText(moon.faceHeight), step: "0.05", invalid: !Number.isFinite(moon.faceHeight),
      title: "Height of the visible face (the −Z side), same convention as the dial (ASM-0014).",
      onCommit: (raw) => { edit({ faceHeight: millimetres(parseRequired(raw)) }); },
    }),
    selectRow("Moon images", moon.windowCount, [
      { value: "DOUBLE", label: "Double (two, 180° apart)" },
      { value: "SINGLE", label: "Single (one, full turn per lunation)" },
    ], (value) => { edit({ windowCount: value as MoonPhase["windowCount"] }); },
      "Double is the conventional modern layout (ASM-0047, SRC-0045): a half-turn of the disc is one lunation."),
    readonlyRow("Model", "continuous gear-train disc (ASM-0047)",
      "Driven by the solved gear train, like any other arbor — no jumper/cam mechanism. Moon/star artwork is not modeled, only the disc itself (same visual-only scope as the dial's hour markers, ASM-0020). This project tracks no absolute calendar date, so this is not a claim to show the real moon phase on any particular date."),
    readonlyRow("Implied lunation", impliedDays === null ? "not driven" : `${impliedDays.toFixed(3)} days`,
      `Period of a full disc revolution ÷ ${String(windows)} (moon images per revolution), from the arbor's own solved angular velocity.`),
    readonlyRow("Drift vs. the real synodic month", drift === null ? "—" : `${drift >= 0 ? "+" : ""}${drift.toFixed(1)} min / lunation`,
      `Real synodic month: ${SYNODIC_MONTH_DAYS.toFixed(5)} days (SRC-0046, NASA/GSFC). A reported comparison only — never fed back into the model.`),
    deleteRow(store, moon.id, "Delete moon phase disc", "The arbor it is mounted on is not removed."),
  ];
}
