import type { AppStore } from "@/app/store";
import type { KeyValueStore } from "@/persistence/autosave";
import { millimetres, toMillimetres } from "@/units/length";
import { degrees, toDegrees } from "@/units/angle";
import { rpmToRadPerSecond, toRpm } from "@/units/angularVelocity";
import { distance } from "@/math/vec2";
import type { HandFunction, Shaft, ShaftEnd, ShaftPlacement, ShaftSupport } from "@/domain/shaft";
import type { GearMesh } from "@/domain/gearMesh";
import {
  addCoupling,
  addGear,
  addJewel,
  clearDrive,
  drivenShaftId,
  setPrescribedDrive,
  updateShaft,
  type Movement,
} from "@/domain/movement";
import { newFrictionClutch, newGear, newJewel, newMainspring } from "@/domain/editing";
import { bearingInnerSpan, endshake, shaftSupport, sideShake } from "@/assembly/assemblyGeometry";
import { endshakeStack, sideShakeStack } from "@/assembly/toleranceAnalysis";
import { formatPeriod } from "@/kinematics/timeDisplay";
import { NUMERICAL_PARAMETERS } from "@/reference/numericalParameters";
import {
  actionButton,
  actionRow,
  derivedText,
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
import { deleteRow, meshLabel, type Section } from "./common";
import { stackText, stackTitle, toleranceSection } from "./toleranceSection";
import { mainspringDataRows } from "./energySection";
import { presetRows } from "./presetsSection";

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
  const others = Object.values(movement.shafts).filter((s) => s.id !== shaft.id);
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
      {
        value: "COAXIAL",
        label: "On another arbor's axis",
        disabled: others.length === 0,
        title: "Shares another arbor's axis but turns independently (e.g. a cannon pinion or hour wheel).",
      },
    ], (kind) => {
      if (kind === "FIXED") {
        // Starts from the currently solved position, if there is one: an explicit conversion, not a guess.
        const nan = millimetres(Number.NaN);
        setPlacement({ kind: "FIXED", position: solved ?? { x: nan, y: nan } });
      } else if (kind === "MESH_POLAR") {
        const first = eligible[0];
        if (first !== undefined) {
          setPlacement({ kind: "MESH_POLAR", referenceShaftId: first.referenceShaftId, meshId: first.mesh.id, angle: degrees(Number.NaN) });
        }
      } else {
        const first = others[0];
        if (first !== undefined) setPlacement({ kind: "COAXIAL", referenceShaftId: first.id });
      }
    }, "Mesh-centre-distance placement moves this arbor when tooth counts or module change (REF-ENG §5.2)."),
  ];

  switch (placement.kind) {
    case "FIXED":
      for (const axis of ["x", "y"] as const) {
        out.push(inputRow({
          label: `${axis.toUpperCase()} (mm)`, value: mmText(placement.position[axis]), step: "0.1",
          invalid: !Number.isFinite(placement.position[axis]),
          onCommit: (raw) => {
            setPlacement({ kind: "FIXED", position: { ...placement.position, [axis]: millimetres(parseRequired(raw)) } });
          },
        }));
      }
      break;
    case "MESH_POLAR": {
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
      break;
    }
    case "COAXIAL": {
      const options = others.map((s) => ({ value: s.id, label: s.name }));
      if (!others.some((s) => s.id === placement.referenceShaftId)) {
        options.unshift({ value: placement.referenceShaftId, label: "(missing shaft)" });
      }
      out.push(selectRow("Axis of", placement.referenceShaftId, options, (id) => {
        const chosen = others.find((s) => s.id === id);
        if (chosen !== undefined) setPlacement({ kind: "COAXIAL", referenceShaftId: chosen.id });
      }));
      break;
    }
  }
  out.push(readonlyRow("Solved position",
    solved === undefined ? "unresolved" : `${toMillimetres(solved.x).toFixed(4)}, ${toMillimetres(solved.y).toFixed(4)} mm`));
  return out;
}

