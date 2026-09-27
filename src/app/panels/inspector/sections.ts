import type { AppStore } from "@/app/store";
import type { KeyValueStore } from "@/persistence/autosave";
import { millimetres, toMillimetres } from "@/units/length";
import { toDegrees } from "@/units/angle";
import { toRpm } from "@/units/angularVelocity";
import { toMillimetresPerSecond } from "@/units/linearVelocity";
import type { Vec2 } from "@/math/vec2";
import { gearPitchDiameter, type Gear } from "@/domain/gear";
import type { BearingKind, Jewel } from "@/domain/jewel";
import type { Frame, FrameKind, Outline } from "@/domain/frame";
import {
  addGearMesh,
  clearDrive,
  minutesHandShaftId,
  setBalanceDrive,
  setNominalTimeDrive,
  updateFrame,
  updateGear,
  updateJewel,
  type Movement,
} from "@/domain/movement";
import { emptyOutline, newGearMesh } from "@/domain/editing";
import { isValidModule, isValidToothCount, pitchLineVelocity } from "@/math/gearMath";
import { frameZRange, sideShake } from "@/assembly/assemblyGeometry";
import { meshCentreDistanceStack, sideShakeStack } from "@/assembly/toleranceAnalysis";
import { VALIDATION_LEVELS, VALIDATION_LEVEL_LABELS, levelRank } from "@/reference/validationLevels";
import {
  actionButton,
  actionRow,
  derivedText,
  formatMm,
  inputRow,
  isPositiveOrUnknown,
  listRow,
  mmText,
  optionalMmText,
  parseOptionalMm,
  parseRequired,
  readonlyRow,
  sectionHeader,
  selectRow,
  textRow,
} from "./fields";
import { deleteRow, positive, type Section } from "./common";
import { stackText, stackTitle, toleranceSection } from "./toleranceSection";
import { presetRows } from "./presetsSection";

type NotifyFn = (message: string, kind: "error" | "info") => void;

/** The highest level any model in this app can currently support (kinematic gear train). */
const HIGHEST_MODELED_LEVEL = "L2_KINEMATIC";

// ---- movement ----------------------------------------------------------------

export function movementSection(store: AppStore): Section {
  const m = store.movement;
  const count = (r: object): string => String(Object.keys(r).length);
  return [
    sectionHeader("Movement"),
    textRow("Name", m.name, (name) => {
      store.edit((mv) => ({ ...mv, name }));
    }),
    selectRow(
      "Declared level",
      m.declaredValidationLevel,
      VALIDATION_LEVELS.map((level) => {
        const beyond = levelRank(level) > levelRank(HIGHEST_MODELED_LEVEL);
        return {
          value: level,
          label: VALIDATION_LEVEL_LABELS[level],
          disabled: beyond,
          title: beyond ? "Needs models this app does not have yet." : "",
        };
      }),
      (value) => {
        store.edit((mv) => ({ ...mv, declaredValidationLevel: value as Movement["declaredValidationLevel"] }));
      },
      "The level this design targets. Validation reports whether it is met and never raises it.",
    ),
    readonlyRow("Teaching demo", m.isTeachingDemo ? "yes (not a production caliber)" : "no"),
    sectionHeader("Drive"),
    selectRow("Drive", m.drive?.kind ?? "", [
      { value: "", label: "None" },
      {
        value: "NOMINAL_TIME",
        label: "Nominal time (minutes hand 1 rev/h)",
        disabled: minutesHandShaftId(m) === null,
        title: minutesHandShaftId(m) === null ? "Needs exactly one arbor carrying the minutes hand." : "",
      },
      {
        value: "BALANCE",
        label: "Governed by the balance (L3 simplified)",
        disabled: Object.keys(m.escapements).length === 0,
        title: Object.keys(m.escapements).length === 0
          ? "Needs an escapement with the balance inertia and hairspring stiffness entered."
          : "The balance's free frequency sets the rate (linear undamped oscillator, ASM-0024).",
      },
      {
        value: "PRESCRIBED",
        label: "Prescribed speed on an arbor",
        disabled: m.drive?.kind !== "PRESCRIBED",
        title: "Choose an arbor and use “Make this the drive” in its inspector.",
      },
    ], (value) => {
      store.edit(value === "NOMINAL_TIME" ? setNominalTimeDrive : value === "BALANCE" ? setBalanceDrive : clearDrive);
    }, "What sets the train in motion. Kinematic input only; no energy is modeled (ASM-0007)."),
    sectionHeader("Contents"),
    readonlyRow("Frames", count(m.frames)),
    readonlyRow("Arbors", count(m.shafts)),
    readonlyRow("Gears", count(m.gears)),
    readonlyRow("Meshes", count(m.gearMeshes)),
    readonlyRow("Bearings", count(m.jewels)),
    readonlyRow("Friction clutches", String(Object.values(m.couplings).filter((c) => c.kind === "FRICTION_CLUTCH").length)),
    readonlyRow("Tip", "Add frames and arbors from the component list, then select a part to edit it."),
  ];
}

