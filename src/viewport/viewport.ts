import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { AppStore } from "@/app/store";
import type { EntityId } from "@/domain/ids";
import type { ShaftId } from "@/domain/shaft";
import { createGearGeometry } from "@/geometry/gearGeometry";
import { generateGearOutline, visualBoreRadius, type Point2D } from "@/geometry/gearOutline";
import { barFootprint, lineCircleInterval, linePolygonIntervals, subtractIntervals, type Interval } from "@/geometry/sectionCap";
import {
  ASSEMBLY_VISUALIZATION,
  HAND_VISUALIZATION,
  balanceArmHalfExtents,
  balanceRimInnerRadius,
  createDiscLabelTexture,
  createFrameGeometry,
  createGenevaWheelGeometry,
  createHandGeometry,
  createRodGeometry,
  createZCylinder,
  DATE_LINKAGE_VISUALIZATION,
  escapeWheelHubRadius,
  generateEscapeWheelOutline,
  generateHandOutline,
  GENEVA_WHEEL_VISUALIZATION,
  handHubRadius,
  type EscapeToothFace,
} from "@/geometry/assemblyGeometry3d";
import { arborZRange, frameZRange, isCompleteFrame } from "@/assembly/assemblyGeometry";
import { partReferencePoint, type Point3 } from "@/assembly/measure";
import { stemBodyId, type KeylessWorksId } from "@/domain/keyless";
import { findDiscComplication } from "@/domain/discComplication";
import type { DateComplicationId } from "@/domain/dateComplication";
import type { LeapYearComplicationId } from "@/domain/leapYearComplication";
import { LEAP_YEAR_INDEX_STROKE_SECONDS, LEAP_YEAR_SLOT_COUNT } from "@/domain/leapYearComplication";
import { genevaLambda, genevaStrokeDriverAngle, genevaDriverMotionAngle } from "@/kinematics/genevaDrive";
import { buildDialMeshes, buildStemMeshes } from "./keylessMeshes";
import { escapementDisplay, primaryEscapement } from "@/simulation/escapementDisplay";
import {
  createBalanceGeometry,
  createEscapeWheelGeometry,
  createForkGeometry,
  ESCAPEMENT_VISUALIZATION,
  generatePalletStoneOutline,
  symbolicPalletArms,
  type PalletArm,
} from "@/geometry/assemblyGeometry3d";
import { forkActingLength, forkRatio, isHalfToothSpan, lockingPoints, spanAngle, toothDrawAngle, toothWidthAngle } from "@/kinematics/palletGeometry";
import { isValidToothCount } from "@/math/gearMath";
import { metres } from "@/units/length";

type PickKind = "gear" | "jewel" | "escapement" | "keyless" | "arbor" | "frame" | "dial" | "moonPhase" | "dateStar" | "monthStar" | "leapYearWheel";
type ViewSide = "BRIDGE" | "DIAL";

/**
 * Display-only section plane: vertical (parallel to the shaft axes),
 * with its normal at `angleDeg` from +X, `offsetMetres` from the origin.
 */
export interface SectionState {
  enabled: boolean;
  angleDeg: number;
  offsetMetres: number;
}

/** At full explode, axial positions are stretched by this factor (display only). */
const EXPLODE_STRETCH = 3;

/** When several objects are under the pointer, the most specific wins. */
const PICK_PRIORITY: Record<PickKind, number> = { gear: 0, jewel: 1, escapement: 2, keyless: 2, moonPhase: 2, dateStar: 2, monthStar: 2, leapYearWheel: 2, arbor: 3, frame: 4, dial: 5 };

const COLORS = {
  selected: 0x4fa3ff,
  gear: 0xb8c4d0,
  arbor: 0x6f7c88,
  jewel: 0xc0304f,
  plainHole: 0x8a8a8a,
  frame: 0x5a6672,
  frameEdge: 0x8fa3b8,
  hand: { HOURS: 0xe6e9ec, MINUTES: 0xe6e9ec, SECONDS: 0xe0a95c },
  measure: 0x5cc98a,
  dial: 0xe6e1d5,
  dialMarker: 0x23282e,
  moonPhase: 0xaab4c2,
  dateStar: 0xc2a06a,
  monthStar: 0x8aa0c2,
  leapYearWheel: 0x8ac2a0,
  stem: 0x9aa4ae,
  crown: 0xa9b3bd,
  pinion: 0xb8c4d0,
  escapeWheel: 0xd9c27a,
  fork: 0x8fa3b8,
  balance: 0xc9b37a,
} as const;

const FRAME_OPACITY = { normal: 0.22, selected: 0.4 } as const;

interface Pickable {
  kind: PickKind;
  entityId: EntityId;
  baseColor: number;
  /** renderOrder/depthWrite to restore when deselected (addPickable captures these automatically). */
  baseRenderOrder: number;
  baseDepthWrite: boolean;
}

/**
 * Selected parts draw through occluding geometry (e.g. an arbor hidden
 * inside a large wheel) rather than just changing colour, since colour
 * alone can be invisible when almost nothing of the part is on screen.
 * Below the measurement line's renderOrder (10), which always wins.
 */
const SELECTION_RENDER_ORDER = 5;

/**
 * 2D cross-section of a solid, in its own unrotated local frame. Every
 * solid this viewport draws is a Z-extrusion of one of these (the section
 * plane is always vertical, SectionState above), so a section-view cap is
 * just this footprint intersected with the cutting line.
 */
type Footprint =
  | { kind: "circle"; radius: number; centre: Point2D }
  | { kind: "polygon"; points: Point2D[] }
  | { kind: "polygonWithHole"; points: Point2D[]; holeRadius: number; holeCentre: Point2D }
  | { kind: "circleWithHole"; radius: number; centre: Point2D; holeRadius: number; holeCentre: Point2D };

function footprintIntervals(footprint: Footprint, base: Point2D, dir: Point2D): Interval[] {
  switch (footprint.kind) {
    case "circle": {
      const hit = lineCircleInterval(base, dir, footprint.centre, footprint.radius);
      return hit === null ? [] : [hit];
    }
    case "polygon":
      return linePolygonIntervals(base, dir, footprint.points);
    case "polygonWithHole": {
      const outer = linePolygonIntervals(base, dir, footprint.points);
      const hole = lineCircleInterval(base, dir, footprint.holeCentre, footprint.holeRadius);
      return hole === null ? outer : subtractIntervals(outer, [hole]);
    }
    case "circleWithHole": {
      const outer = lineCircleInterval(base, dir, footprint.centre, footprint.radius);
      if (outer === null) return [];
      const hole = lineCircleInterval(base, dir, footprint.holeCentre, footprint.holeRadius);
      return hole === null ? [outer] : subtractIntervals([outer], [hole]);
    }
  }
}

/**
 * A solid registered for section-view capping. `positionX/Y` is its
 * footprint's offset in content space, captured once per rebuild;
 * `rotationGroup` (if set) is read live each update, since shafts spin
 * during simulation playback and the cap must track them (STATUS.md
 * "section view has no caps"). Covers frames, arbors, gears, jewels,
 * the dial, the escapement (escape wheel, balance, pallet fork) and
 * hands — not keyless-works parts (stem, crown, pinions): their axis
 * lies horizontal, in the mainplate plane (ASM-0019), so a vertical
 * section plane generally cuts them into an ellipse, not a circle or
 * polygon; outside what this Z-extrusion-based approach covers (see
 * STATUS.md). They still show the pre-existing uncapped clip.
 */
interface CappableSolid {
  positionX: number;
  positionY: number;
  rotationGroup: THREE.Group | null;
  zLo: number;
  zHi: number;
  footprint: Footprint;
  color: number;
}

