import type { AppStore } from "@/app/store";
import { millimetres, toMillimetres } from "@/units/length";
import { degrees, toDegrees } from "@/units/angle";
import { toRpm } from "@/units/angularVelocity";
import { toMillimetresPerSecond } from "@/units/linearVelocity";
import { gearPitchDiameter, type Gear } from "@/domain/gear";
import type { Shaft, ShaftEnd } from "@/domain/shaft";
import type { Jewel } from "@/domain/jewel";
import type { Frame } from "@/domain/frame";
import { updateFrame, updateGear, updateJewel, updateShaft } from "@/domain/movement";
import { isValidModule, isValidToothCount, pitchLineVelocity } from "@/math/gearMath";
import {
  bearingInnerSpan,
  endshake,
  frameZRange,
  shaftSupport,
  sideShake,
} from "@/assembly/assemblyGeometry";
import {
  derivedText,
  formatMm,
  inputRow,
  isPositiveOrUnknown,
  mmText,
  optionalMmText,
  parseOptionalMm,
  parseRequired,
  readonlyRow,
  sectionHeader,
} from "./fields";

type Section = HTMLElement[];

function positive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

export function gearSection(store: AppStore, gear: Gear): Section {
  const edit = (patch: Parameters<typeof updateGear>[2]): void => {
    store.edit((m) => updateGear(m, gear.id, patch));
  };
  const shaft = store.movement.shafts[gear.shaftId];
  const out: Section = [
    sectionHeader("Parameters"),
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
      title: "Height of the gear's mid-plane above the mainplate underside.",
      onCommit: (raw) => { edit({ zCentre: millimetres(parseRequired(raw)) }); },
    }),
    readonlyRow("Tooth profile", gear.profileModel,
      "Pitch-circle model (REF-ENG §6). The drawn teeth are a visual approximation (ASM-0005)."),
    readonlyRow("Pressure angle",
      gear.pressureAngle === null ? "not modeled" : `${toDegrees(gear.pressureAngle).toFixed(1)}°`,
      "A pitch model has no tooth flank, so no pressure angle is assumed."),
    readonlyRow("Arbor", shaft?.name ?? "missing"),
    sectionHeader("Calculated (model predicts)"),
  ];

  const valid = isValidToothCount(gear.toothCount) && isValidModule(gear.module);
  const pitch = valid ? gearPitchDiameter(gear) : null;
  out.push(readonlyRow("Pitch diameter", pitch === null ? "invalid parameters" : formatMm(pitch), "d = m z (REF-ENG §5.1)"));
  const omega = store.analysis.train.shaftAngularVelocity.get(gear.shaftId);
  out.push(readonlyRow("Angular velocity", omega === undefined ? "unpowered" : `${toRpm(omega).toFixed(3)} rev/min`,
    "Propagated stage by stage, ω2/ω1 = −z1/z2 (REF-ENG §5.3). Sign gives direction."));
  out.push(readonlyRow("Pitch-line velocity",
    omega === undefined || pitch === null ? "—" : `${toMillimetresPerSecond(pitchLineVelocity(omega, pitch)).toFixed(4)} mm/s`,
    "v = ω r (REF-ENG §5.5)"));
  return out;
}

