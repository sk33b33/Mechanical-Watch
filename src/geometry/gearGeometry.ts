import * as THREE from "three";
import type { Gear } from "@/domain/gear";
import type { Movement } from "@/domain/movement";
import { toMetres } from "@/units/length";
import { CYCLOID_TOOTH_PROPORTIONS } from "@/math/cycloidTooth";
import { GEAR_SPOKE_MIN_TOOTH_COUNT } from "@/domain/gear";
import { generateGearOutline, gearSpokeOpenings, visualBoreRadius } from "./gearOutline";
import { generateInvoluteGearOutline } from "./involuteGearOutline";
import { effectiveLeafCount, generateWatchSpecificGearOutline } from "./watchSpecificGearOutline";

/**
 * Builds a Three.js geometry from a Gear's domain parameters. Presentation
 * only; the domain model remains the authoritative mechanical state. A
 * PITCH_MODEL gear draws the generic visual placeholder (L0, ASM-0005).
 * An INVOLUTE_PROFILE gear with a pressure angle draws the real involute
 * tooth form (L1, ASM-0030); without one it falls back to the placeholder
 * rather than fail to render (GEAR-103 reports the missing input). A
 * WATCH_SPECIFIC_PROFILE gear with enough teeth draws the cycloidal
 * tooth form (ASM-0032, ASM-0033, mesh-pair-aware when `movement` is
 * supplied — see `effectiveLeafCount`); below SRC-0026's table range it
 * falls back to the placeholder (GEAR-104 reports it).
 */
export function createGearGeometry(gear: Gear, movement?: Movement): THREE.ExtrudeGeometry {
  const outline = gear.profileModel === "INVOLUTE_PROFILE" && gear.pressureAngle !== null
    ? generateInvoluteGearOutline(gear)
    : gear.profileModel === "WATCH_SPECIFIC_PROFILE" && effectiveLeafCount(gear, movement) >= CYCLOID_TOOTH_PROPORTIONS.minimumToothCount
      ? generateWatchSpecificGearOutline(gear, movement)
      : generateGearOutline(gear);
  const shape = new THREE.Shape();
  const first = outline[0];
  if (first === undefined) {
    throw new Error(`Gear ${gear.id} produced an empty outline`);
  }
  shape.moveTo(first.x, first.y);
  for (let i = 1; i < outline.length; i += 1) {
    const point = outline[i];
    if (point === undefined) {
      continue;
    }
    shape.lineTo(point.x, point.y);
  }
  shape.closePath();

  const bore = new THREE.Path();
  bore.absarc(0, 0, visualBoreRadius(gear), 0, Math.PI * 2, false);
  shape.holes.push(bore);

  // An open five-spoke wheel (ASM-0077): gaps between hub and rim, if the gear is flagged and big
  // enough. A flagged gear below the floor stays solid — GEAR-105 says so instead of this hiding it.
  if (gear.spoked && Number.isInteger(gear.toothCount) && gear.toothCount >= GEAR_SPOKE_MIN_TOOTH_COUNT) {
    for (const opening of gearSpokeOpenings(gear)) {
      const hole = new THREE.Path();
      opening.forEach(({ x, y }, i) => { if (i === 0) hole.moveTo(x, y); else hole.lineTo(x, y); });
      hole.closePath();
      shape.holes.push(hole);
    }
  }

  const thickness = toMetres(gear.thickness);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 4,
  });
  geometry.translate(0, 0, -thickness / 2);
  return geometry;
}
