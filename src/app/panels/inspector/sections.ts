import type { AppStore } from "@/app/store";
import { millimetres, toMillimetres } from "@/units/length";
import { degrees, toDegrees } from "@/units/angle";
import { rpmToRadPerSecond, toRpm } from "@/units/angularVelocity";
import { toMillimetresPerSecond } from "@/units/linearVelocity";
import type { Vec2 } from "@/math/vec2";
import { gearPitchDiameter, type Gear } from "@/domain/gear";
import type { Shaft, ShaftEnd, ShaftPlacement } from "@/domain/shaft";
import type { BearingKind, Jewel } from "@/domain/jewel";
import type { Frame, FrameKind, Outline } from "@/domain/frame";
import type { GearMesh } from "@/domain/gearMesh";
import type { EntityId } from "@/domain/ids";
import {
  addGear,
  addGearMesh,
  addJewel,
  clearDrive,
  setDrivingShaft,
  updateFrame,
  updateGear,
  updateJewel,
  updateShaft,
  type Movement,
} from "@/domain/movement";
import { emptyOutline, newGear, newGearMesh, newJewel } from "@/domain/editing";
import { isValidModule, isValidToothCount, pitchLineVelocity } from "@/math/gearMath";
import {
  bearingInnerSpan,
  endshake,
  frameZRange,
  shaftSupport,
  sideShake,
} from "@/assembly/assemblyGeometry";
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

type Section = HTMLElement[];

/** The highest level any model in this app can currently support (kinematic gear train). */
const HIGHEST_MODELED_LEVEL = "L2_KINEMATIC";

function positive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function meshLabel(movement: Movement, mesh: GearMesh): string {
  return `${movement.gears[mesh.drivingGearId]?.name ?? "missing gear"} → ${movement.gears[mesh.drivenGearId]?.name ?? "missing gear"}`;
}

function deleteRow(store: AppStore, id: EntityId, label: string, cascade: string): HTMLDivElement {
  return actionRow(label, `${cascade} Undo with Ctrl+Z.`, () => {
    store.remove(id);
  }, true);
}

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
    sectionHeader("Contents"),
    readonlyRow("Frames", count(m.frames)),
    readonlyRow("Arbors", count(m.shafts)),
    readonlyRow("Gears", count(m.gears)),
    readonlyRow("Meshes", count(m.gearMeshes)),
    readonlyRow("Bearings", count(m.jewels)),
    readonlyRow("Tip", "Add frames and arbors from the component list, then select a part to edit it."),
  ];
}

// ---- gear -------------------------------------------------------------------

export function gearSection(store: AppStore, gear: Gear): Section {
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

  out.push(deleteRow(store, gear.id, "Delete gear", "Also removes its meshes."));
  return out;
}

// ---- shaft ------------------------------------------------------------------

interface EligibleMesh {
  mesh: GearMesh;
  referenceShaftId: Shaft["id"];
}

/** Meshes between a gear on this shaft and a gear on another shaft: usable for MESH_POLAR placement. */
function eligibleMeshes(movement: Movement, shaft: Shaft): EligibleMesh[] {
  const out: EligibleMesh[] = [];
  for (const mesh of Object.values(movement.gearMeshes)) {
    const a = movement.gears[mesh.drivingGearId];
    const b = movement.gears[mesh.drivenGearId];
    if (a === undefined || b === undefined || a.shaftId === b.shaftId) continue;
    if (a.shaftId === shaft.id) out.push({ mesh, referenceShaftId: b.shaftId });
    else if (b.shaftId === shaft.id) out.push({ mesh, referenceShaftId: a.shaftId });
  }
  return out;
}