export function shaftSection(store: AppStore, shaft: Shaft): Section {
  const { movement } = store;
  const edit = (patch: Parameters<typeof updateShaft>[2]): void => {
    store.edit((m) => updateShaft(m, shaft.id, patch));
  };
  const out: Section = [sectionHeader("Placement")];
  const placement = shaft.placement;

  if (placement.kind === "FIXED") {
    out.push(readonlyRow("Constraint", "Fixed coordinates"));
    for (const axis of ["x", "y"] as const) {
      out.push(inputRow({
        label: `${axis.toUpperCase()} (mm)`, value: mmText(placement.position[axis]), step: "0.1",
        invalid: !Number.isFinite(placement.position[axis]),
        onCommit: (raw) => {
          edit({ placement: { kind: "FIXED", position: { ...placement.position, [axis]: millimetres(parseRequired(raw)) } } });
        },
      }));
    }
  } else {
    const reference = movement.shafts[placement.referenceShaftId];
    const mesh = movement.gearMeshes[placement.meshId];
    const meshName = mesh === undefined
      ? "missing mesh"
      : `${movement.gears[mesh.drivingGearId]?.name ?? "?"} → ${movement.gears[mesh.drivenGearId]?.name ?? "?"}`;
    out.push(readonlyRow("Constraint", "At mesh centre distance",
      "Placed at the ideal centre distance of the mesh (REF-ENG §5.2). Changing tooth counts or module moves this shaft."));
    out.push(readonlyRow("From", reference?.name ?? "missing shaft"));
    out.push(readonlyRow("Mesh", meshName));
    out.push(inputRow({
      label: "Direction (°)", value: Number.isFinite(placement.angle) ? String(toDegrees(placement.angle)) : "", step: "1",
      invalid: !Number.isFinite(placement.angle),
      title: "Angle from +X, counter-clockwise, seen from the bridge side.",
      onCommit: (raw) => { edit({ placement: { ...placement, angle: degrees(parseRequired(raw)) } }); },
    }));
  }

  const axis = store.analysis.placement.shaftPositions.get(shaft.id);
  out.push(readonlyRow("Solved position",
    axis === undefined ? "unresolved" : `${toMillimetres(axis.x).toFixed(4)}, ${toMillimetres(axis.y).toFixed(4)} mm`));

  const omega = store.analysis.train.shaftAngularVelocity.get(shaft.id);
  out.push(readonlyRow("Angular velocity", omega === undefined ? "unpowered" : `${toRpm(omega).toFixed(3)} rev/min`));

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
  return out;
}

export function jewelSection(store: AppStore, jewel: Jewel): Section {
  const { movement } = store;
  const shaft = movement.shafts[jewel.shaftId];
  const frame = movement.frames[jewel.frameId];
  return [
    sectionHeader("Bearing"),
    readonlyRow("Type", jewel.kind === "HOLE_JEWEL" ? "Hole jewel" : "Plain hole"),
    readonlyRow("Supports", `${shaft?.name ?? "missing shaft"}, ${jewel.end.toLowerCase()} end`),
    readonlyRow("In frame", frame?.name ?? "missing frame"),
    readonlyRow("Position", "on the shaft's solved axis",
      "Bearings have no position of their own, so a shaft's two bearings are always coaxial."),
    inputRow({
      label: "Bore Ø (mm)", value: optionalMmText(jewel.boreDiameter), step: "0.005",
      placeholder: "unknown", invalid: !isPositiveOrUnknown(jewel.boreDiameter),
      onCommit: (raw) => { store.edit((m) => updateJewel(m, jewel.id, { boreDiameter: parseOptionalMm(raw) })); },
    }),
    readonlyRow("Side shake",
      shaft === undefined ? "—" : derivedText(sideShake(shaft, jewel.end, jewel)),
      "Bore − pivot diameter, diametral (ASM-0013). Not judged (BRG-005)."),
    readonlyRow("Outer size", "not modeled (drawn at a placeholder size, ASM-0012)"),
  ];
}

export function frameSection(store: AppStore, frame: Frame): Section {
  const edit = (patch: Parameters<typeof updateFrame>[2]): void => {
    store.edit((m) => updateFrame(m, frame.id, patch));
  };
  const range = frameZRange(frame);
  const outline = frame.outline.kind === "CIRCLE"
    ? `circle, Ø ${formatMm(frame.outline.radius * 2, 2)}`
    : `polygon, ${String(frame.outline.points.length)} points`;
  const bearings = Object.values(store.movement.jewels).filter((j) => j.frameId === frame.id).length;
  return [
    sectionHeader("Frame"),
    readonlyRow("Kind", frame.kind === "MAINPLATE" ? "Mainplate" : "Bridge"),
    readonlyRow("Outline", outline, "Outline editing is not available yet."),
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
  ];
}