/** Double-sided so the inside of a part shows where the section plane cuts it. */
function material(color: number, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, metalness: 0.35, roughness: 0.55, side: THREE.DoubleSide, ...extra });
}

/**
 * Materials for a disc complication built on `createZCylinder` — three
 * CylinderGeometry face groups (side, then its two caps). With position
 * labels (ASM-0051, date/month/leap-year, not moonphase), the cap facing
 * −Z (toward the dial, ASM-0014) carries them as a texture; the same
 * plain colour otherwise. Three entries always, matching the geometry's
 * own three material groups regardless.
 */
function discMaterials(color: number, extra: THREE.MeshStandardMaterialParameters, labels: readonly string[] | null): THREE.MeshStandardMaterial[] {
  const plain = material(color, extra);
  const texture = labels === null ? null : createDiscLabelTexture(labels);
  const labeled = texture === null ? plain : material(color, { ...extra, map: texture });
  // CylinderGeometry's own group order after createZCylinder's rotateX(π/2): [side, +Z cap, −Z cap].
  return [plain, plain, labeled];
}

/**
 * Presentation layer only. Renders the domain model at its solved
 * positions and heights, and rotates each shaft group by the simulation
 * angle. It never computes mechanical state. Parts with invalid
 * parameters or unresolved placement are not drawn; the validation
 * console says why.
 */
export class Viewport {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private view: ViewSide = "BRIDGE";
  private explode = 0;
  private section: SectionState = { enabled: false, angleDeg: 0, offsetMetres: 0 };
  private readonly sectionPlane = new THREE.Plane();
  private readonly content = new THREE.Group();
  private readonly shaftGroups = new Map<ShaftId, THREE.Group>();
  private readonly stemSpins = new Map<KeylessWorksId, { stem: THREE.Group; windingPinion: THREE.Group }>();
  /**
   * A leap-year wheel's own driver-pin assembly (ASM-0050) — not backed
   * by a declared `ShaftId` (the driver has no arbor of its own), so
   * tracked separately from `shaftGroups`. `group` sits at the driver's
   * own (month star's) position and is NOT parented under the month
   * star's own shaftGroup, since the pin's own angle is a derived
   * function of the leap-year wheel's simulation state
   * (`SimulationState.genevaStrokes`), not the month star's own jump
   * angle.
   */
  private readonly genevaDriverPins = new Map<LeapYearComplicationId, { group: THREE.Group; wheelShaftId: ShaftId; directionWheelFromDriver: number }>();
  /**
   * A date complication's own jumper rod (ASM-0053): its nose tracks a
   * point on the star's own rim, read fresh from the star's own already-
   * simulated `shaftAngle` every frame — no stroke state to track (the
   * jump itself stays instantaneous, ASM-0048), just a fixed pivot and
   * a star centre to compute the rod's current angle/length from.
   */
  private readonly dateJumperLinkages = new Map<DateComplicationId, { rod: THREE.Mesh; pivot: { x: number; y: number }; starCentre: { x: number; y: number }; starShaftId: ShaftId; noseRadius: number; z: number }>();
  private showDial = true;
  private readonly escapementLabel: HTMLDivElement;
  private readonly pickables: THREE.Mesh[] = [];
  private readonly cappableSolids: CappableSolid[] = [];
  private readonly sectionCapMeshes: THREE.Mesh[] = [];
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly container: HTMLElement;
  private readonly store: AppStore;
  private animationHandle: number | null = null;
  private lastTimestampMs: number | null = null;
  private pointerDown: { x: number; y: number } | null = null;
  private unsubscribe: (() => void) | null = null;
  private framedGeneration: number;
  private resizeObserver: ResizeObserver | null = null;
  private hasRebuilt = false;
  private contentWasEmpty = true;