function placementRows(store: AppStore, shaft: Shaft): Section {
  const { movement } = store;
  const setPlacement = (placement: ShaftPlacement): void => {
    store.edit((m) => updateShaft(m, shaft.id, { placement }));
  };
  const eligible = eligibleMeshes(movement, shaft);
  const placement = shaft.placement;
  const solved = store.analysis.placement.shaftPositions.get(shaft.id);

  const out: Section = [
    sectionHeader("Placement"),
    selectRow("Constraint", placement.kind, [
      { value: "FIXED", label: "Fixed coordinates" },
      {
        value: "MESH_POLAR",
        label: "At mesh centre distance",
        disabled: eligible.length === 0,
        title: eligible.length === 0 ? "Needs a mesh between a gear on this arbor and a gear on another arbor." : "",
      },
    ], (kind) => {
      if (kind === "FIXED") {
        // Starts from the currently solved position, if there is one: an explicit conversion, not a guess.
        const nan = millimetres(Number.NaN);
        setPlacement({ kind: "FIXED", position: solved ?? { x: nan, y: nan } });
        return;
      }
      const first = eligible[0];
      if (first !== undefined) {
        setPlacement({ kind: "MESH_POLAR", referenceShaftId: first.referenceShaftId, meshId: first.mesh.id, angle: degrees(Number.NaN) });
      }
    }, "Placement at mesh centre distance moves this arbor when tooth counts or module change (REF-ENG §5.2)."),
  ];

  if (placement.kind === "FIXED") {
    for (const axis of ["x", "y"] as const) {
      out.push(inputRow({
        label: `${axis.toUpperCase()} (mm)`, value: mmText(placement.position[axis]), step: "0.1",
        invalid: !Number.isFinite(placement.position[axis]),
        onCommit: (raw) => {
          setPlacement({ kind: "FIXED", position: { ...placement.position, [axis]: millimetres(parseRequired(raw)) } });
        },
      }));
    }
  } else {
    const options = eligible.map(({ mesh, referenceShaftId }) => ({
      value: mesh.id,
      label: `${meshLabel(movement, mesh)} (from ${movement.shafts[referenceShaftId]?.name ?? "?"})`,
    }));
    if (!eligible.some((e) => e.mesh.id === placement.meshId)) {
      options.unshift({ value: placement.meshId, label: "(missing or unusable mesh)" });
    }
    out.push(selectRow("Mesh", placement.meshId, options, (meshId) => {
      const chosen = eligible.find((e) => e.mesh.id === meshId);
      if (chosen !== undefined) {
        setPlacement({ ...placement, meshId: chosen.mesh.id, referenceShaftId: chosen.referenceShaftId });
      }
    }));
    out.push(readonlyRow("From", movement.shafts[placement.referenceShaftId]?.name ?? "missing shaft"));
    out.push(inputRow({
      label: "Direction (°)", value: Number.isFinite(placement.angle) ? String(toDegrees(placement.angle)) : "", step: "1",
      invalid: !Number.isFinite(placement.angle),
      title: "Angle from +X, counter-clockwise, seen from the bridge side.",
      onCommit: (raw) => { setPlacement({ ...placement, angle: degrees(parseRequired(raw)) }); },
    }));
  }
  out.push(readonlyRow("Solved position",
    solved === undefined ? "unresolved" : `${toMillimetres(solved.x).toFixed(4)}, ${toMillimetres(solved.y).toFixed(4)} mm`));
  return out;
}

function bearingRows(store: AppStore, shaft: Shaft): Section {
  const { movement } = store;
  const support = shaftSupport(movement, shaft.id);
  const frames = Object.values(movement.frames);
  const out: Section = [sectionHeader("Bearings")];
  for (const end of ["LOWER", "UPPER"] as ShaftEnd[]) {
    const jewel = end === "LOWER" ? support.lower : support.upper;
    const endLabel = end === "LOWER" ? "Lower" : "Upper";
    if (jewel !== null) {
      out.push(listRow(
        `${endLabel}: in ${movement.frames[jewel.frameId]?.name ?? "missing frame"}`,
        actionButton("Remove", "Remove this bearing", () => { store.remove(jewel.id); }, true),
        () => { store.select(jewel.id); },
      ));
    } else if (frames.length === 0) {
      out.push(readonlyRow(endLabel, "add a frame first"));
    } else {
      out.push(selectRow(`${endLabel} bearing`, "", [
        { value: "", label: "Add in frame…" },
        ...frames.map((f) => ({ value: f.id, label: f.name })),
      ], (frameId) => {
        const frame = frames.find((f) => f.id === frameId);
        if (frame !== undefined) store.edit((m) => addJewel(m, newJewel(m, shaft.id, end, frame.id)));
      }));
    }
  }
  return out;
}