function supportRows(store: AppStore, shaft: Shaft): Section {
  const { movement } = store;
  const frames = Object.values(movement.frames);
  const value = shaft.support.kind === "STUD" ? `STUD:${shaft.support.frameId}` : shaft.support.kind;
  return [
    selectRow("Held by", value, [
      { value: "PIVOTED", label: "Pivots in bearings" },
      ...frames.map((f) => ({ value: `STUD:${f.id}`, label: `Stud in ${f.name}` })),
      { value: "CARRIED", label: "Riding on its coaxial arbor" },
    ], (choice) => {
      const support: ShaftSupport = choice.startsWith("STUD:")
        ? { kind: "STUD", frameId: choice.slice("STUD:".length) as Extract<ShaftSupport, { kind: "STUD" }>["frameId"] }
        : { kind: choice as "PIVOTED" | "CARRIED" };
      store.edit((m) => updateShaft(m, shaft.id, { support }));
    }, "How this rotating part is held (REF-ENG §12). Only pivoted arbors need their own bearings."),
  ];
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

function clutchRows(store: AppStore, shaft: Shaft): Section {
  const { movement } = store;
  const positions = store.analysis.placement.shaftPositions;
  const out: Section = [sectionHeader("Friction clutches")];
  const coupledWith = new Set<string>();
  for (const coupling of Object.values(movement.couplings)) {
    if (coupling.shaftAId !== shaft.id && coupling.shaftBId !== shaft.id) continue;
    if (coupling.kind !== "FRICTION_CLUTCH") continue;
    const otherId = coupling.shaftAId === shaft.id ? coupling.shaftBId : coupling.shaftAId;
    coupledWith.add(otherId);
    const other = movement.shafts[otherId];
    out.push(listRow(`With ${other?.name ?? "missing shaft"}`,
      actionButton("Remove", "Remove this clutch", () => { store.remove(coupling.id); }, true),
      other === undefined ? undefined : () => { store.select(other.id); }));
  }
  const axis = positions.get(shaft.id);
  const candidates = Object.values(movement.shafts).filter((s) => {
    if (s.id === shaft.id || coupledWith.has(s.id)) return false;
    const p = positions.get(s.id);
    return axis !== undefined && p !== undefined && distance(axis, p) <= NUMERICAL_PARAMETERS.centreDistanceToleranceMetres;
  });
  out.push(selectRow("Add clutch to", "", [
    { value: "", label: candidates.length === 0 ? "no coaxial arbor" : "Choose a coaxial arbor…" },
    ...candidates.map((s) => ({ value: s.id, label: s.name })),
  ], (id) => {
    const other = candidates.find((s) => s.id === id);
    if (other !== undefined) store.edit((m) => addCoupling(m, newFrictionClutch(m, shaft.id, other.id)));
  }, "Turns with the other arbor while running; slips during hand setting (REF-ENG §8, ASM-0015)."));
  return out;
}

/** The mainspring link from a barrel arbor to its drum (ASM-0018), with the spring's data on the arbor (ASM-0026). */
function mainspringRows(store: AppStore, shaft: Shaft): Section {
  const { movement } = store;
  const positions = store.analysis.placement.shaftPositions;
  const out: Section = [sectionHeader("Mainspring")];
  const springs = Object.values(movement.couplings).filter(
    (c) => c.kind === "MAINSPRING" && (c.shaftAId === shaft.id || c.shaftBId === shaft.id),
  );
  for (const spring of springs) {
    const winds = spring.shaftAId === shaft.id;
    const other = movement.shafts[winds ? spring.shaftBId : spring.shaftAId];
    out.push(listRow(winds ? `Winds the drum ${other?.name ?? "missing arbor"}` : `Wound by ${other?.name ?? "missing arbor"}`,
      actionButton("Remove", "Remove this mainspring link", () => { store.remove(spring.id); }, true),
      other === undefined ? undefined : () => { store.select(other.id); }));
    if (winds && spring.kind === "MAINSPRING") out.push(...mainspringDataRows(store, spring));
  }
  if (springs.length > 0) return out;
  const axis = positions.get(shaft.id);
  const candidates = Object.values(movement.shafts).filter((s) => {
    if (s.id === shaft.id) return false;
    const p = positions.get(s.id);
    return axis !== undefined && p !== undefined && distance(axis, p) <= NUMERICAL_PARAMETERS.centreDistanceToleranceMetres;
  });
  if (candidates.length === 0) return [];
  out.push(selectRow("This arbor winds", "", [
    { value: "", label: "Choose the coaxial drum…" },
    ...candidates.map((s) => ({ value: s.id, label: s.name })),
  ], (id) => {
    const step = store.tutorialActive && store.tutorialStep?.targetSelector === '[data-field="This arbor winds"]' ? store.tutorialStep : null;
    if (step?.createOverride !== undefined) {
      store.runTutorialCreation(step.id, step.createOverride);
      return;
    }
    const drum = candidates.find((s) => s.id === id);
    if (drum !== undefined) store.edit((m) => addCoupling(m, newMainspring(m, shaft.id, drum.id)));
  }, "Declares a mainspring from this barrel arbor to the drum. It sets which way the crown winds (ASM-0018); spring data for the energy model can be entered afterwards (ASM-0026)."));
  return out;
}

function driveRows(store: AppStore, shaft: Shaft): Section {
  const { movement } = store;
  const drive = movement.drive;
  const out: Section = [sectionHeader("Drive")];
  if (drive?.kind === "PRESCRIBED" && drive.shaftId === shaft.id) {
    out.push(inputRow({
      label: "Drive speed (rev/min)",
      value: Number.isFinite(drive.angularVelocity) ? String(toRpm(drive.angularVelocity)) : "",
      step: "0.1", invalid: !Number.isFinite(drive.angularVelocity),
      title: "Prescribed angular velocity of this arbor (ASM-0007). Positive is counter-clockwise seen from the bridge side (clockwise from the dial).",
      onCommit: (raw) => { store.edit((m) => setPrescribedDrive(m, shaft.id, rpmToRadPerSecond(parseRequired(raw)))); },
    }));
    out.push(actionRow("Remove drive", "The train will be unpowered", () => { store.edit(clearDrive); }));
    return out;
  }
  if (drive?.kind === "BALANCE" && drivenShaftId(movement) === shaft.id) {
    out.push(readonlyRow("Driven by", "the balance (escape wheel one tooth per balance period)",
      "Simplified dynamic model, L3 (ASM-0021, ASM-0024). See the escapement for the predicted rate."));
    return out;
  }
  if (drive?.kind === "NOMINAL_TIME" && shaft.hand === "MINUTES") {
    out.push(readonlyRow("Driven at", "nominal time (minutes hand 1 rev/h)"));
    return out;
  }
  out.push(readonlyRow("Driven by", drive === null ? "no drive set" : "the train"));
  out.push(actionRow("Make this the drive",
    "Prescribes this arbor's speed, keeping the current prescribed speed (if any).", () => {
      store.edit((m) => setPrescribedDrive(m, shaft.id,
        m.drive?.kind === "PRESCRIBED" ? m.drive.angularVelocity : rpmToRadPerSecond(Number.NaN)));
    }));
  return out;
}

export function shaftSection(
  store: AppStore,
  shaft: Shaft,
  storage: KeyValueStore | null,
  notify: (message: string, kind: "error" | "info") => void,
): Section {
  const { movement } = store;
  const edit = (patch: Parameters<typeof updateShaft>[2]): void => {
    store.edit((m) => updateShaft(m, shaft.id, patch));
  };
  const out: Section = [
    textRow("Name", shaft.name, (name) => { edit({ name }); }),
    selectRow("Hand", shaft.hand ?? "", [
      { value: "", label: "None" },
      { value: "HOURS", label: "Hours (1 rev / 12 h)" },
      { value: "MINUTES", label: "Minutes (1 rev / h)" },
      { value: "SECONDS", label: "Seconds (1 rev / min)" },
    ], (hand) => { edit({ hand: hand === "" ? null : (hand as HandFunction) }); },
    "The dial hand this arbor carries. Hand rates are checked against a 12-hour dial (ASM-0014)."),
    ...supportRows(store, shaft),
    ...placementRows(store, shaft),
  ];

  const omega = store.analysis.train.shaftAngularVelocity.get(shaft.id);
  out.push(readonlyRow("Angular velocity", omega === undefined ? "unpowered" : `${toRpm(omega).toFixed(4)} rev/min`));
  out.push(readonlyRow("Rotation",
    omega === undefined ? "—" : `${formatPeriod(omega)}${omega === 0 ? "" : omega > 0 ? ", clockwise from dial" : ", anticlockwise from dial"}`,
    "Running mode. Derived from the drive through the gearing (REF-ENG §5.3)."));

  out.push(...driveRows(store, shaft));

  out.push(sectionHeader("Gears"));
  for (const gear of Object.values(movement.gears).filter((g) => g.shaftId === shaft.id)) {
    out.push(listRow(gear.name, actionButton("Select", "Select this gear", () => { store.select(gear.id); })));
  }
  out.push(actionRow("Add gear", "Adds a gear to this arbor with every parameter empty.", () => {
    const step = store.tutorialActive && store.tutorialStep?.targetSelector === '[data-tutorial="add-gear"]' ? store.tutorialStep : null;
    if (step?.createOverride !== undefined) {
      store.runTutorialCreation(step.id, step.createOverride);
      return;
    }
    const gear = newGear(store.movement, shaft.id);
    store.edit((m) => addGear(m, gear));
    store.select(gear.id);
  }, false, "add-gear"));

  out.push(...clutchRows(store, shaft));
  out.push(...mainspringRows(store, shaft));

  if (shaft.support.kind === "PIVOTED") {
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
      out.push(sectionHeader("Bearing clearances (no validated acceptable range)"));
      out.push(readonlyRow("Side shake, lower", derivedText(sideShake(shaft, "LOWER", support.lower)),
        "Bore − pivot diameter, diametral (ASM-0013). Compared only to an informal, unconfirmed reference figure (BRG-007, ASM-0029)."));
      out.push(readonlyRow("Side shake, upper", derivedText(sideShake(shaft, "UPPER", support.upper)),
        "Bore − pivot diameter, diametral (ASM-0013). Compared only to an informal, unconfirmed reference figure (BRG-007, ASM-0029)."));
      out.push(readonlyRow("Space between bearings", derivedText(bearingInnerSpan(movement, support)),
        "Frame inner faces; bearing faces assumed flush (ASM-0011)."));
      out.push(readonlyRow("Endshake", derivedText(endshake(movement, shaft, support)),
        "Space between bearings − shoulder span (ASM-0011). Compared only to an informal, unconfirmed reference figure (BRG-006, ASM-0028)."));
      if (Object.keys(movement.tolerances).length > 0) {
        const worst = [
          ["Side shake, lower (tol.)", sideShakeStack(movement, shaft, "LOWER", support.lower)],
          ["Side shake, upper (tol.)", sideShakeStack(movement, shaft, "UPPER", support.upper)],
          ["Endshake (tol.)", endshakeStack(movement, shaft, support)],
        ] as const;
        for (const [label, result] of worst) out.push(readonlyRow(label, stackText(result), stackTitle(result)));
      }
    }
    out.push(...toleranceSection(store, shaft.id));
    out.push(
      ...presetRows(
        "Shaft",
        { pivotDiameterLower: shaft.pivotDiameter.LOWER, pivotDiameterUpper: shaft.pivotDiameter.UPPER, shoulderSpan: shaft.shoulderSpan },
        (values) => {
          edit({
            pivotDiameter: {
              LOWER: values.pivotDiameterLower ?? shaft.pivotDiameter.LOWER,
              UPPER: values.pivotDiameterUpper ?? shaft.pivotDiameter.UPPER,
            },
            shoulderSpan: values.shoulderSpan ?? shaft.shoulderSpan,
          });
        },
        storage,
        notify,
      ),
    );
  }

  out.push(deleteRow(store, shaft.id, "Delete arbor",
    "Also removes its gears, their meshes, its bearings and clutches. Arbors placed from it will report an unresolved constraint."));
  return out;
}
