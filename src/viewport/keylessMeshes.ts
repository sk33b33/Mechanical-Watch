import * as THREE from "three";
import type { Movement } from "@/domain/movement";
import type { KeylessWorks, StemPinion, StemPosition } from "@/domain/keyless";
import type { Dial } from "@/domain/dial";
import type { DialWindow } from "@/domain/dialWindow";
import type { ShaftId } from "@/domain/shaft";
import { createGear } from "@/domain/gear";
import { metres } from "@/units/length";
import type { PlacementSolution } from "@/kinematics/solvePlacement";
import { isDefinedPinion, mainplateEdgeAlongStem, stemEngagement, stemLine } from "@/kinematics/keylessGeometry";
import { createGearGeometry } from "@/geometry/gearGeometry";
import {
  DIAL_VISUALIZATION,
  DIAL_WINDOW_POINTER_VISUALIZATION,
  DIAL_WINDOW_PRINT_VISUALIZATION,
  KEYLESS_VISUALIZATION,
  MOON_PHASE_MARK_VISUALIZATION,
  createDiscWithHolesGeometry,
  createDialWindowBezelGeometry,
  createDialWindowCaptionTexture,
  createDialWindowPointerGeometry,
  dialBrandPlacement,
  dialHourNumeralPlacements,
  dialMarkerPlacements,
  dialWindowCaptionOffset,
  dialWindowPointerSize,
  createFlutedCylinderGeometry,
  secondsNumeralPlacements,
  createMoonPhaseMarkGeometry,
  moonPhaseMarks,
  createZCylinder,
  type DiscHole,
} from "@/geometry/assemblyGeometry3d";

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

  // The crown is knurled (follow-up 21, ASM-0076): its ridges already show that it turns. A silver bar
  // that used to lie along it as a rotation marker added nothing and was removed (follow-up 43).
  const crown = new THREE.Mesh(createFlutedCylinderGeometry(v.crownRadiusMetres, v.crownLengthMetres, v.crownRidgeCount, v.crownRidgeDepthFraction), materials.crown);
  crown.position.x = crownStart + v.crownLengthMetres / 2;
  stemSpin.add(crown);
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

/**
 * The dial disc with twelve hour markers on its face (the −Z side), and a
 * hole punched for each of the dial's own windows (ASM-0051) — through
 * which a disc complication becomes visible, where without one it would
 * be fully occluded by this otherwise-opaque disc.
 */
