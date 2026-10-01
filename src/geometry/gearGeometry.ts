import * as THREE from "three";
import type { Gear } from "@/domain/gear";
import { toMetres } from "@/units/length";
import { generateGearOutline, visualBoreRadius } from "./gearOutline";
import { generateInvoluteGearOutline } from "./involuteGearOutline";

/**
 * Builds a Three.js geometry from a Gear's domain parameters. Presentation
 * only; the domain model remains the authoritative mechanical state. A
 * PITCH_MODEL gear draws the generic visual placeholder (L0, ASM-0005).
 * An INVOLUTE_PROFILE gear with a pressure angle draws the real involute
 * tooth form (L1, ASM-0030); without one it falls back to the placeholder
 * rather than fail to render (GEAR-103 reports the missing input).
 */
export function createGearGeometry(gear: Gear): THREE.ExtrudeGeometry {
  const outline = gear.profileModel === "INVOLUTE_PROFILE" && gear.pressureAngle !== null
    ? generateInvoluteGearOutline(gear)
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

  const thickness = toMetres(gear.thickness);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 4,
  });
  geometry.translate(0, 0, -thickness / 2);
  return geometry;
}
