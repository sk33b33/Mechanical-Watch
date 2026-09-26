import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { AppStore } from "@/app/store";
import type { EntityId } from "@/domain/ids";
import type { ShaftId } from "@/domain/shaft";
import { createGearGeometry } from "@/geometry/gearGeometry";
import {
  ASSEMBLY_VISUALIZATION,
  HAND_VISUALIZATION,
  createFrameGeometry,
  createHandGeometry,
  createZCylinder,
} from "@/geometry/assemblyGeometry3d";
import { arborZRange, frameZRange, isCompleteFrame } from "@/assembly/assemblyGeometry";
import { partReferencePoint } from "@/assembly/measure";
import { stemBodyId, type KeylessWorksId } from "@/domain/keyless";
import { buildDialMeshes, buildStemMeshes } from "./keylessMeshes";
import { escapementDisplay, primaryEscapement } from "@/simulation/escapementDisplay";
import { createBalanceGeometry, createEscapeWheelGeometry, createForkGeometry, symbolicPalletArms, type PalletArm } from "@/geometry/assemblyGeometry3d";
import { isHalfToothSpan, lockingPoints, spanAngle } from "@/kinematics/palletGeometry";
import { isValidToothCount } from "@/math/gearMath";
import { metres } from "@/units/length";

type PickKind = "gear" | "jewel" | "escapement" | "keyless" | "arbor" | "frame" | "dial";
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
const PICK_PRIORITY: Record<PickKind, number> = { gear: 0, jewel: 1, escapement: 2, keyless: 2, arbor: 3, frame: 4, dial: 5 };

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
}

