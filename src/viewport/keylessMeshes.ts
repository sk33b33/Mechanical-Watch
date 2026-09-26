import * as THREE from "three";
import type { Movement } from "@/domain/movement";
import type { KeylessWorks, StemPinion, StemPosition } from "@/domain/keyless";
import type { Dial } from "@/domain/dial";
import type { ShaftId } from "@/domain/shaft";
import { createGear } from "@/domain/gear";
import { metres } from "@/units/length";
import { isCompleteFrame } from "@/assembly/assemblyGeometry";
import type { PlacementSolution } from "@/kinematics/solvePlacement";
import { isDefinedPinion, stemEngagement, stemLine, type StemLine } from "@/kinematics/keylessGeometry";
import { createGearGeometry } from "@/geometry/gearGeometry";
import { DIAL_VISUALIZATION, KEYLESS_VISUALIZATION, createZCylinder } from "@/geometry/assemblyGeometry3d";

/**
 * Presentation of the keyless works and the dial. Positions, heights and
 * pitch diameters come from the model; stem, crown and pinion thickness
 * are placeholders (ASM-0012), and tooth shapes are visual (ASM-0005).
 */

export interface StemMeshes {
  /** Positioned at the stem line's origin and height, local +X along the stem toward the crown. */
  root: THREE.Group;
  /** Turns with the stem (rod, crown, sliding pinion). */
  stemSpin: THREE.Group;
  /** Turns with the winding pinion. */
  windingSpin: THREE.Group;
  pickMeshes: THREE.Mesh[];
}

/** A pinion drawn in the plane perpendicular to the stem, centred on local x. */
function pinionMesh(pinion: StemPinion, x: number, material: THREE.Material): THREE.Mesh | null {
  if (!isDefinedPinion(pinion)) return null;
  const gear = createGear({
    name: "stem pinion",
    toothCount: pinion.toothCount,
    module: pinion.module,
    thickness: metres(KEYLESS_VISUALIZATION.pinionThicknessMetres),
    shaftId: "" as ShaftId,
  });
  const geometry = createGearGeometry(gear);
  geometry.rotateY(Math.PI / 2); // gear axis Z → stem axis X
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.x = x;
  return mesh;
}

/** Along-stem distance from the line origin to the outside of the mainplate, for placing the crown. */
function mainplateEdgeAlongStem(movement: Movement, line: StemLine): number | null {
  let best: number | null = null;
  for (const frame of Object.values(movement.frames)) {
    if (frame.kind !== "MAINPLATE" || !isCompleteFrame(frame)) continue;
    const o = frame.outline;
    let t: number;
    if (o.kind === "CIRCLE") {
      // Ray origin + t u meets |p − c| = r.
      const dx = line.origin.x - o.centre.x;
      const dy = line.origin.y - o.centre.y;
      const b = dx * line.u.x + dy * line.u.y;
      const c = dx * dx + dy * dy - o.radius * o.radius;
      const disc = b * b - c;
      if (disc < 0) continue;
      t = -b + Math.sqrt(disc);
    } else {
      t = Math.max(...o.points.map((p) => (p.x - line.origin.x) * line.u.x + (p.y - line.origin.y) * line.u.y));
    }
    best = best === null ? t : Math.max(best, t);
  }
  return best;
}

