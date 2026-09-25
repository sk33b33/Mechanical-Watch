import * as THREE from "three";
import type { Gear } from "@/domain/gear";
import { gearPitchDiameter } from "@/domain/gear";
import { toMetres } from "@/units/length";
import { generateGearOutline, GEAR_VISUALIZATION_PROPORTIONS } from "./gearOutline";

/**
 * Builds a Three.js geometry from a Gear's domain parameters. Presentation
 * only (validation level L0 for the tooth shape, ASM-0005); the domain
 * model remains the authoritative mechanical state.
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

  const p = GEAR_VISUALIZATION_PROPORTIONS;
  const bore = new THREE.Path();
  const boreRadius = Math.min(
    toMetres(gear.module) * p.boreRadiusInModules,
    (toMetres(gearPitchDiameter(gear)) / 2) * p.maxBoreRadiusFractionOfPitch,
  );
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