/** Double-sided so the inside of a part shows where the section plane cuts it. */
function material(color: number, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, metalness: 0.35, roughness: 0.55, side: THREE.DoubleSide, ...extra });
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
  private showDial = true;
  private readonly escapementLabel: HTMLDivElement;
  private readonly pickables: THREE.Mesh[] = [];
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
    });
    this.resizeObserver.observe(container);
    this.resize();

    this.rebuild();
    this.frameCamera();
    this.framedGeneration = store.designGeneration;
    this.unsubscribe = store.subscribe(() => {
      this.rebuild();
      if (store.designGeneration !== this.framedGeneration) {
        this.framedGeneration = store.designGeneration;
        this.frameCamera();
      }
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

  private addPickable(parent: THREE.Object3D, mesh: THREE.Mesh, pick: Pickable): void {
    mesh.userData = pick;
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
    this.pickables.length = 0;
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
      }
    }

    for (const gear of Object.values(movement.gears)) {
      const group = this.shaftGroups.get(gear.shaftId);
      if (group === undefined || !Number.isFinite(gear.zCentre)) continue;
      let geometry: THREE.ExtrudeGeometry;
      try {
        geometry = createGearGeometry(gear);
      } catch {
        continue;
      }
      const mesh = new THREE.Mesh(geometry, material(COLORS.gear, { metalness: 0.55, roughness: 0.4 }));
      mesh.position.z = this.displayZ(gear.zCentre);
      this.addPickable(group, mesh, { kind: "gear", entityId: gear.id, baseColor: COLORS.gear });
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
      mesh.position.z = this.displayZ(lowest) - HAND_VISUALIZATION[shaft.hand].gapBelowMovementMetres - HAND_VISUALIZATION.thicknessMetres;
      this.addPickable(group, mesh, { kind: "arbor", entityId: shaft.id, baseColor: COLORS.hand[shaft.hand] });
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
    }

    this.addEscapementMeshes();

    if (this.showDial) {
      for (const dial of Object.values(movement.dials)) {
        const built = buildDialMeshes(dial, analysis.placement, (z) => this.displayZ(z), {
          disc: material(COLORS.dial, { metalness: 0.05, roughness: 0.8 }),
          marker: material(COLORS.dialMarker, { metalness: 0.2, roughness: 0.5 }),
        });
        if (built === null) continue;
        this.content.add(built.root);
        built.disc.userData = { kind: "dial", entityId: dial.id, baseColor: COLORS.dial } satisfies Pickable;
        this.pickables.push(built.disc);
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
        mesh.userData = { kind: "keyless", entityId: keyless.id, baseColor: (mesh.material as THREE.MeshStandardMaterial).color.getHex() } satisfies Pickable;
        this.pickables.push(mesh);
      }
      this.stemSpins.set(keyless.id, { stem: built.stemSpin, windingPinion: built.windingSpin });
    }

    this.addMeasurementLine();
    this.applySelection();
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
    if (escapeGroup !== undefined && Number.isInteger(w.toothCount) && w.toothCount > 0 && tipR > 0 && w.thickness > 0 && Number.isFinite(w.zCentre)) {
      const mesh = new THREE.Mesh(createEscapeWheelGeometry(w.toothCount, tipR, w.thickness), material(COLORS.escapeWheel, { metalness: 0.6, roughness: 0.35 }));
      mesh.position.z = this.displayZ(w.zCentre);
      pick(mesh, COLORS.escapeWheel, escapeGroup);
    }
    const b = esc.balance;
    const balanceGroup = this.shaftGroups.get(esc.balanceShaftId);
    if (balanceGroup !== undefined && b.diameter > 0 && b.thickness > 0 && Number.isFinite(b.zCentre)) {
      for (const geometry of createBalanceGeometry(b.diameter / 2, b.thickness)) {
        const mesh = new THREE.Mesh(geometry, material(COLORS.balance, { metalness: 0.6, roughness: 0.35 }));
        mesh.position.z = this.displayZ(b.zCentre);
        pick(mesh, COLORS.balance, balanceGroup);
      }
    }
    const palletGroup = this.shaftGroups.get(esc.palletArborShaftId);
    const pallet = positions.get(esc.palletArborShaftId);
    const escape = positions.get(esc.escapeArborShaftId);
    const balance = positions.get(esc.balanceShaftId);
    if (palletGroup !== undefined && pallet !== undefined && escape !== undefined && balance !== undefined && Number.isFinite(w.zCentre)) {
      const toEscape = Math.hypot(escape.x - pallet.x, escape.y - pallet.y);
      const toBalance = Math.hypot(balance.x - pallet.x, balance.y - pallet.y);
      // With pallet geometry the stones sit on the locking points (ASM-0025); otherwise the arms are symbolic.
      const pg = esc.pallets;
      const arms: [PalletArm, PalletArm] =
        pg !== null && isHalfToothSpan(pg.spanTeeth) && isValidToothCount(w.toothCount) && tipR > 0
          ? (lockingPoints(escape, pallet, metres(tipR), spanAngle(w.toothCount, pg.spanTeeth)).map((p) => ({
              angle: Math.atan2(p.y - pallet.y, p.x - pallet.x),
              length: Math.hypot(p.x - pallet.x, p.y - pallet.y),
            })) as [PalletArm, PalletArm])
          : symbolicPalletArms(Math.atan2(escape.y - pallet.y, escape.x - pallet.x), Math.max(toEscape - tipR * 0.9, toEscape * 0.2));
      const parts = createForkGeometry(Math.atan2(balance.y - pallet.y, balance.x - pallet.x), toBalance * 0.85, arms);
      for (const geometry of parts) {
        const mesh = new THREE.Mesh(geometry, material(COLORS.fork));
        mesh.position.z = this.displayZ(w.zCentre);
        pick(mesh, COLORS.fork, palletGroup);
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
    const points = [a, b].map((id) => partReferencePoint(movement, analysis.placement, id));
    const [pa, pb] = points;
    if (pa === null || pb === null || pa === undefined || pb === undefined) return;
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
      const mat = mesh.material as THREE.MeshStandardMaterial;
      const selected = pick.entityId === this.store.selectedId;
      mat.color.set(selected ? COLORS.selected : pick.baseColor);
      if (pick.kind === "frame") mat.opacity = selected ? FRAME_OPACITY.selected : FRAME_OPACITY.normal;
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
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    this.pointerDown = { x: event.clientX, y: event.clientY };
  };

  /** A click selects; a drag (orbit) does not. */
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
      this.store.select((nearest.object.userData as Pickable).entityId);
      return;
    }
    hits.sort((a, b) => {
      const pa = PICK_PRIORITY[(a.object.userData as Pickable).kind];
      const pb = PICK_PRIORITY[(b.object.userData as Pickable).kind];
      return pa - pb || a.distance - b.distance;
    });
    const hit = hits[0];
    this.store.select(hit === undefined ? null : (hit.object.userData as Pickable).entityId);
  };

  private readonly animate = (timestampMs: number): void => {
    const elapsedSeconds = this.lastTimestampMs === null ? 0 : (timestampMs - this.lastTimestampMs) / 1000;
    this.lastTimestampMs = timestampMs;

    this.store.tick(elapsedSeconds);
    this.applyKinematicRotation();
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
