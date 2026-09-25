import * as THREE from "three";
import type { Gear } from "@/domain/gear";
import { toMetres } from "@/units/length";
import { generateGearOutline } from "./gearOutline";

/**
 * Builds a Three.js geometry from a Gear's domain parameters. Presentation
 * only — the domain model in src/domain remains the authoritative source
 * of the mechanical state (see docs/MASTER_BUILD_PROMPT.md "Single source
 * of truth").
 */
export function createGearGeometry(gear: Gear): THREE.ExtrudeGeometry {
  const outline = generateGearOutline(gear);
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
  const boreRadius = Math.max(toMetres(gear.module) * 1.5, toMetres(gear.module));
  bore.absarc(0, 0, boreRadius, 0, Math.PI * 2, false);
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