export function shaftSection(store: AppStore, shaft: Shaft): Section {
  const { movement } = store;
  const edit = (patch: Parameters<typeof updateShaft>[2]): void => {
    store.edit((m) => updateShaft(m, shaft.id, patch));
  };
  const out: Section = [textRow("Name", shaft.name, (name) => { edit({ name }); }), ...placementRows(store, shaft)];

  const omega = store.analysis.train.shaftAngularVelocity.get(shaft.id);
  out.push(readonlyRow("Angular velocity", omega === undefined ? "unpowered" : `${toRpm(omega).toFixed(3)} rev/min`));

  out.push(sectionHeader("Drive"));
  if (movement.drivingShaftId === shaft.id) {
    out.push(inputRow({
      label: "Drive speed (rev/min)",
      value: Number.isFinite(movement.drivingAngularVelocity) ? String(toRpm(movement.drivingAngularVelocity)) : "",
      step: "0.1", invalid: !Number.isFinite(movement.drivingAngularVelocity),
      title: "Prescribed angular velocity of this arbor (ASM-0007). Positive is counter-clockwise seen from the bridge side.",
      onCommit: (raw) => { store.edit((m) => setDrivingShaft(m, shaft.id, rpmToRadPerSecond(parseRequired(raw)))); },
    }));
    out.push(actionRow("Remove drive", "The train will be unpowered", () => { store.edit(clearDrive); }));
  } else {
    out.push(readonlyRow("Driven by", movement.drivingShaftId === null ? "no drive set" : "the gear train"));
    out.push(actionRow("Make this the drive",
      "Moves the prescribed drive to this arbor, keeping the current drive speed (if any).", () => {
        store.edit((m) => setDrivingShaft(m, shaft.id,
          m.drivingShaftId === null ? rpmToRadPerSecond(Number.NaN) : m.drivingAngularVelocity));
      }));
  }

  out.push(sectionHeader("Gears"));
  for (const gear of Object.values(movement.gears).filter((g) => g.shaftId === shaft.id)) {
    out.push(listRow(gear.name, actionButton("Select", "Select this gear", () => { store.select(gear.id); })));
  }
  out.push(actionRow("Add gear", "Adds a gear to this arbor with every parameter empty.", () => {
    const gear = newGear(store.movement, shaft.id);
    store.edit((m) => addGear(m, gear));
    store.select(gear.id);
  }));

  out.push(...bearingRows(store, shaft));

  out.push(sectionHeader("Pivots (empty = unknown)"));
  for (const end of ["LOWER", "UPPER"] as ShaftEnd[]) {
    const value = shaft.pivotDiameter[end];
    out.push(inputRow({
      label: `${end === "LOWER" ? "Lower" : "Upper"} pivot Ø (mm)`, value: optionalMmText(value), step: "0.005",
      placeholder: "unknown", invalid: !isPositiveOrUnknown(value),
      onCommit: (raw) => { edit({ pivotDiameter: { ...shaft.pivotDiameter, [end]: parseOptionalMm(raw) } }); },
    }));
  }
  out.push(inputRow({
    label: "Shoulder span (mm)", value: optionalMmText(shaft.shoulderSpan), step: "0.01",
    placeholder: "unknown", invalid: !isPositiveOrUnknown(shaft.shoulderSpan),
    title: "Axial distance between the two pivot shoulders.",
    onCommit: (raw) => { edit({ shoulderSpan: parseOptionalMm(raw) }); },
  }));

  if (Object.keys(movement.frames).length > 0) {
    const support = shaftSupport(movement, shaft.id);
    out.push(sectionHeader("Bearing clearances (computed, not judged)"));
    out.push(readonlyRow("Side shake, lower", derivedText(sideShake(shaft, "LOWER", support.lower)),
      "Bore − pivot diameter, diametral (ASM-0013). No sourced acceptable range (BRG-005)."));
    out.push(readonlyRow("Side shake, upper", derivedText(sideShake(shaft, "UPPER", support.upper)),
      "Bore − pivot diameter, diametral (ASM-0013). No sourced acceptable range (BRG-005)."));
    out.push(readonlyRow("Space between bearings", derivedText(bearingInnerSpan(movement, support)),
      "Frame inner faces; bearing faces assumed flush (ASM-0011)."));
    out.push(readonlyRow("Endshake", derivedText(endshake(movement, shaft, support)),
      "Space between bearings − shoulder span (ASM-0011). No sourced acceptable range (BRG-005)."));
  }

  out.push(deleteRow(store, shaft.id, "Delete arbor",
    "Also removes its gears, their meshes and its bearings. Arbors placed from it will report an unresolved constraint."));
  return out;
}

// ---- jewel ------------------------------------------------------------------

export function jewelSection(store: AppStore, jewel: Jewel): Section {
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
    readonlyRow("Outer size", "not modeled (drawn at a placeholder size, ASM-0012)"),
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

export function frameSection(store: AppStore, frame: Frame): Section {
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
    deleteRow(store, frame.id, "Delete frame", "Also removes the bearings seated in it."),
  ];
}