// ---- gear -------------------------------------------------------------------

export function gearSection(store: AppStore, gear: Gear, storage: KeyValueStore | null, notify: NotifyFn): Section {
  const { movement } = store;
  const edit = (patch: Parameters<typeof updateGear>[2]): void => {
    store.edit((m) => updateGear(m, gear.id, patch));
  };
  const shaft = movement.shafts[gear.shaftId];
  const out: Section = [
    textRow("Name", gear.name, (name) => { edit({ name }); }),
    sectionHeader("Parameters (empty = not yet given)"),
    inputRow({
      label: "Tooth count", value: Number.isNaN(gear.toothCount) ? "" : String(gear.toothCount), step: "1",
      invalid: !isValidToothCount(gear.toothCount),
      onCommit: (raw) => { edit({ toothCount: parseRequired(raw) }); },
    }),
    inputRow({
      label: "Module (mm)", value: mmText(gear.module), step: "0.01", invalid: !isValidModule(gear.module),
      onCommit: (raw) => { edit({ module: millimetres(parseRequired(raw)) }); },
    }),
    inputRow({
      label: "Thickness (mm)", value: mmText(gear.thickness), step: "0.05", invalid: !positive(gear.thickness),
      onCommit: (raw) => { edit({ thickness: millimetres(parseRequired(raw)) }); },
    }),
    inputRow({
      label: "Axial position (mm)", value: mmText(gear.zCentre), step: "0.05", invalid: !Number.isFinite(gear.zCentre),
      title: "Height of the gear's mid-plane.",
      onCommit: (raw) => { edit({ zCentre: millimetres(parseRequired(raw)) }); },
    }),
    readonlyRow("Tooth profile", gear.profileModel,
      "Pitch-circle model (REF-ENG §6). The drawn teeth are a visual approximation (ASM-0005)."),
    readonlyRow("Pressure angle",
      gear.pressureAngle === null ? "not modeled" : `${toDegrees(gear.pressureAngle).toFixed(1)}°`,
      "A pitch model has no tooth flank, so no pressure angle is assumed."),
  ];
  out.push(shaft === undefined
    ? readonlyRow("Arbor", "missing")
    : listRow(`Arbor: ${shaft.name}`, actionButton("Select", "Select this arbor", () => { store.select(shaft.id); })));

  out.push(sectionHeader("Meshes"));
  const meshedWith = new Set<string>();
  for (const mesh of Object.values(movement.gearMeshes)) {
    if (mesh.drivingGearId !== gear.id && mesh.drivenGearId !== gear.id) continue;
    const otherId = mesh.drivingGearId === gear.id ? mesh.drivenGearId : mesh.drivingGearId;
    meshedWith.add(otherId);
    const other = movement.gears[otherId];
    out.push(listRow(
      `${mesh.drivingGearId === gear.id ? "Drives" : "Driven by"} ${other?.name ?? "missing gear"}`,
      actionButton("Remove", "Remove this mesh. Arbors placed from it will report an unresolved constraint.", () => {
        store.remove(mesh.id);
      }, true),
      other === undefined ? undefined : () => { store.select(other.id); },
    ));
    if (Object.keys(movement.tolerances).length > 0) {
      const result = meshCentreDistanceStack(movement, mesh, store.analysis.placement);
      out.push(readonlyRow(`Centre distance (tol., with ${other?.name ?? "missing gear"})`, stackText(result),
        `${stackTitle(result)} A first-order (Taylor) approximation around the placed distance (ASM-0027).`));
    }
  }
  const candidates = Object.values(movement.gears).filter(
    (g) => g.shaftId !== gear.shaftId && !meshedWith.has(g.id),
  );
  out.push(selectRow("Mesh with", "", [
    { value: "", label: candidates.length === 0 ? "no gear on another arbor" : "Choose a gear…" },
    ...candidates.map((g) => ({ value: g.id, label: `${g.name} (${movement.shafts[g.shaftId]?.name ?? "?"})` })),
  ], (value) => {
    const other = candidates.find((g) => g.id === value);
    if (other !== undefined) store.edit((m) => addGearMesh(m, newGearMesh(gear.id, other.id)));
  }, "This gear becomes the driving gear of the new mesh."));

  out.push(sectionHeader("Calculated (model predicts)"));
  const pitch = isValidToothCount(gear.toothCount) && isValidModule(gear.module) ? gearPitchDiameter(gear) : null;
  out.push(readonlyRow("Pitch diameter", pitch === null ? "needs tooth count and module" : formatMm(pitch), "d = m z (REF-ENG §5.1)"));
  const omega = store.analysis.train.shaftAngularVelocity.get(gear.shaftId);
  out.push(readonlyRow("Angular velocity", omega === undefined ? "unpowered" : `${toRpm(omega).toFixed(3)} rev/min`,
    "Propagated stage by stage, ω2/ω1 = −z1/z2 (REF-ENG §5.3). Sign gives direction."));
  out.push(readonlyRow("Pitch-line velocity",
    omega === undefined || pitch === null ? "—" : `${toMillimetresPerSecond(pitchLineVelocity(omega, pitch)).toFixed(4)} mm/s`,
    "v = ω r (REF-ENG §5.5)"));

  out.push(...toleranceSection(store, gear.id));
  out.push(
    ...presetRows(
      "Gear",
      { module: Number.isFinite(gear.module) ? gear.module : null, thickness: Number.isFinite(gear.thickness) ? gear.thickness : null },
      (values) => {
        edit({ module: values.module ?? gear.module, thickness: values.thickness ?? gear.thickness });
      },
      storage,
      notify,
    ),
  );
  out.push(deleteRow(store, gear.id, "Delete gear", "Also removes its meshes."));
  return out;
}