export function buildDialMeshes(
  dial: Dial,
  placement: PlacementSolution,
  displayZ: (z: number) => number,
  /**
   * `marker` is the twelve hour circles; `print` the triangles, moon-phase marks and window frames printed on the dial;
   * `printText` the colour of the dial's printed text and numerals (the captions, the seconds numerals, the brand line)
   * and `markerDigits` that of the numerals inside the four big hour circles. A text colour left out is the built-in
   * one (follow-up 39, ASM-0090).
   */
  materials: { disc: THREE.Material; marker: THREE.Material; print: THREE.Material; printText?: string; markerDigits?: string },
  windows: readonly DialWindow[] = [],
  /** Moon-image count (1 or 2) of each window's own moon-phase disc, for windows with `phaseMarks` (ASM-0072). */
  moonImageCounts: ReadonlyMap<string, number> = new Map(),
  /** The seconds hand's own pivot (world metres) and the radius of its numeral ring, or null for none (follow-up 19). */
  secondsScale: { pivot: { x: number; y: number }; ringRadius: number } | null = null,
): { root: THREE.Group; disc: THREE.Mesh } | null {
  const centre = placement.shaftPositions.get(dial.centreShaftId);
  const valid = Number.isFinite(dial.diameter) && dial.diameter > 0 && Number.isFinite(dial.thickness) && dial.thickness > 0 && Number.isFinite(dial.faceHeight);
  if (centre === undefined || !valid) return null;
  const root = new THREE.Group();
  root.position.set(centre.x, centre.y, 0);
  const face = displayZ(dial.faceHeight);
  const ownWindows = windows.filter((w) => w.dialId === dial.id);
  let disc: THREE.Mesh;
  if (ownWindows.length === 0) {
    disc = new THREE.Mesh(createZCylinder(dial.diameter / 2, face, face + dial.thickness, 96), materials.disc);
  } else {
    const holes: DiscHole[] = ownWindows.map((w) => {
      const x = w.centre.x - centre.x;
      const y = w.centre.y - centre.y;
      return w.outline.kind === "CIRCLE"
        ? { kind: "CIRCLE", x, y, radius: w.outline.radius }
        : { kind: "RECTANGLE", x, y, width: w.outline.width, height: w.outline.height };
    });
    disc = new THREE.Mesh(createDiscWithHolesGeometry(dial.diameter / 2, dial.thickness, holes), materials.disc);
    disc.position.z = face;
  }
  root.add(disc);
  const d = DIAL_VISUALIZATION;
  const r = dial.diameter / 2;
  // Hour markers (ASM-0020, ASM-0093): equal circles, and at 12 an upside-down triangle that fills the old big
  // circle's footprint.
  for (const marker of dialMarkerPlacements(r)) {
    if (marker.shape === "TRIANGLE_DOWN") {
      // An equilateral triangle inscribed in the circle of the marker's radius, apex down towards the dial's centre.
      const triangle = new THREE.Mesh(createDialWindowPointerGeometry(Math.sqrt(3) * marker.radiusMetres, 1.5 * marker.radiusMetres, d.markerThicknessMetres), materials.marker);
      triangle.position.set(marker.x, marker.y - marker.radiusMetres, face - d.markerThicknessMetres);
      root.add(triangle);
      continue;
    }
    const dot = new THREE.Mesh(
      new THREE.CylinderGeometry(marker.radiusMetres, marker.radiusMetres, d.markerThicknessMetres, 48).rotateX(Math.PI / 2),
      materials.marker,
    );
    dot.position.set(marker.x, marker.y, face - d.markerThicknessMetres / 2);
    root.add(dot);
  }
  // The twelve hour numerals, printed inside their markers (follow-up 46), in the numerals' own colour.
  for (const numeral of dialHourNumeralPlacements(r)) {
    const builtHour = createDialWindowCaptionTexture(numeral.text, materials.markerDigits ?? d.hourNumeralColor);
    if (builtHour === null) continue;
    const hourPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(numeral.height * builtHour.aspect, numeral.height),
      new THREE.MeshBasicMaterial({ map: builtHour.texture, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
    );
    // Read from the dial's −Z side: half a turn about Y so the text reads left to right.
    hourPlane.rotation.y = Math.PI;
    hourPlane.position.set(numeral.x, numeral.y, face - 1.3 * d.markerThicknessMetres);
    root.add(hourPlane);
  }
  // The small black brand line under the big 6 circle, just inside the dial's edge (follow-up 30, ASM-0083).
  const brand = dialBrandPlacement(r);
  const builtBrand = createDialWindowCaptionTexture(brand.text, materials.printText ?? d.brand.color);
  if (builtBrand !== null) {
    const brandPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(brand.height * builtBrand.aspect, brand.height),
      new THREE.MeshBasicMaterial({ map: builtBrand.texture, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
    );
    // Read from the dial's −Z side: half a turn about Y so the text reads left to right.
    brandPlane.rotation.y = Math.PI;
    brandPlane.position.set(brand.x, brand.y, face - 1.3 * d.markerThicknessMetres);
    root.add(brandPlane);
  }
  // Seconds-scale numerals around the seconds hand's own pivot (follow-up 19): 60 north, 15 east,
  // 30 south, 45 west, just inside the hand's tip, printed on the dial like the window captions.
  if (secondsScale !== null) {
    const numeralHeight = r * d.numeralHeightFraction;
    for (const numeral of secondsNumeralPlacements(secondsScale.pivot, secondsScale.ringRadius)) {
      const built = createDialWindowCaptionTexture(numeral.text, materials.printText ?? d.numeralColor);
      if (built === null) continue;
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(numeralHeight * built.aspect, numeralHeight),
        new THREE.MeshBasicMaterial({ map: built.texture, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
      );
      // Read from the dial's −Z side, where world +X runs leftward on screen: half a turn about Y so
      // the text reads left to right (same treatment as the window captions).
      plane.rotation.y = Math.PI;
      plane.position.set(numeral.x - centre.x, numeral.y - centre.y, face - 1.3 * d.markerThicknessMetres);
      root.add(plane);
    }
  }
  const pv = DIAL_WINDOW_POINTER_VISUALIZATION;
  const { baseWidth: pointerBaseWidth, height: pointerHeight } = dialWindowPointerSize(r);
  const pointerGap = r * pv.gapFraction;
  for (const w of ownWindows) {
    if (w.pointer !== "NORTH") continue;
    // The window's own extent toward the dial's north (+Y) at its own edge: a CIRCLE's radius,
    // or a RECTANGLE's half-height — the point the pointer's own apex sits just beyond (ASM-0069).
    const halfExtentAtNorth = w.outline.kind === "CIRCLE" ? w.outline.radius : w.outline.height / 2;
    const pointer = new THREE.Mesh(createDialWindowPointerGeometry(pointerBaseWidth, pointerHeight, d.markerThicknessMetres), materials.print);
    // With a printed bezel the apex clears the frame, not just the window's own edge.
    const bezelClearance = w.bezel ? r * DIAL_WINDOW_PRINT_VISUALIZATION.bezelWidthFraction : 0;
    pointer.position.set(w.centre.x - centre.x, w.centre.y - centre.y + halfExtentAtNorth + bezelClearance + pointerGap, face - d.markerThicknessMetres / 2);
    root.add(pointer);
  }
  // Lunar-phase marks (ASM-0072): a ring of small icons around a circular moon-phase window, at
  // the angles a moon image sits at each phase, level with the pointer. A north pointer already
  // stands for the full moon at north, so no icon is drawn on top of it.
  const mv = MOON_PHASE_MARK_VISUALIZATION;
  const iconRadius = r * mv.iconRadiusFraction;
  for (const w of ownWindows) {
    const imageCount = moonImageCounts.get(w.id);
    if (!w.phaseMarks || w.outline.kind !== "CIRCLE" || imageCount === undefined) continue;
    const ringRadius = w.outline.radius + r * mv.gapFraction + iconRadius;
    for (const mark of moonPhaseMarks(imageCount)) {
      const atNorth = Math.abs(Math.cos(mark.worldAngle)) < 1e-9 && Math.sin(mark.worldAngle) > 0;
      if (atNorth && w.pointer === "NORTH") continue;
      const litSide: 1 | -1 = mark.kind === "FIRST_QUARTER" ? mv.firstQuarterLitSide : mv.firstQuarterLitSide === 1 ? -1 : 1;
      const icon = new THREE.Mesh(createMoonPhaseMarkGeometry(mark.kind, iconRadius, d.markerThicknessMetres, litSide), materials.print);
      icon.position.set(
        w.centre.x - centre.x + ringRadius * Math.cos(mark.worldAngle),
        w.centre.y - centre.y + ringRadius * Math.sin(mark.worldAngle),
        face - d.markerThicknessMetres / 2,
      );
      root.add(icon);
    }
  }
  // Printed furniture (ASM-0074): a thin dark bezel frame around a window's edge, and a caption
  // just below it. Both sit on the dial face like the pointer and the hour markers.
  const printV = DIAL_WINDOW_PRINT_VISUALIZATION;
  const bezelWidth = r * printV.bezelWidthFraction;
  const captionHeight = r * printV.captionHeightFraction;
  for (const w of ownWindows) {
    const wx = w.centre.x - centre.x;
    const wy = w.centre.y - centre.y;
    if (w.bezel) {
      const bezel = new THREE.Mesh(createDialWindowBezelGeometry(w.outline, bezelWidth, d.markerThicknessMetres), materials.print);
      bezel.position.set(wx, wy, face - d.markerThicknessMetres / 2);
      root.add(bezel);
    }
    if (w.caption !== null && w.caption !== "") {
      const built = createDialWindowCaptionTexture(w.caption, materials.printText);
      if (built === null) continue;
      const southExtent = w.outline.kind === "CIRCLE" ? w.outline.radius : w.outline.height / 2;
      const offset = dialWindowCaptionOffset(southExtent, w.bezel ? bezelWidth : 0, r * printV.captionGapFraction, captionHeight);
      const caption = new THREE.Mesh(
        new THREE.PlaneGeometry(captionHeight * built.aspect, captionHeight),
        new THREE.MeshBasicMaterial({ map: built.texture, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
      );
      // The dial is read from its −Z side, where world +X runs leftward on screen: turn the plane
      // half a revolution about Y so its front face (and the text reading along local +X) faces −Z.
      caption.rotation.y = Math.PI;
      caption.position.set(wx + offset.x, wy + offset.y, face - 1.2 * d.markerThicknessMetres);
      root.add(caption);
    }
  }
  return { root, disc };
}