export function buildStemMeshes(
  movement: Movement,
  placement: PlacementSolution,
  keyless: KeylessWorks,
  stemPosition: StemPosition,
  displayZ: (z: number) => number,
  materials: { stem: THREE.Material; crown: THREE.Material; pinion: THREE.Material },
): StemMeshes | null {
  const line = stemLine(movement, keyless, placement);
  if (line === null || !Number.isFinite(keyless.stemHeight)) return null;
  const v = KEYLESS_VISUALIZATION;
  const root = new THREE.Group();
  root.position.set(line.origin.x, line.origin.y, displayZ(keyless.stemHeight));
  root.rotation.z = Math.atan2(line.u.y, line.u.x);
  const stemSpin = new THREE.Group();
  const windingSpin = new THREE.Group();
  root.add(stemSpin, windingSpin);
  const pickMeshes: THREE.Mesh[] = [];

  const crownWheel = movement.gears[keyless.crownWheelGearId];
  const settingWheel = movement.gears[keyless.settingWheelGearId];
  const winding = crownWheel === undefined ? null : stemEngagement(line, keyless.stemHeight, keyless.windingPinion, crownWheel, placement);
  const setting = settingWheel === undefined ? null : stemEngagement(line, keyless.stemHeight, keyless.slidingPinion, settingWheel, placement);

  const positions = [winding?.pinionAlongStem, setting?.pinionAlongStem].filter((x): x is number => x !== undefined);
  const inner = (positions.length > 0 ? Math.min(...positions) : 0) - v.stemInnerOverhangMetres;
  const edge = mainplateEdgeAlongStem(movement, line) ?? (positions.length > 0 ? Math.max(...positions) : 0) + 3e-3;
  const pulled = stemPosition === "SETTING" ? v.pulledOutMetres : 0;
  const crownStart = edge + v.crownGapMetres + pulled;

  // Stem rod along local X.
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(v.stemRadiusMetres, v.stemRadiusMetres, crownStart - inner, 16), materials.stem);
  rod.geometry.rotateZ(Math.PI / 2);
  rod.position.x = (inner + crownStart) / 2;
  stemSpin.add(rod);
  pickMeshes.push(rod);

  // Crown, with a flat so its rotation is visible.
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(v.crownRadiusMetres, v.crownRadiusMetres, v.crownLengthMetres, 24), materials.crown);
  crown.geometry.rotateZ(Math.PI / 2);
  crown.position.x = crownStart + v.crownLengthMetres / 2;
  const flat = new THREE.Mesh(new THREE.BoxGeometry(v.crownLengthMetres * 1.02, v.crownRadiusMetres * 0.25, v.crownRadiusMetres * 0.25), materials.pinion);
  flat.position.set(crown.position.x, v.crownRadiusMetres, 0);
  stemSpin.add(crown, flat);
  pickMeshes.push(crown);

  if (setting !== null) {
    // Pushed inward onto the setting wheel when pulled out; drawn slightly outward otherwise (visual travel).
    const x = setting.pinionAlongStem + (stemPosition === "SETTING" ? 0 : v.slidingPinionTravelMetres);
    const mesh = pinionMesh(keyless.slidingPinion, x, materials.pinion);
    if (mesh !== null) {
      stemSpin.add(mesh);
      pickMeshes.push(mesh);
    }
  }
  if (winding !== null) {
    const mesh = pinionMesh(keyless.windingPinion, winding.pinionAlongStem, materials.pinion);
    if (mesh !== null) {
      windingSpin.add(mesh);
      pickMeshes.push(mesh);
    }
  }
  return { root, stemSpin, windingSpin, pickMeshes };
}

/** The dial disc with twelve hour markers on its face (the −Z side). */
export function buildDialMeshes(
  dial: Dial,
  placement: PlacementSolution,
  displayZ: (z: number) => number,
  materials: { disc: THREE.Material; marker: THREE.Material },
): { root: THREE.Group; disc: THREE.Mesh } | null {
  const centre = placement.shaftPositions.get(dial.centreShaftId);
  const valid = Number.isFinite(dial.diameter) && dial.diameter > 0 && Number.isFinite(dial.thickness) && dial.thickness > 0 && Number.isFinite(dial.faceHeight);
  if (centre === undefined || !valid) return null;
  const root = new THREE.Group();
  root.position.set(centre.x, centre.y, 0);
  const face = displayZ(dial.faceHeight);
  const disc = new THREE.Mesh(createZCylinder(dial.diameter / 2, face, face + dial.thickness, 96), materials.disc);
  root.add(disc);
  const d = DIAL_VISUALIZATION;
  const r = dial.diameter / 2;
  const length = r * d.markerLengthFraction;
  for (let hour = 0; hour < 12; hour += 1) {
    // Hands point +Y at 12 and turn counter-clockwise seen from +Z (clockwise from the dial, ASM-0014).
    const angle = (hour * Math.PI) / 6;
    const marker = new THREE.Mesh(
      new THREE.BoxGeometry(d.markerWidthMetres * (hour % 3 === 0 ? 2 : 1), length, d.markerThicknessMetres),
      materials.marker,
    );
    const radius = r - length * 0.9;
    marker.position.set(-radius * Math.sin(angle), radius * Math.cos(angle), face - d.markerThicknessMetres / 2);
    marker.rotation.z = angle;
    root.add(marker);
  }
  return { root, disc };
}
