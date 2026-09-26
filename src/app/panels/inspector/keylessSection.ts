import type { AppStore } from "@/app/store";
import { millimetres } from "@/units/length";
import { degrees, toDegrees } from "@/units/angle";
import { updateDial, updateKeylessWorks } from "@/domain/movement";
import type { KeylessWorks, StemPinion } from "@/domain/keyless";
import type { Dial } from "@/domain/dial";
import type { GearId } from "@/domain/gear";
import type { ShaftId } from "@/domain/shaft";
import { isValidModule, isValidToothCount } from "@/math/gearMath";
import {
  clockPositionFromDial,
  crownSenseText,
  SETTING_UNAVAILABLE_TEXT,
  summarizeKeyless,
  WINDING_UNAVAILABLE_TEXT,
} from "@/kinematics/keylessSummary";
import type { StemEngagement } from "@/kinematics/keylessGeometry";
import { formatMm, inputRow, mmText, parseRequired, readonlyRow, sectionHeader, selectRow, textRow } from "./fields";
import { deleteRow, positive, type Section } from "./common";

function pinionRows(store: AppStore, keyless: KeylessWorks, key: "windingPinion" | "slidingPinion", label: string): Section {
  const pinion = keyless[key];
  const set = (patch: Partial<StemPinion>): void => {
    store.edit((m) => updateKeylessWorks(m, keyless.id, { [key]: { ...pinion, ...patch } }));
  };
  return [
    inputRow({
      label: `${label} teeth`, value: Number.isFinite(pinion.toothCount) ? String(pinion.toothCount) : "", step: "1",
      invalid: !isValidToothCount(pinion.toothCount),
      onCommit: (raw) => { set({ toothCount: parseRequired(raw) }); },
    }),
    inputRow({
      label: `${label} module (mm)`, value: mmText(pinion.module), step: "0.01", invalid: !isValidModule(pinion.module),
      onCommit: (raw) => { set({ module: millimetres(parseRequired(raw)) }); },
    }),
  ];
}

function engagementRows(label: string, engagement: StemEngagement | null): Section {
  if (engagement === null) return [readonlyRow(label, "needs defined teeth, modules, heights and placed wheels")];
  const ok = (v: number): string => (Math.abs(v) <= 1e-9 ? "0 (engages)" : formatMm(v));
  return [
    readonlyRow(`${label}: axis offset`, ok(engagement.planOffset),
      "Plan distance of the wheel's axis from the stem line. A right-angle mesh needs intersecting axes (KEY-002, ASM-0019)."),
    readonlyRow(`${label}: height error`, ok(engagement.heightError),
      "|stem height − wheel mid-plane| − pinion pitch radius (KEY-002)."),
  ];
}