// ---- jewel ------------------------------------------------------------------

export function jewelSection(store: AppStore, jewel: Jewel, storage: KeyValueStore | null, notify: NotifyFn): Section {
  const { movement } = store;
  const shaft = movement.shafts[jewel.shaftId];
  const frame = movement.frames[jewel.frameId];
  const edit = (patch: Parameters<typeof updateJewel>[2]): void => {
    store.edit((m) => updateJewel(m, jewel.id, patch));
  };
  return [
    textRow("Name", jewel.name, (name) => { edit({ name }); }),
    sectionHeader("Bearing"),
    selectRow("Type", jewel.kind, [
      { value: "HOLE_JEWEL", label: "Hole jewel" },
      { value: "PLAIN_HOLE", label: "Plain hole" },
    ], (kind) => { edit({ kind: kind as BearingKind }); }),
    readonlyRow("Supports", `${shaft?.name ?? "missing shaft"}, ${jewel.end.toLowerCase()} end`),
    readonlyRow("In frame", frame?.name ?? "missing frame"),
    readonlyRow("Position", "on the shaft's solved axis",
      "Bearings have no position of their own, so a shaft's two bearings are always coaxial."),
    inputRow({
      label: "Bore Ø (mm)", value: optionalMmText(jewel.boreDiameter), step: "0.005",
      placeholder: "unknown", invalid: !isPositiveOrUnknown(jewel.boreDiameter),
      onCommit: (raw) => { edit({ boreDiameter: parseOptionalMm(raw) }); },
    }),
    readonlyRow("Side shake", shaft === undefined ? "—" : derivedText(sideShake(shaft, jewel.end, jewel)),
      "Bore − pivot diameter, diametral (ASM-0013). Not judged (BRG-005)."),
    ...(shaft === undefined || Object.keys(movement.tolerances).length === 0
      ? []
      : ((result) => [readonlyRow("Side shake (tol.)", stackText(result), stackTitle(result))])(
          sideShakeStack(movement, shaft, jewel.end, jewel),
        )),
    readonlyRow("Outer size", "not modeled (drawn at a placeholder size, ASM-0012)"),
    ...toleranceSection(store, jewel.id),
    ...presetRows("Jewel", { boreDiameter: jewel.boreDiameter }, (values) => {
      edit({ boreDiameter: values.boreDiameter ?? jewel.boreDiameter });
    }, storage, notify),
    deleteRow(store, jewel.id, "Delete bearing", "The shaft end becomes unsupported."),
  ];
}

// ---- frame ------------------------------------------------------------------