  constructor(container: HTMLElement, store: AppStore) {
    this.container = container;
    this.store = store;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(35, 1, 1e-4, 1);
    this.controls = this.createControls();

    this.scene.background = new THREE.Color(0x0b0d10);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.3);
    keyLight.position.set(0.02, -0.03, 0.05);
    this.scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.4);
    rimLight.position.set(-0.03, 0.02, -0.02);
    this.scene.add(rimLight);
    this.scene.add(this.content);

    container.appendChild(this.createViewButtons());
    this.escapementLabel = document.createElement("div");
    this.escapementLabel.className = "viewport-model-label";
    this.escapementLabel.textContent = "SIMPLIFIED ESCAPEMENT MODEL";
    this.escapementLabel.title = "Kinematic only: the balance swings at a declared amplitude and the train ticks once per beat. No contact, impact or balance dynamics are modeled (ESC-002).";
    this.escapementLabel.hidden = true;
    container.appendChild(this.escapementLabel);
    this.renderer.domElement.addEventListener("pointerdown", this.handlePointerDown);
    this.renderer.domElement.addEventListener("pointerup", this.handlePointerUp);
    this.resizeObserver = new ResizeObserver(() => {
      this.resize();
      // Re-fit so the movement stays framed as panels dock, float, close or resize (STATUS.md
      // "camera... does not re-fit the movement"). Skipped before the first rebuild, which frames on its own.
      if (this.hasRebuilt) this.frameCamera();
    });
    this.resizeObserver.observe(container);
    this.resize();

    this.rebuild();
    this.hasRebuilt = true;
    this.frameCamera();
    this.framedGeneration = store.designGeneration;
    this.contentWasEmpty = this.contentIsEmpty();
    this.unsubscribe = store.subscribe(() => {
      this.rebuild();
      const isEmpty = this.contentIsEmpty();
      // Re-fit on a freshly loaded design, or the first time content appears in an empty one
      // (STATUS.md "a design built up from empty keeps the default view"), not on every edit —
      // once there's something to see, further edits shouldn't yank the user's chosen view.
      if (store.designGeneration !== this.framedGeneration || (this.contentWasEmpty && !isEmpty)) {
        this.framedGeneration = store.designGeneration;
        this.frameCamera();
      }
      this.contentWasEmpty = isEmpty;
    });

    this.animationHandle = requestAnimationFrame(this.animate);
  }

  private resize(): void {
    const { clientWidth, clientHeight } = this.container;
    if (clientWidth === 0 || clientHeight === 0) return;
    this.camera.aspect = clientWidth / clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(clientWidth, clientHeight);
  }

  /**
   * OrbitControls fixes its orbit axis from camera.up when constructed, so
   * switching between the bridge-side view (Z up) and the dial view (+Y up,
   * 12 o'clock at the top) recreates the controls.
   */
  private createControls(): OrbitControls {
    this.camera.up.set(0, this.view === "DIAL" ? 1 : 0, this.view === "DIAL" ? 0 : 1);
    const controls = new OrbitControls(this.camera, this.renderer.domElement);
    controls.enableDamping = true;
    return controls;
  }

  private createViewButtons(): HTMLElement {
    const bar = document.createElement("div");
    bar.className = "viewport-views";
    for (const [view, label, title] of [
      ["BRIDGE", "Bridge side", "Oblique view from the bridge side"],
      ["DIAL", "Dial side", "Straight onto the dial side, 12 o'clock at the top"],
    ] as const) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.title = title;
      button.addEventListener("click", () => {
        this.setView(view);
      });
      bar.appendChild(button);
    }
    return bar;
  }

  setView(view: ViewSide): void {
    this.view = view;
    this.controls.dispose();
    this.controls = this.createControls();
    this.frameCamera();
  }

  private contentIsEmpty(): boolean {
    return new THREE.Box3().setFromObject(this.content).isEmpty();
  }

  /** Fits the view to the content. Called on load and view change, so the user's view survives edits. */
  private frameCamera(): void {
    const box = new THREE.Box3().setFromObject(this.content);
    if (box.isEmpty()) {
      this.camera.position.set(0, -0.04, 0.04);
      return;
    }
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const dist = sphere.radius / Math.sin(THREE.MathUtils.degToRad(this.camera.fov / 2));
    // The dial is on the −Z side (ASM-0014): look up at it from below.
    const direction =
      this.view === "DIAL" ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0.35, -0.75, 0.9).normalize();
    this.camera.position.copy(sphere.center).addScaledVector(direction, dist * (this.view === "DIAL" ? 0.8 : 0.7));
    this.controls.target.copy(sphere.center);
    this.controls.update();
  }

  private addPickable(parent: THREE.Object3D, mesh: THREE.Mesh, pick: Omit<Pickable, "baseRenderOrder" | "baseDepthWrite">): void {
    const firstMaterial = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    mesh.userData = {
      ...pick,
      baseRenderOrder: mesh.renderOrder,
      baseDepthWrite: (firstMaterial as THREE.MeshStandardMaterial).depthWrite,
    } satisfies Pickable;
    parent.add(mesh);
    this.pickables.push(mesh);
  }

  private clear(): void {
    this.content.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
        (object.geometry as THREE.BufferGeometry).dispose();
        const mat = object.material as THREE.Material | THREE.Material[];
        for (const m of Array.isArray(mat) ? mat : [mat]) m.dispose();
      }
    });
    this.content.clear();
    this.shaftGroups.clear();
    this.stemSpins.clear();
    this.genevaDriverPins.clear();
    this.dateJumperLinkages.clear();
    this.pickables.length = 0;
    this.cappableSolids.length = 0;
    this.sectionCapMeshes.length = 0;
  }

  private rebuild(): void {
    this.clear();
    const { movement, analysis } = this.store;
    const positions = analysis.placement.shaftPositions;

    for (const frame of Object.values(movement.frames)) {
      if (!isCompleteFrame(frame)) continue;
      const range = frameZRange(frame);
      const geometry = createFrameGeometry(frame.outline, range.hi - range.lo);
      const mesh = new THREE.Mesh(
        geometry,
        material(COLORS.frame, { transparent: true, opacity: FRAME_OPACITY.normal, depthWrite: false, side: THREE.DoubleSide }),
      );
      mesh.position.z = this.displayZ(range.lo);
      mesh.renderOrder = 2;
      this.addPickable(this.content, mesh, { kind: "frame", entityId: frame.id, baseColor: COLORS.frame });
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry, 30),
        new THREE.LineBasicMaterial({ color: COLORS.frameEdge, transparent: true, opacity: 0.6 }),
      );
      edges.position.z = this.displayZ(range.lo);
      this.content.add(edges);
      this.cappableSolids.push({
        positionX: 0,
        positionY: 0,
        rotationGroup: null,
        zLo: this.displayZ(range.lo),
        zHi: this.displayZ(range.lo) + (range.hi - range.lo),
        footprint:
          frame.outline.kind === "CIRCLE"
            ? { kind: "circle", radius: frame.outline.radius, centre: frame.outline.centre }
            : { kind: "polygon", points: frame.outline.points },
        color: COLORS.frame,
      });
    }

    for (const shaft of Object.values(movement.shafts)) {
      const axis = positions.get(shaft.id);
      if (axis === undefined) continue;
      const group = new THREE.Group();
      group.position.set(axis.x, axis.y, 0);
      this.content.add(group);
      this.shaftGroups.set(shaft.id, group);

      const span = arborZRange(movement, shaft.id);
      if (span !== null && span.hi > span.lo) {
        const knownPivots = [shaft.pivotDiameter.LOWER, shaft.pivotDiameter.UPPER].filter(
          (d): d is NonNullable<typeof d> => d !== null && Number.isFinite(d) && d > 0,
        );
        const radius = knownPivots.length > 0 ? Math.max(...knownPivots) / 2 : ASSEMBLY_VISUALIZATION.arborRadiusMetres;
        const arbor = new THREE.Mesh(createZCylinder(radius, this.displayZ(span.lo), this.displayZ(span.hi), 12), material(COLORS.arbor));
        this.addPickable(group, arbor, { kind: "arbor", entityId: shaft.id, baseColor: COLORS.arbor });
        this.cappableSolids.push({
          positionX: axis.x,
          positionY: axis.y,
          rotationGroup: group,
          zLo: this.displayZ(span.lo),
          zHi: this.displayZ(span.hi),
          footprint: { kind: "circle", radius, centre: { x: 0, y: 0 } },
          color: COLORS.arbor,
        });
      }
    }

    for (const gear of Object.values(movement.gears)) {
      const group = this.shaftGroups.get(gear.shaftId);
      if (group === undefined || !Number.isFinite(gear.zCentre)) continue;
      let geometry: THREE.ExtrudeGeometry;
      try {
        geometry = createGearGeometry(gear, movement);
      } catch {
        continue;
      }
      const mesh = new THREE.Mesh(geometry, material(COLORS.gear, { metalness: 0.55, roughness: 0.4 }));
      const meshZ = this.displayZ(gear.zCentre);
      mesh.position.z = meshZ;
      this.addPickable(group, mesh, { kind: "gear", entityId: gear.id, baseColor: COLORS.gear });
      this.cappableSolids.push({
        positionX: group.position.x,
        positionY: group.position.y,
        rotationGroup: group,
        // Explode stretches position (meshZ), never thickness, matching the mesh's own local ±thickness/2 extent.
        zLo: meshZ - gear.thickness / 2,
        zHi: meshZ + gear.thickness / 2,
        footprint: { kind: "polygonWithHole", points: generateGearOutline(gear), holeRadius: visualBoreRadius(gear), holeCentre: { x: 0, y: 0 } },
        color: COLORS.gear,
      });
    }

    for (const moon of Object.values(movement.moonPhases)) {
      const group = this.shaftGroups.get(moon.shaftId);
      const valid = Number.isFinite(moon.diameter) && moon.diameter > 0 && Number.isFinite(moon.thickness) && moon.thickness > 0 && Number.isFinite(moon.faceHeight);
      if (group === undefined || !valid) continue;
      // Turns continuously with its own arbor's group (ASM-0047) — no special-case rotation code, the
      // same applyKinematicRotation() loop that spins every other shaft group spins this one too.
      const zLo = this.displayZ(moon.faceHeight);
      const zHi = zLo + moon.thickness;
      const mesh = new THREE.Mesh(createZCylinder(moon.diameter / 2, zLo, zHi, 64), material(COLORS.moonPhase, { metalness: 0.1, roughness: 0.7 }));
      this.addPickable(group, mesh, { kind: "moonPhase", entityId: moon.id, baseColor: COLORS.moonPhase });
      this.cappableSolids.push({
        positionX: group.position.x,
        positionY: group.position.y,
        rotationGroup: group,
        zLo,
        zHi,
        footprint: { kind: "circle", radius: moon.diameter / 2, centre: { x: 0, y: 0 } },
        color: COLORS.moonPhase,
      });
    }

    for (const date of Object.values(movement.dateComplications)) {
      const group = this.shaftGroups.get(date.starShaftId);
      const valid = Number.isFinite(date.starTipDiameter) && date.starTipDiameter > 0 && Number.isFinite(date.starThickness) && date.starThickness > 0 && Number.isFinite(date.starZCentre);
      if (group === undefined || !valid) continue;
      // The star's own group turns only when `stepSimulation` jumps it (ASM-0048) — the same
      // applyKinematicRotation() loop that spins every other shaft group spins this one too, since
      // the jump writes straight into simulation.shaftAngle; no special-case rotation code needed.
      const meshZ = this.displayZ(date.starZCentre);
      const dateLabels = findDiscComplication(movement, date.id)?.positionLabels ?? null;
      const mesh = new THREE.Mesh(createZCylinder(date.starTipDiameter / 2, meshZ - date.starThickness / 2, meshZ + date.starThickness / 2, 64), discMaterials(COLORS.dateStar, { metalness: 0.1, roughness: 0.7 }, dateLabels));
      this.addPickable(group, mesh, { kind: "dateStar", entityId: date.id, baseColor: COLORS.dateStar });
      this.cappableSolids.push({
        positionX: group.position.x,
        positionY: group.position.y,
        rotationGroup: group,
        zLo: meshZ - date.starThickness / 2,
        zHi: meshZ + date.starThickness / 2,
        footprint: { kind: "circle", radius: date.starTipDiameter / 2, centre: { x: 0, y: 0 } },
        color: COLORS.dateStar,
      });

      // The date's own visual linkage (ASM-0053): a cam fixed to the continuously-driven drive
      // shaft (turns for free — it's just another child of that arbor's own shaftGroup, no new
      // tracking needed) and a jumper rod whose nose tracks the star's own already-simulated
      // shaftAngle every frame (dateJumperLinkages, applyKinematicRotation()).
      const driveGroup = this.shaftGroups.get(date.driveShaftId);
      const starCentre = positions.get(date.starShaftId);
      const driveCentre = positions.get(date.driveShaftId);
      if (driveGroup !== undefined && starCentre !== undefined && driveCentre !== undefined) {
        const v = DATE_LINKAGE_VISUALIZATION;
        const centreDistance = Math.hypot(starCentre.x - driveCentre.x, starCentre.y - driveCentre.y);
        const cam = new THREE.Mesh(
          createZCylinder(v.camRadiusFraction * centreDistance, meshZ - date.starThickness / 4, meshZ + date.starThickness / 4, 24),
          material(COLORS.dateStar, { metalness: 0.3, roughness: 0.6 }),
        );
        driveGroup.add(cam);

        const starTipRadius = date.starTipDiameter / 2;
        const awayFromDrive = centreDistance > 0
          ? { x: (starCentre.x - driveCentre.x) / centreDistance, y: (starCentre.y - driveCentre.y) / centreDistance }
          : { x: 1, y: 0 };
        const pivot = {
          x: starCentre.x + awayFromDrive.x * starTipRadius * v.pivotDistanceFraction,
          y: starCentre.y + awayFromDrive.y * starTipRadius * v.pivotDistanceFraction,
        };
        const pivotKnob = new THREE.Mesh(
          createZCylinder(v.pivotKnobRadiusMetres, meshZ - date.starThickness / 2, meshZ + date.starThickness / 2, 16),
          material(COLORS.dateStar, { metalness: 0.5, roughness: 0.4 }),
        );
        pivotKnob.position.set(pivot.x, pivot.y, 0);
        this.content.add(pivotKnob);

        const rod = new THREE.Mesh(createRodGeometry(v.rodWidthMetres, v.rodThicknessMetres), material(COLORS.dateStar, { metalness: 0.4, roughness: 0.5 }));
        this.content.add(rod);
        this.dateJumperLinkages.set(date.id, { rod, pivot, starCentre, starShaftId: date.starShaftId, noseRadius: starTipRadius * v.noseRadiusFraction, z: meshZ });
      }
    }

    for (const month of Object.values(movement.monthComplications)) {
      const group = this.shaftGroups.get(month.starShaftId);
      const valid = Number.isFinite(month.starTipDiameter) && month.starTipDiameter > 0 && Number.isFinite(month.starThickness) && month.starThickness > 0 && Number.isFinite(month.starZCentre);
      if (group === undefined || !valid) continue;
      // Driven entirely by the date complication's own jumps (ASM-0049) — same applyKinematicRotation()
      // loop that spins every other shaft group spins this one too; no special-case rotation code needed.
      const meshZ = this.displayZ(month.starZCentre);
      const monthLabels = findDiscComplication(movement, month.id)?.positionLabels ?? null;
      const mesh = new THREE.Mesh(createZCylinder(month.starTipDiameter / 2, meshZ - month.starThickness / 2, meshZ + month.starThickness / 2, 64), discMaterials(COLORS.monthStar, { metalness: 0.1, roughness: 0.7 }, monthLabels));
      this.addPickable(group, mesh, { kind: "monthStar", entityId: month.id, baseColor: COLORS.monthStar });
      this.cappableSolids.push({
        positionX: group.position.x,
        positionY: group.position.y,
        rotationGroup: group,
        zLo: meshZ - month.starThickness / 2,
        zHi: meshZ + month.starThickness / 2,
        footprint: { kind: "circle", radius: month.starTipDiameter / 2, centre: { x: 0, y: 0 } },
        color: COLORS.monthStar,
      });
    }

    for (const year of Object.values(movement.leapYearComplications)) {
      const group = this.shaftGroups.get(year.wheelShaftId);
      const valid = Number.isFinite(year.wheelTipDiameter) && year.wheelTipDiameter > 0 && Number.isFinite(year.wheelThickness) && year.wheelThickness > 0 && Number.isFinite(year.wheelZCentre);
      if (group === undefined || !valid) continue;
      // Driven entirely by the month complication's own December-to-January wrap (ASM-0050) —
      // same applyKinematicRotation() loop that spins every other shaft group spins this one too.
      const meshZ = this.displayZ(year.wheelZCentre);
      const yearLabels = findDiscComplication(movement, year.id)?.positionLabels ?? null;
      // The wheel's own local slot pattern is oriented so one slot points at the driver
      // (direction from wheel to driver) at shaftAngle 0 — see createGenevaWheelGeometry's own
      // doc comment for why that one alignment condition is enough for every subsequent dwell.
      const month = movement.monthComplications[year.monthComplicationId];
      const wheelCentre = positions.get(year.wheelShaftId);
      const driverCentre = month === undefined ? undefined : positions.get(month.starShaftId);
      const directionWheelFromDriver = wheelCentre !== undefined && driverCentre !== undefined
        ? Math.atan2(wheelCentre.y - driverCentre.y, wheelCentre.x - driverCentre.x)
        : null;
      const baseAngle = directionWheelFromDriver === null ? 0 : directionWheelFromDriver + Math.PI;
      const mesh = new THREE.Mesh(
        createGenevaWheelGeometry(year.wheelTipDiameter / 2, year.wheelThickness, LEAP_YEAR_SLOT_COUNT, baseAngle),
        discMaterials(COLORS.leapYearWheel, { metalness: 0.1, roughness: 0.7 }, yearLabels),
      );
      mesh.position.z = meshZ;
      this.addPickable(group, mesh, { kind: "leapYearWheel", entityId: year.id, baseColor: COLORS.leapYearWheel });
      this.cappableSolids.push({
        positionX: group.position.x,
        positionY: group.position.y,
        rotationGroup: group,
        zLo: meshZ - year.wheelThickness / 2,
        zHi: meshZ + year.wheelThickness / 2,
        // The slots cut into the rim (createGenevaWheelGeometry) are not reflected here — a
        // plain-circle footprint is a close enough approximation for the section-view cutaway cap.
        footprint: { kind: "circle", radius: year.wheelTipDiameter / 2, centre: { x: 0, y: 0 } },
        color: COLORS.leapYearWheel,
      });

      // The driver pin assembly (ASM-0050): not backed by its own arbor, so built here directly
      // rather than via a shaftGroup. Centre distance and pin orbit radius both derive from the
      // wheel's and driver's own already-declared positions (no invented geometry parameter).
      if (driverCentre !== undefined && directionWheelFromDriver !== null) {
        const v = GENEVA_WHEEL_VISUALIZATION;
        const centreDistance = Math.hypot(wheelCentre !== undefined ? wheelCentre.x - driverCentre.x : 0, wheelCentre !== undefined ? wheelCentre.y - driverCentre.y : 0);
        const pinOrbitRadius = genevaLambda(LEAP_YEAR_SLOT_COUNT) * centreDistance;
        const driverGroup = new THREE.Group();
        driverGroup.position.set(driverCentre.x, driverCentre.y, 0);
        this.content.add(driverGroup);
        const carrier = new THREE.Mesh(
          createZCylinder(pinOrbitRadius * v.driverCarrierRadiusFactor, meshZ - year.wheelThickness / 4, meshZ + year.wheelThickness / 4, 32),
          material(COLORS.leapYearWheel, { metalness: 0.3, roughness: 0.6 }),
        );
        driverGroup.add(carrier);
        const pin = new THREE.Mesh(
          createZCylinder(v.pinRadiusMetres, meshZ - year.wheelThickness / 2, meshZ + year.wheelThickness / 2, 16),
          material(COLORS.leapYearWheel, { metalness: 0.6, roughness: 0.35 }),
        );
        pin.position.set(pinOrbitRadius, 0, 0);
        driverGroup.add(pin);
        this.genevaDriverPins.set(year.id, { group: driverGroup, wheelShaftId: year.wheelShaftId, directionWheelFromDriver });
      }
    }

    // Hands sit below the dial face, or below the lowest part of the movement if there is no dial (ASM-0016).
    const dialFaces = Object.values(movement.dials).map((d) => d.faceHeight).filter(Number.isFinite);
    const lowest = Math.min(
      0,
      ...Object.values(movement.gears).filter((g) => Number.isFinite(g.zCentre) && Number.isFinite(g.thickness)).map((g) => g.zCentre - g.thickness / 2),
      ...Object.values(movement.frames).filter(isCompleteFrame).map((f) => f.zBottom),
      ...dialFaces,
    );
    for (const shaft of Object.values(movement.shafts)) {
      const group = this.shaftGroups.get(shaft.id);
      if (shaft.hand === null || group === undefined) continue;
      const mesh = new THREE.Mesh(createHandGeometry(shaft.hand), material(COLORS.hand[shaft.hand], { metalness: 0.6, roughness: 0.3 }));
      const meshZ = this.displayZ(lowest) - HAND_VISUALIZATION[shaft.hand].gapBelowMovementMetres - HAND_VISUALIZATION.thicknessMetres;
      mesh.position.z = meshZ;
      this.addPickable(group, mesh, { kind: "arbor", entityId: shaft.id, baseColor: COLORS.hand[shaft.hand] });
      this.cappableSolids.push({
        positionX: group.position.x,
        positionY: group.position.y,
        rotationGroup: group,
        zLo: meshZ,
        zHi: meshZ + HAND_VISUALIZATION.thicknessMetres,
        footprint: {
          kind: "polygonWithHole",
          points: generateHandOutline(shaft.hand),
          holeRadius: handHubRadius(shaft.hand),
          holeCentre: { x: 0, y: 0 },
        },
        color: COLORS.hand[shaft.hand],
      });
    }

    for (const jewel of Object.values(movement.jewels)) {
      const axis = positions.get(jewel.shaftId);
      const frame = movement.frames[jewel.frameId];
      if (axis === undefined || frame === undefined || !isCompleteFrame(frame)) continue;
      const range = frameZRange(frame);
      const lo = this.displayZ(range.lo);
      const hi = lo + (range.hi - range.lo);
      const color = jewel.kind === "HOLE_JEWEL" ? COLORS.jewel : COLORS.plainHole;
      // Drawn slightly proud of the slab so it reads through the translucent frame.
      const proud = (hi - lo) * 0.05;
      const mesh = new THREE.Mesh(
        createZCylinder(ASSEMBLY_VISUALIZATION.jewelOuterRadiusMetres, lo - proud, hi + proud),
        material(color, { metalness: 0.1, roughness: 0.25 }),
      );
      mesh.position.set(axis.x, axis.y, 0);
      this.addPickable(this.content, mesh, { kind: "jewel", entityId: jewel.id, baseColor: color });
      this.cappableSolids.push({
        positionX: axis.x,
        positionY: axis.y,
        rotationGroup: null,
        zLo: lo - proud,
        zHi: hi + proud,
        footprint: { kind: "circle", radius: ASSEMBLY_VISUALIZATION.jewelOuterRadiusMetres, centre: { x: 0, y: 0 } },
        color,
      });
    }

    this.addEscapementMeshes();

    if (this.showDial) {
      for (const dial of Object.values(movement.dials)) {
        const built = buildDialMeshes(dial, analysis.placement, (z) => this.displayZ(z), {
          disc: material(COLORS.dial, { metalness: 0.05, roughness: 0.8 }),
          marker: material(COLORS.dialMarker, { metalness: 0.2, roughness: 0.5 }),
        }, Object.values(movement.dialWindows));
        if (built === null) continue;
        this.content.add(built.root);
        built.disc.userData = {
          kind: "dial",
          entityId: dial.id,
          baseColor: COLORS.dial,
          baseRenderOrder: built.disc.renderOrder,
          baseDepthWrite: (built.disc.material as THREE.MeshStandardMaterial).depthWrite,
        } satisfies Pickable;
        this.pickables.push(built.disc);
        const centre = positions.get(dial.centreShaftId);
        if (centre !== undefined) {
          const face = this.displayZ(dial.faceHeight);
          // The hour markers aren't capped: thin cosmetic boxes (ASM-0020), not a structural part.
          this.cappableSolids.push({
            positionX: centre.x,
            positionY: centre.y,
            rotationGroup: null,
            zLo: face,
            zHi: face + dial.thickness,
            footprint: { kind: "circle", radius: dial.diameter / 2, centre: { x: 0, y: 0 } },
            color: COLORS.dial,
          });
        }
      }
    }

    for (const keyless of Object.values(movement.keylessWorks)) {
      const built = buildStemMeshes(movement, analysis.placement, keyless, this.store.simulationTrain.stemPosition, (z) => this.displayZ(z), {
        stem: material(COLORS.stem),
        crown: material(COLORS.crown, { metalness: 0.6, roughness: 0.35 }),
        pinion: material(COLORS.pinion, { metalness: 0.55, roughness: 0.4 }),
      });
      if (built === null) continue;
      this.content.add(built.root);
      for (const mesh of built.pickMeshes) {
        mesh.userData = {
          kind: "keyless",
          entityId: keyless.id,
          baseColor: (mesh.material as THREE.MeshStandardMaterial).color.getHex(),
          baseRenderOrder: mesh.renderOrder,
          baseDepthWrite: (mesh.material as THREE.MeshStandardMaterial).depthWrite,
        } satisfies Pickable;
        this.pickables.push(mesh);
      }
      this.stemSpins.set(keyless.id, { stem: built.stemSpin, windingPinion: built.windingSpin });
    }

    this.addMeasurementLine();
    this.applySelection();
    this.updateSectionCaps();
  }

  /** Escape wheel on its arbor, pallet fork on its arbor, balance on its staff (visual shapes, ASM-0012). */
  private addEscapementMeshes(): void {
    const { movement, analysis } = this.store;
    const esc = primaryEscapement(movement);
    this.escapementLabel.hidden = esc === null;
    if (esc === null) return;
    const positions = analysis.placement.shaftPositions;
    const pick = (mesh: THREE.Mesh, color: number, parent: THREE.Object3D): void => {
      this.addPickable(parent, mesh, { kind: "escapement", entityId: esc.id, baseColor: color });
    };
    const w = esc.escapeWheel;
    const escapeGroup = this.shaftGroups.get(esc.escapeArborShaftId);
    const tipR = w.tipDiameter / 2;
    // The tooth's real shape, derived from pallet geometry (ASM-0038, ASM-0039, ASM-0040), when there is one to derive it from.
    const pgForWheel = esc.pallets;
    const escapeToothFace: EscapeToothFace | undefined =
      pgForWheel !== null && Number.isInteger(w.toothCount) && w.toothCount > 0
        ? {
            toothWidthAngle: toothWidthAngle(w.toothCount, pgForWheel.widthAngle, pgForWheel.dropAngle),
            toothDrawAngle: Number.isFinite(pgForWheel.drawAngle) && pgForWheel.drawAngle > 0 ? toothDrawAngle(pgForWheel.drawAngle) : 0,
          }
        : undefined;
    if (escapeGroup !== undefined && Number.isInteger(w.toothCount) && w.toothCount > 0 && tipR > 0 && w.thickness > 0 && Number.isFinite(w.zCentre)) {
      const mesh = new THREE.Mesh(createEscapeWheelGeometry(w.toothCount, tipR, w.thickness, escapeToothFace), material(COLORS.escapeWheel, { metalness: 0.6, roughness: 0.35 }));
      const meshZ = this.displayZ(w.zCentre);
      mesh.position.z = meshZ;
      pick(mesh, COLORS.escapeWheel, escapeGroup);
      this.cappableSolids.push({
        positionX: escapeGroup.position.x,
        positionY: escapeGroup.position.y,
        rotationGroup: escapeGroup,
        zLo: meshZ - w.thickness / 2,
        zHi: meshZ + w.thickness / 2,
        footprint: {
          kind: "polygonWithHole",
          points: generateEscapeWheelOutline(w.toothCount, tipR, escapeToothFace),
          holeRadius: escapeWheelHubRadius(tipR),
          holeCentre: { x: 0, y: 0 },
        },
        color: COLORS.escapeWheel,
      });
    }
    const b = esc.balance;
    const balanceGroup = this.shaftGroups.get(esc.balanceShaftId);
    if (balanceGroup !== undefined && b.diameter > 0 && b.thickness > 0 && Number.isFinite(b.zCentre)) {
      const meshZ = this.displayZ(b.zCentre);
      for (const geometry of createBalanceGeometry(b.diameter / 2, b.thickness)) {
        const mesh = new THREE.Mesh(geometry, material(COLORS.balance, { metalness: 0.6, roughness: 0.35 }));
        mesh.position.z = meshZ;
        pick(mesh, COLORS.balance, balanceGroup);
      }
      const radius = b.diameter / 2;
      this.cappableSolids.push({
        positionX: balanceGroup.position.x,
        positionY: balanceGroup.position.y,
        rotationGroup: balanceGroup,
        zLo: meshZ - b.thickness / 2,
        zHi: meshZ + b.thickness / 2,
        footprint: { kind: "circleWithHole", radius, centre: { x: 0, y: 0 }, holeRadius: balanceRimInnerRadius(radius), holeCentre: { x: 0, y: 0 } },
        color: COLORS.balance,
      });
      const { halfLength, halfWidth } = balanceArmHalfExtents(radius);
      const armThickness = b.thickness * 0.8;
      this.cappableSolids.push({
        positionX: balanceGroup.position.x,
        positionY: balanceGroup.position.y,
        rotationGroup: balanceGroup,
        zLo: meshZ - armThickness / 2,
        zHi: meshZ + armThickness / 2,
        footprint: {
          kind: "polygon",
          points: [
            { x: -halfLength, y: -halfWidth },
            { x: halfLength, y: -halfWidth },
            { x: halfLength, y: halfWidth },
            { x: -halfLength, y: halfWidth },
          ],
        },
        color: COLORS.balance,
      });

      // Roller (ASM-0044, single roller only) and ruby pin (ASM-0041), drawn at their real
      // declared/derived position and size when entered, not placeholders — the roller's own
      // crescent notch and the fork's horn jaws are not drawn, since their physical outline isn't
      // derivable from the declared angular openings alone (ASM-0044, ASM-0045, 7.1.5.6).
      if (b.rollerKind === "SINGLE" && b.rollerRadius !== null && b.rollerRadius > 0) {
        const rollerThickness = b.thickness * 0.5;
        const rollerMesh = new THREE.Mesh(
          createZCylinder(b.rollerRadius, meshZ - rollerThickness / 2, meshZ + rollerThickness / 2),
          material(COLORS.balance, { metalness: 0.5, roughness: 0.3 }),
        );
        pick(rollerMesh, COLORS.balance, balanceGroup);
        this.cappableSolids.push({
          positionX: balanceGroup.position.x,
          positionY: balanceGroup.position.y,
          rotationGroup: balanceGroup,
          zLo: meshZ - rollerThickness / 2,
          zHi: meshZ + rollerThickness / 2,
          footprint: { kind: "circle", radius: b.rollerRadius, centre: { x: 0, y: 0 } },
          color: COLORS.balance,
        });
      }
      const palletAxisForPin = positions.get(esc.palletArborShaftId);
      const balanceAxisForPin = positions.get(esc.balanceShaftId);
      if (b.impulseRadius !== null && b.impulseRadius > 0 && palletAxisForPin !== undefined && balanceAxisForPin !== undefined) {
        const v = ESCAPEMENT_VISUALIZATION;
        const towardPallet = Math.atan2(palletAxisForPin.y - balanceAxisForPin.y, palletAxisForPin.x - balanceAxisForPin.x);
        const pinX = b.impulseRadius * Math.cos(towardPallet);
        const pinY = b.impulseRadius * Math.sin(towardPallet);
        const pinHalfThickness = v.rubyPinThicknessMetres / 2;
        const pinMesh = new THREE.Mesh(
          createZCylinder(v.rubyPinRadiusMetres, meshZ - pinHalfThickness, meshZ + pinHalfThickness),
          material(COLORS.jewel, { metalness: 0.1, roughness: 0.25 }),
        );
        pinMesh.position.set(pinX, pinY, 0);
        pick(pinMesh, COLORS.jewel, balanceGroup);
        this.cappableSolids.push({
          positionX: balanceGroup.position.x,
          positionY: balanceGroup.position.y,
          rotationGroup: balanceGroup,
          zLo: meshZ - pinHalfThickness,
          zHi: meshZ + pinHalfThickness,
          footprint: { kind: "circle", radius: v.rubyPinRadiusMetres, centre: { x: pinX, y: pinY } },
          color: COLORS.jewel,
        });
      }
    }
    const palletGroup = this.shaftGroups.get(esc.palletArborShaftId);
    const pallet = positions.get(esc.palletArborShaftId);
    const escape = positions.get(esc.escapeArborShaftId);
    const balance = positions.get(esc.balanceShaftId);
    if (palletGroup !== undefined && pallet !== undefined && escape !== undefined && balance !== undefined && Number.isFinite(w.zCentre)) {
      const toEscape = Math.hypot(escape.x - pallet.x, escape.y - pallet.y);
      const toBalance = Math.hypot(balance.x - pallet.x, balance.y - pallet.y);
      // With pallet geometry the stones sit on the locking points (ASM-0025), oriented by draw (ASM-0039, ASM-0040); otherwise the arms are symbolic.
      const pg = esc.pallets;
      const arms: [PalletArm, PalletArm] =
        pg !== null && isHalfToothSpan(pg.spanTeeth) && isValidToothCount(w.toothCount) && tipR > 0
          ? (lockingPoints(escape, pallet, metres(tipR), spanAngle(w.toothCount, pg.spanTeeth)).map((p, i) => {
              // Mirrored pair (entry/exit), per Playtner: one locking face inclines toward the pallet centre, the other away (SRC-0036 "The Draw").
              const sign = i === 0 ? 1 : -1;
              const radialAngle = Math.atan2(p.y - escape.y, p.x - escape.x);
              return {
                angle: Math.atan2(p.y - pallet.y, p.x - pallet.x),
                length: Math.hypot(p.x - pallet.x, p.y - pallet.y),
                faceAngle: Number.isFinite(pg.drawAngle) && pg.drawAngle > 0 ? radialAngle + sign * pg.drawAngle : null,
              };
            }) as [PalletArm, PalletArm])
          : symbolicPalletArms(Math.atan2(escape.y - pallet.y, escape.x - pallet.x), Math.max(toEscape - tipR * 0.9, toEscape * 0.2));
      const towardBalance = Math.atan2(balance.y - pallet.y, balance.x - pallet.x);
      // The real derived fork acting length (ASM-0041), used only when it fits within the actual
      // placed pallet-to-balance distance — otherwise the cosmetic 85% placeholder, rather than
      // drawing a bar that overshoots past the balance (a real possibility: ASM-0044 notes the
      // teaching movement's own forkActingLength does not in fact fit its own placed distance).
      const ratio = forkRatio(b.liftAngle, esc.leverAngle);
      const forkLength = b.impulseRadius !== null ? forkActingLength(b.impulseRadius, ratio) : null;
      const leverLength = forkLength !== null && forkLength > 0 && forkLength < toBalance ? forkLength : toBalance * 0.85;
      const parts = createForkGeometry(towardBalance, leverLength, arms);
      const meshZ = this.displayZ(w.zCentre);
      for (const geometry of parts) {
        const mesh = new THREE.Mesh(geometry, material(COLORS.fork));
        mesh.position.z = meshZ;
        pick(mesh, COLORS.fork, palletGroup);
      }
      const v = ESCAPEMENT_VISUALIZATION;
      const barHalfThickness = v.forkThicknessMetres / 2;
      for (const { angle, length } of [{ angle: towardBalance, length: leverLength }, ...arms]) {
        this.cappableSolids.push({
          positionX: palletGroup.position.x,
          positionY: palletGroup.position.y,
          rotationGroup: palletGroup,
          zLo: meshZ - barHalfThickness,
          zHi: meshZ + barHalfThickness,
          footprint: { kind: "polygon", points: barFootprint(angle, length, v.forkWidthMetres) },
          color: COLORS.fork,
        });
      }
      const stoneHalfThickness = (v.forkThicknessMetres * 1.5) / 2;
      for (const arm of arms) {
        this.cappableSolids.push({
          positionX: palletGroup.position.x,
          positionY: palletGroup.position.y,
          rotationGroup: palletGroup,
          zLo: meshZ - stoneHalfThickness,
          zHi: meshZ + stoneHalfThickness,
          footprint: { kind: "polygon", points: generatePalletStoneOutline(arm) },
          color: COLORS.fork,
        });
      }
    }
  }

  /** Shows or hides the dial (it hides the motion works from the dial side). Display only. */
  setDialVisible(visible: boolean): void {
    this.showDial = visible;
    this.rebuild();
  }

  /** Display position of an axial coordinate. Exploding stretches positions, never thicknesses. */
  private displayZ(z: number): number {
    return z * (1 + this.explode * EXPLODE_STRETCH);
  }

  /** Indicator between the two measured parts. The values come from the domain (see assembly/measure.ts). */
  private addMeasurementLine(): void {
    const [a, b] = this.store.measureIds;
    if (!this.store.measuring || a === null || b === null) return;
    const { movement, analysis } = this.store;
    const [pointA, pointB] = this.store.measurePoints;
    // Prefer the exact point picked in the viewport; a measurement pick made via the tree or an
    // inspector "Select" button has no surface point, so fall back to that part's reference point.
    const pa = pointA ?? partReferencePoint(movement, analysis.placement, a);
    const pb = pointB ?? partReferencePoint(movement, analysis.placement, b);
    if (pa === null || pb === null) return;
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(pa.x, pa.y, this.displayZ(pa.z)),
      new THREE.Vector3(pb.x, pb.y, this.displayZ(pb.z)),
    ]);
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: COLORS.measure, depthTest: false }));
    line.renderOrder = 10;
    this.content.add(line);
  }

  /** 0 = assembled, 1 = fully exploded along the shaft axes. Display only. */
  setExplode(factor: number): void {
    this.explode = Math.min(1, Math.max(0, factor));
    this.rebuild();
  }

  get sectionState(): SectionState {
    return this.section;
  }

  setSection(section: SectionState): void {
    this.section = section;
    const angle = THREE.MathUtils.degToRad(section.angleDeg);
    // Parts on the positive side of the plane stay visible.
    this.sectionPlane.set(new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0), -section.offsetMetres);
    this.renderer.clippingPlanes = section.enabled ? [this.sectionPlane] : [];
    this.updateSectionCaps();
  }

  /**
   * Fills the section plane's cut faces (STATUS.md "section view has no
   * caps"): for every registered solid, finds where the cutting line
   * crosses its 2D footprint and draws a flat quad there, z-spanning the
   * solid. Cheap enough to call every frame while the section is on and
   * the simulation is running, which is required: a spinning gear's cut
   * face must track its rotation the same way the GPU clip already does.
   */
  private updateSectionCaps(): void {
    for (const mesh of this.sectionCapMeshes) {
      this.content.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.sectionCapMeshes.length = 0;
    if (!this.section.enabled) return;

    const angle = THREE.MathUtils.degToRad(this.section.angleDeg);
    const normal: Point2D = { x: Math.cos(angle), y: Math.sin(angle) };
    const dir: Point2D = { x: -normal.y, y: normal.x };
    const base: Point2D = { x: this.section.offsetMetres * normal.x, y: this.section.offsetMetres * normal.y };
    // A fraction of a nanometre off the plane, toward its kept side, so this cap's own vertices
    // (which sit exactly on the clip plane by construction) don't flicker against the GPU clip test.
    const NUDGE_METRES = 1e-7;
    const nudgedBase: Point2D = { x: base.x + NUDGE_METRES * normal.x, y: base.y + NUDGE_METRES * normal.y };

    for (const solid of this.cappableSolids) {
      const rotation = solid.rotationGroup?.rotation.z ?? 0;
      const c = Math.cos(rotation);
      const s = Math.sin(rotation);
      const relX = base.x - solid.positionX;
      const relY = base.y - solid.positionY;
      // Local frame = inverse of the solid's own (translate, then rotate by `rotation`) transform.
      const localBase: Point2D = { x: relX * c + relY * s, y: -relX * s + relY * c };
      const localDir: Point2D = { x: dir.x * c + dir.y * s, y: -dir.x * s + dir.y * c };

      for (const { t0, t1 } of footprintIntervals(solid.footprint, localBase, localDir)) {
        const ax = nudgedBase.x + t0 * dir.x;
        const ay = nudgedBase.y + t0 * dir.y;
        const bx = nudgedBase.x + t1 * dir.x;
        const by = nudgedBase.y + t1 * dir.y;
        const geometry = new THREE.BufferGeometry();
        // prettier-ignore
        const positions = new Float32Array([
          ax, ay, solid.zLo,
          bx, by, solid.zLo,
          bx, by, solid.zHi,
          ax, ay, solid.zHi,
        ]);
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geometry.setIndex([0, 1, 2, 0, 2, 3]);
        geometry.computeVertexNormals();
        const mesh = new THREE.Mesh(geometry, material(solid.color, { metalness: 0.2, roughness: 0.65 }));
        this.content.add(mesh);
        this.sectionCapMeshes.push(mesh);
      }
    }
  }

  /** Offset that puts the section plane through the selected part's axis, if it has one. */
  offsetThroughSelection(): number | null {
    const id = this.store.selectedId;
    if (id === null) return null;
    const point = partReferencePoint(this.store.movement, this.store.analysis.placement, id);
    if (point === null) return null;
    const angle = THREE.MathUtils.degToRad(this.section.angleDeg);
    return point.x * Math.cos(angle) + point.y * Math.sin(angle);
  }

  private applySelection(): void {
    for (const mesh of this.pickables) {
      const pick = mesh.userData as Pickable;
      const selected = pick.entityId === this.store.selectedId;
      // A disc complication's own label-texture cap (ASM-0051) is a second material slot on the
      // same mesh (one per CylinderGeometry face group); every slot tints together so the whole
      // part highlights consistently, texture and all.
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        const mat = m as THREE.MeshStandardMaterial;
        mat.color.set(selected ? COLORS.selected : pick.baseColor);
        if (pick.kind === "frame") mat.opacity = selected ? FRAME_OPACITY.selected : FRAME_OPACITY.normal;
        // Draw through occluding geometry when selected (e.g. an arbor hidden inside a large wheel);
        // depthWrite off too while selected, so this doesn't corrupt the depth buffer for what's
        // drawn after it (restored to its own original value, e.g. frames already draw with it off).
        mat.depthTest = !selected;
        mat.depthWrite = selected ? false : pick.baseDepthWrite;
      }
      mesh.renderOrder = selected ? SELECTION_RENDER_ORDER : pick.baseRenderOrder;
    }
  }

  private applyKinematicRotation(): void {
    for (const [shaftId, group] of this.shaftGroups) {
      group.rotation.z = this.store.simulation.shaftAngle[shaftId] ?? 0;
    }
    // The escapement ticks the going train once per beat and swings the fork and balance (display of ASM-0023).
    const { movement, analysis, effectiveTrain, simulation, goingTrainStopped, displayAmplitude } = this.store;
    const display = escapementDisplay(movement, analysis.train, effectiveTrain, simulation.time, {
      amplitude: displayAmplitude,
      stopped: goingTrainStopped,
    });
    if (display !== null) {
      for (const [shaftId, offset] of display.shaftAngleOffset) {
        const group = this.shaftGroups.get(shaftId);
        if (group !== undefined) group.rotation.z += offset;
      }
      const fork = this.shaftGroups.get(display.escapement.palletArborShaftId);
      if (fork !== undefined) fork.rotation.z = display.forkAngle;
      const balance = this.shaftGroups.get(display.escapement.balanceShaftId);
      if (balance !== undefined) balance.rotation.z = display.balanceAngle;
    }
    // Stem bodies turn about the stem direction, the group's local +X.
    for (const [id, spins] of this.stemSpins) {
      spins.stem.rotation.x = this.store.simulation.stemAngle[stemBodyId(id, "STEM")] ?? 0;
      spins.windingPinion.rotation.x = this.store.simulation.stemAngle[stemBodyId(id, "WINDING_PINION")] ?? 0;
    }
    // A leap-year wheel's driver pin (ASM-0050): mid-stroke, swept via the same genevaStrokeDriverAngle
    // the wheel's own β is computed from (SimulationState.genevaStrokes); dwelling, parked at its
    // entry-ready position (α = −driverMotionAngle/2) rather than at a real continuously-rotating
    // driver's own dwell position, which this project has no sourced basis for (ASM-0050).
    const half = genevaDriverMotionAngle(LEAP_YEAR_SLOT_COUNT) / 2;
    for (const pin of this.genevaDriverPins.values()) {
      const stroke = simulation.genevaStrokes[pin.wheelShaftId];
      const alpha = stroke === undefined ? -half : genevaStrokeDriverAngle(stroke.elapsedSeconds, LEAP_YEAR_INDEX_STROKE_SECONDS, LEAP_YEAR_SLOT_COUNT);
      pin.group.rotation.z = pin.directionWheelFromDriver + alpha;
    }
    // A date jumper's own rod (ASM-0053): its nose reads the star's own already-simulated
    // shaftAngle directly, every frame — a real position, not an invented animation — so it
    // swings in exact sync with the star; it snaps together with the star's own still-
    // instantaneous jump rather than easing, since no sourced release-velocity profile exists
    // to play out (unlike the leap-year Geneva drive's real stroke, ASM-0050/0052).
    for (const link of this.dateJumperLinkages.values()) {
      const starAngle = simulation.shaftAngle[link.starShaftId] ?? 0;
      const nose = {
        x: link.starCentre.x + link.noseRadius * Math.cos(starAngle),
        y: link.starCentre.y + link.noseRadius * Math.sin(starAngle),
      };
      const dx = nose.x - link.pivot.x;
      const dy = nose.y - link.pivot.y;
      link.rod.position.set(link.pivot.x, link.pivot.y, link.z);
      link.rod.rotation.z = Math.atan2(dy, dx);
      link.rod.scale.x = Math.hypot(dx, dy);
    }
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    this.pointerDown = { x: event.clientX, y: event.clientY };
  };

  /** A click selects; a drag (orbit) does not. */
  /** Undoes the explode slider's display-only Z stretch, so a picked point reflects real geometry (never the view). */
  private pickedPoint(point: THREE.Vector3): Point3 {
    return { x: point.x, y: point.y, z: point.z / (1 + this.explode * EXPLODE_STRETCH) };
  }

  private readonly handlePointerUp = (event: PointerEvent): void => {
    const start = this.pointerDown;
    this.pointerDown = null;
    if (start === null || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 4) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickables, false);
    // The dial is opaque: when it is the nearest thing under the pointer, it is what was clicked.
    const nearest = hits.reduce<(typeof hits)[number] | undefined>((best, h) => (best === undefined || h.distance < best.distance ? h : best), undefined);
    if (nearest !== undefined && (nearest.object.userData as Pickable).kind === "dial") {
      this.store.select((nearest.object.userData as Pickable).entityId, this.pickedPoint(nearest.point));
      return;
    }
    hits.sort((a, b) => {
      const pa = PICK_PRIORITY[(a.object.userData as Pickable).kind];
      const pb = PICK_PRIORITY[(b.object.userData as Pickable).kind];
      return pa - pb || a.distance - b.distance;
    });
    const hit = hits[0];
    this.store.select(hit === undefined ? null : (hit.object.userData as Pickable).entityId, hit === undefined ? null : this.pickedPoint(hit.point));
  };

  private readonly animate = (timestampMs: number): void => {
    const elapsedSeconds = this.lastTimestampMs === null ? 0 : (timestampMs - this.lastTimestampMs) / 1000;
    this.lastTimestampMs = timestampMs;

    this.store.tick(elapsedSeconds);
    this.applyKinematicRotation();
    // A spinning gear's cut face must track its rotation the same way the GPU clip already does.
    if (this.section.enabled) this.updateSectionCaps();
    this.controls.update();
    this.renderer.render(this.scene, this.camera);

    this.animationHandle = requestAnimationFrame(this.animate);
  };

  dispose(): void {
    if (this.animationHandle !== null) cancelAnimationFrame(this.animationHandle);
    this.unsubscribe?.();
    this.resizeObserver?.disconnect();
    this.renderer.domElement.removeEventListener("pointerdown", this.handlePointerDown);
    this.renderer.domElement.removeEventListener("pointerup", this.handlePointerUp);
    this.clear();
    this.renderer.dispose();
  }
}