export function keylessSection(store: AppStore, keyless: KeylessWorks): Section {
  const { movement } = store;
  const edit = (patch: Parameters<typeof updateKeylessWorks>[2]): void => {
    store.edit((m) => updateKeylessWorks(m, keyless.id, patch));
  };
  const gearOptions = [
    { value: "", label: "Choose a gear…" },
    ...Object.values(movement.gears).map((g) => ({ value: g.id, label: `${g.name} (${movement.shafts[g.shaftId]?.name ?? "?"})` })),
  ];
  const gearSelect = (label: string, value: GearId, key: "crownWheelGearId" | "settingWheelGearId" | "ratchetGearId", title: string): HTMLDivElement =>
    selectRow(label, value in movement.gears ? value : "", gearOptions, (id) => {
      if (id !== "") edit({ [key]: id as GearId });
    }, title);

  const summary = summarizeKeyless(movement, keyless, store.analysis.placement);
  const out: Section = [
    textRow("Name", keyless.name, (name) => { edit({ name }); }),
    sectionHeader("Stem"),
    inputRow({
      label: "Direction (°)", value: Number.isFinite(keyless.stemDirection) ? String(toDegrees(keyless.stemDirection)) : "", step: "1",
      invalid: !Number.isFinite(keyless.stemDirection),
      title: "Plan direction of the stem toward the crown, from +X, counter-clockwise seen from the bridge side. The stem passes over the crown wheel's axis.",
      onCommit: (raw) => { edit({ stemDirection: degrees(parseRequired(raw)) }); },
    }),
    readonlyRow("Crown at (from the dial)",
      Number.isFinite(keyless.stemDirection) ? `${clockPositionFromDial(keyless.stemDirection).toFixed(2)} o'clock` : "—"),
    inputRow({
      label: "Axis height (mm)", value: mmText(keyless.stemHeight), step: "0.05", invalid: !Number.isFinite(keyless.stemHeight),
      onCommit: (raw) => { edit({ stemHeight: millimetres(parseRequired(raw)) }); },
    }),
    readonlyRow("Position now", store.simulationTrain.stemPosition === "SETTING" ? "pulled out (setting)" : "pushed in (winding)",
      "Set by the toolbar mode. The setting lever and yoke are represented only by this position (ASM-0019)."),
    sectionHeader("Winding"),
    ...pinionRows(store, keyless, "windingPinion", "Winding pinion"),
    gearSelect("Crown wheel", keyless.crownWheelGearId, "crownWheelGearId", "The wheel the winding pinion engages at a right angle."),
    gearSelect("Ratchet wheel", keyless.ratchetGearId, "ratchetGearId", "Held by the click; its arbor winds the mainspring."),
    sectionHeader("Setting"),
    ...pinionRows(store, keyless, "slidingPinion", "Sliding pinion"),
    gearSelect("Setting wheel", keyless.settingWheelGearId, "settingWheelGearId", "The wheel the sliding pinion engages when the stem is pulled out."),
    sectionHeader("Engagement (right-angle pitch model)"),
    ...engagementRows("Winding pinion", summary.winding),
    ...engagementRows("Sliding pinion", summary.setting),
    sectionHeader("Calculated (model predicts)"),
    readonlyRow("Winds when turned",
      summary.windingSense === null
        ? `unknown: ${summary.windingUnavailable === null ? "not derivable" : WINDING_UNAVAILABLE_TEXT[summary.windingUnavailable]}`
        : crownSenseText(summary.windingSense),
      "Derived: the ratchet must turn the way the drum runs (ASM-0018). The other way, the ratchet teeth slip."),
    readonlyRow("Ratchet per crown turn", summary.ratchetPerCrown === null ? "—" : `${(summary.ratchetPerCrown).toFixed(6)} rev`,
      "Kinematic ratio only; no winding torque or spring state is modeled (ASM-0007)."),
    readonlyRow("Hands forward when turned",
      summary.handsForwardSense === null
        ? `unavailable: ${summary.settingState.status === "UNAVAILABLE" ? SETTING_UNAVAILABLE_TEXT[summary.settingState.reason] : "—"}`
        : crownSenseText(summary.handsForwardSense)),
    readonlyRow("Minutes hand per crown turn", summary.minutesPerCrown === null ? "—" : `${summary.minutesPerCrown.toFixed(6)} rev`),
    deleteRow(store, keyless.id, "Delete keyless works", "The wheels it refers to stay."),
  ];
  return out;
}

export function dialSection(store: AppStore, dial: Dial): Section {
  const { movement } = store;
  const edit = (patch: Parameters<typeof updateDial>[2]): void => {
    store.edit((m) => updateDial(m, dial.id, patch));
  };
  const back = dial.faceHeight + dial.thickness;
  return [
    textRow("Name", dial.name, (name) => { edit({ name }); }),
    sectionHeader("Dial"),
    selectRow("Centred on", dial.centreShaftId in movement.shafts ? dial.centreShaftId : "", [
      { value: "", label: "Choose an arbor…" },
      ...Object.values(movement.shafts).map((s) => ({ value: s.id, label: s.name })),
    ], (id) => { if (id !== "") edit({ centreShaftId: id as ShaftId }); }),
    inputRow({
      label: "Diameter (mm)", value: mmText(dial.diameter), step: "0.1", invalid: !positive(dial.diameter),
      onCommit: (raw) => { edit({ diameter: millimetres(parseRequired(raw)) }); },
    }),
    inputRow({
      label: "Thickness (mm)", value: mmText(dial.thickness), step: "0.05", invalid: !positive(dial.thickness),
      onCommit: (raw) => { edit({ thickness: millimetres(parseRequired(raw)) }); },
    }),
    inputRow({
      label: "Face height (mm)", value: mmText(dial.faceHeight), step: "0.05", invalid: !Number.isFinite(dial.faceHeight),
      title: "Height of the visible face (the −Z side). The dial sits on the dial side of the movement (ASM-0014).",
      onCommit: (raw) => { edit({ faceHeight: millimetres(parseRequired(raw)) }); },
    }),
    readonlyRow("Back height", Number.isFinite(back) ? formatMm(back, 3) : "—"),
    readonlyRow("Model", "flat disc (ASM-0020)", "Feet, holes for the hand pipes and printing are not modeled. The hour markers are visual."),
    deleteRow(store, dial.id, "Delete dial", "Nothing else is removed."),
  ];
}