function pointRow(store: AppStore, frame: Frame, points: Vec2[], index: number): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "field point-row";
  const label = document.createElement("label");
  label.textContent = `Point ${String(index + 1)}`;
  const setPoints = (next: Vec2[]): void => {
    store.edit((m) => updateFrame(m, frame.id, { outline: { kind: "POLYGON", points: next } }));
  };
  const coordinate = (axis: "x" | "y"): HTMLInputElement => {
    const input = document.createElement("input");
    input.type = "number";
    input.step = "0.1";
    input.placeholder = axis.toUpperCase();
    input.title = `${axis.toUpperCase()} (mm)`;
    const point = points[index];
    input.value = point === undefined ? "" : mmText(point[axis]);
    input.dataset.field = `Point ${String(index + 1)} ${axis.toUpperCase()}`;
    if (point !== undefined && !Number.isFinite(point[axis])) input.classList.add("invalid");
    input.addEventListener("change", () => {
      setPoints(points.map((p, i) => (i === index ? { ...p, [axis]: millimetres(parseRequired(input.value)) } : p)));
    });
    return input;
  };
  const remove = actionButton("×", "Remove this point", () => {
    setPoints(points.filter((_, i) => i !== index));
  });
  row.append(label, coordinate("x"), coordinate("y"), remove);
  return row;
}

function outlineRows(store: AppStore, frame: Frame): Section {
  const outline = frame.outline;
  const setOutline = (next: Outline): void => {
    store.edit((m) => updateFrame(m, frame.id, { outline: next }));
  };
  const out: Section = [
    selectRow("Outline", outline.kind, [
      { value: "CIRCLE", label: "Circle" },
      { value: "POLYGON", label: "Polygon" },
    ], (kind) => { setOutline(emptyOutline(kind as Outline["kind"])); },
    "Switching shape starts a new, empty outline (undo restores the old one)."),
  ];
  if (outline.kind === "CIRCLE") {
    for (const axis of ["x", "y"] as const) {
      out.push(inputRow({
        label: `Centre ${axis.toUpperCase()} (mm)`, value: mmText(outline.centre[axis]), step: "0.1",
        invalid: !Number.isFinite(outline.centre[axis]),
        onCommit: (raw) => { setOutline({ ...outline, centre: { ...outline.centre, [axis]: millimetres(parseRequired(raw)) } }); },
      }));
    }
    out.push(inputRow({
      label: "Diameter (mm)", value: Number.isFinite(outline.radius) ? String(toMillimetres(outline.radius) * 2) : "", step: "0.1",
      invalid: !positive(outline.radius),
      onCommit: (raw) => { setOutline({ ...outline, radius: millimetres(parseRequired(raw) / 2) }); },
    }));
  } else {
    outline.points.forEach((_, i) => { out.push(pointRow(store, frame, outline.points, i)); });
    out.push(actionRow("Add point", "Appends an empty point to the outline", () => {
      const nan = millimetres(Number.NaN);
      setOutline({ kind: "POLYGON", points: [...outline.points, { x: nan, y: nan }] });
    }));
  }
  return out;
}

export function frameSection(store: AppStore, frame: Frame, storage: KeyValueStore | null, notify: NotifyFn): Section {
  const edit = (patch: Parameters<typeof updateFrame>[2]): void => {
    store.edit((m) => updateFrame(m, frame.id, patch));
  };
  const range = frameZRange(frame);
  const bearings = Object.values(store.movement.jewels).filter((j) => j.frameId === frame.id).length;
  return [
    textRow("Name", frame.name, (name) => { edit({ name }); }),
    sectionHeader("Frame"),
    selectRow("Kind", frame.kind, [
      { value: "MAINPLATE", label: "Mainplate" },
      { value: "BRIDGE", label: "Bridge" },
    ], (kind) => { edit({ kind: kind as FrameKind }); }),
    ...outlineRows(store, frame),
    inputRow({
      label: "Underside height (mm)", value: mmText(frame.zBottom), step: "0.05", invalid: !Number.isFinite(frame.zBottom),
      onCommit: (raw) => { edit({ zBottom: millimetres(parseRequired(raw)) }); },
    }),
    inputRow({
      label: "Thickness (mm)", value: mmText(frame.thickness), step: "0.05", invalid: !positive(frame.thickness),
      onCommit: (raw) => { edit({ thickness: millimetres(parseRequired(raw)) }); },
    }),
    readonlyRow("Top height", Number.isFinite(range.hi) ? formatMm(range.hi, 3) : "—"),
    readonlyRow("Bearings", String(bearings)),
    readonlyRow("Model", "flat slab (ASM-0010)", "Pillars, screws, recesses and sinks are not modeled."),
    ...toleranceSection(store, frame.id),
    ...presetRows("Frame", { thickness: Number.isFinite(frame.thickness) ? frame.thickness : null }, (values) => {
      edit({ thickness: values.thickness ?? frame.thickness });
    }, storage, notify),
    deleteRow(store, frame.id, "Delete frame", "Also removes the bearings seated in it."),
  ];
}
