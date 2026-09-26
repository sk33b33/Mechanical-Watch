import * as THREE from "three";
import type { Movement } from "@/domain/movement";
import { frameZRange, isCompleteFrame } from "@/assembly/assemblyGeometry";
import { createFrameGeometry, createZCylinder } from "@/geometry/assemblyGeometry3d";
import { createGearGeometry } from "@/geometry/gearGeometry";
import { isValidModule, isValidToothCount } from "@/math/gearMath";
import type { MovementAnalysis } from "@/analysis/analyzeMovement";

/**
 * ASCII STL of the visual assembly, in millimetres. It carries only what
 * the viewport draws for frames (flat slabs, ASM-0010), gears (visual
 * tooth proportions, ASM-0005) and the dial (a disc, ASM-0020), at their
 * assembled positions. Arbors, jewels, the stem, the crown and the stem
 * pinions are drawn at placeholder sizes (ASM-0012), so they are left out.
 * This is L0 visual geometry and must not be used for manufacture
 * (ASM-0004, MFG-002).
 */
export interface StlResult {
  text: string;
  solids: number;
  triangles: number;
  skipped: string[];
}

const METRES_TO_MM = 1000;

function writeSolid(lines: string[], name: string, geometry: THREE.BufferGeometry, offset: THREE.Vector3): number {
  const position = geometry.getAttribute("position");
  const index = geometry.getIndex();
  const count = index === null ? position.count : index.count;
  const vertex = (i: number): THREE.Vector3 => {
    const k = index === null ? i : index.getX(i);
    return new THREE.Vector3(position.getX(k), position.getY(k), position.getZ(k)).add(offset).multiplyScalar(METRES_TO_MM);
  };
  const safe = name.replace(/[^\w.-]+/g, "_");
  lines.push(`solid ${safe}`);
  let triangles = 0;
  for (let i = 0; i + 2 < count; i += 3) {
    const a = vertex(i), b = vertex(i + 1), c = vertex(i + 2);
    const normal = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    if (normal.lengthSq() === 0) continue; // degenerate
    normal.normalize();
    const f = (v: THREE.Vector3): string => `${v.x.toExponential(6)} ${v.y.toExponential(6)} ${v.z.toExponential(6)}`;
    lines.push(`  facet normal ${f(normal)}`, "    outer loop", `      vertex ${f(a)}`, `      vertex ${f(b)}`, `      vertex ${f(c)}`, "    endloop", "  endfacet");
    triangles += 1;
  }
  lines.push(`endsolid ${safe}`);
  return triangles;
}

export function buildStl(movement: Movement, analysis: MovementAnalysis): StlResult {
  const lines: string[] = [];
  const skipped: string[] = [];
  let solids = 0;
  let triangles = 0;

  for (const frame of Object.values(movement.frames)) {
    if (!isCompleteFrame(frame)) {
      skipped.push(`${frame.name}: incomplete dimensions`);
      continue;
    }
    const range = frameZRange(frame);
    const geometry = createFrameGeometry(frame.outline, range.hi - range.lo);
    triangles += writeSolid(lines, frame.name, geometry, new THREE.Vector3(0, 0, range.lo));
    geometry.dispose();
    solids += 1;
  }

  for (const gear of Object.values(movement.gears)) {
    const axis = analysis.placement.shaftPositions.get(gear.shaftId);
    if (axis === undefined || !Number.isFinite(gear.zCentre)) {
      skipped.push(`${gear.name}: arbor or height unresolved`);
      continue;
    }
    if (!isValidToothCount(gear.toothCount) || !isValidModule(gear.module) || !(gear.thickness > 0)) {
      skipped.push(`${gear.name}: invalid gear parameters`);
      continue;
    }
    let geometry: THREE.BufferGeometry;
    try {
      geometry = createGearGeometry(gear);
    } catch {
      skipped.push(`${gear.name}: invalid gear parameters`);
      continue;
    }
    triangles += writeSolid(lines, gear.name, geometry, new THREE.Vector3(axis.x, axis.y, gear.zCentre));
    geometry.dispose();
    solids += 1;
  }

  for (const dial of Object.values(movement.dials)) {
    const centre = analysis.placement.shaftPositions.get(dial.centreShaftId);
    const valid = dial.diameter > 0 && dial.thickness > 0 && Number.isFinite(dial.faceHeight);
    if (centre === undefined || !valid) {
      skipped.push(`${dial.name}: incomplete dimensions or no centre arbor`);
      continue;
    }
    const geometry = createZCylinder(dial.diameter / 2, dial.faceHeight, dial.faceHeight + dial.thickness, 96);
    triangles += writeSolid(lines, dial.name, geometry, new THREE.Vector3(centre.x, centre.y, 0));
    geometry.dispose();
    solids += 1;
  }

  return { text: lines.join("\n") + "\n", solids, triangles, skipped };
}
