import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { AppStore } from "@/app/store";
import type { EntityId } from "@/domain/ids";
import type { ShaftId } from "@/domain/shaft";
import { createGearGeometry } from "@/geometry/gearGeometry";
import {
  ASSEMBLY_VISUALIZATION,
  createFrameGeometry,
  createZCylinder,
} from "@/geometry/assemblyGeometry3d";
import { arborZRange, frameZRange } from "@/assembly/assemblyGeometry";

type PickKind = "gear" | "jewel" | "arbor" | "frame";

/** When several objects are under the pointer, the most specific wins. */
const PICK_PRIORITY: Record<PickKind, number> = { gear: 0, jewel: 1, arbor: 2, frame: 3 };

const COLORS = {
  selected: 0x4fa3ff,
  gear: 0xb8c4d0,
  arbor: 0x6f7c88,
  jewel: 0xc0304f,
  plainHole: 0x8a8a8a,
  frame: 0x5a6672,
  frameEdge: 0x8fa3b8,
} as const;

const FRAME_OPACITY = { normal: 0.22, selected: 0.4 } as const;

interface Pickable {
  kind: PickKind;
  entityId: EntityId;
  baseColor: number;
}

function material(color: number, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, metalness: 0.35, roughness: 0.55, ...extra });
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
  private readonly controls: OrbitControls;
  private readonly content = new THREE.Group();
  private readonly shaftGroups = new Map<ShaftId, THREE.Group>();
  private readonly pickables: THREE.Mesh[] = [];
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly container: HTMLElement;
  private readonly store: AppStore;
  private animationHandle: number | null = null;
  private lastTimestampMs: number | null = null;
  private pointerDown: { x: number; y: number } | null = null;
  private unsubscribe: (() => void) | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor(container: HTMLElement, store: AppStore) {
    this.container = container;
    this.store = store;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(35, 1, 1e-4, 1);
    this.camera.up.set(0, 0, 1);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;

    this.scene.background = new THREE.Color(0x0b0d10);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.3);
    keyLight.position.set(0.02, -0.03, 0.05);
    this.scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.4);
    rimLight.position.set(-0.03, 0.02, -0.02);
    this.scene.add(rimLight);
    this.scene.add(this.content);

    this.renderer.domElement.addEventListener("pointerdown", this.handlePointerDown);
    this.renderer.domElement.addEventListener("pointerup", this.handlePointerUp);
    this.resizeObserver = new ResizeObserver(() => {
      this.resize();
    });
    this.resizeObserver.observe(container);
    this.resize();

    this.rebuild();
    this.frameCamera();
    this.unsubscribe = store.subscribe(() => {
      this.rebuild();
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

  /** Fits an oblique view to the content. Called once, so the user's view survives edits. */
  private frameCamera(): void {
    const box = new THREE.Box3().setFromObject(this.content);
    if (box.isEmpty()) {
      this.camera.position.set(0, -0.04, 0.04);
      return;
    }
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const dist = sphere.radius / Math.sin(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const direction = new THREE.Vector3(0.35, -0.75, 0.9).normalize();
    this.camera.position.copy(sphere.center).addScaledVector(direction, dist * 0.7);
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
      if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
        (object.geometry as THREE.BufferGeometry).dispose();
        const mat = object.material as THREE.Material | THREE.Material[];
        for (const m of Array.isArray(mat) ? mat : [mat]) m.dispose();
      }
    });
    this.content.clear();
    this.shaftGroups.clear();
    this.pickables.length = 0;
  }

  private rebuild(): void {
    this.clear();
    const { movement, analysis } = this.store;
    const positions = analysis.placement.shaftPositions;

    for (const frame of Object.values(movement.frames)) {
      const range = frameZRange(frame);
      if (!(range.hi > range.lo) || !Number.isFinite(range.lo)) continue;
      const geometry = createFrameGeometry(frame.outline, range.hi - range.lo);
      const mesh = new THREE.Mesh(
        geometry,
        material(COLORS.frame, { transparent: true, opacity: FRAME_OPACITY.normal, depthWrite: false, side: THREE.DoubleSide }),
      );
      mesh.position.z = range.lo;
      mesh.renderOrder = 2;
      this.addPickable(this.content, mesh, { kind: "frame", entityId: frame.id, baseColor: COLORS.frame });
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry, 30),
        new THREE.LineBasicMaterial({ color: COLORS.frameEdge, transparent: true, opacity: 0.6 }),
      );
      edges.position.z = range.lo;
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
        const arbor = new THREE.Mesh(createZCylinder(radius, span.lo, span.hi, 12), material(COLORS.arbor));
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
      mesh.position.z = gear.zCentre;
      this.addPickable(group, mesh, { kind: "gear", entityId: gear.id, baseColor: COLORS.gear });
    }

    for (const jewel of Object.values(movement.jewels)) {
      const axis = positions.get(jewel.shaftId);
      const frame = movement.frames[jewel.frameId];
      if (axis === undefined || frame === undefined) continue;
      const range = frameZRange(frame);
      if (!(range.hi > range.lo)) continue;
      const color = jewel.kind === "HOLE_JEWEL" ? COLORS.jewel : COLORS.plainHole;
      // Drawn slightly proud of the slab so it reads through the translucent frame.
      const proud = (range.hi - range.lo) * 0.05;
      const mesh = new THREE.Mesh(
        createZCylinder(ASSEMBLY_VISUALIZATION.jewelOuterRadiusMetres, range.lo - proud, range.hi + proud),
        material(color, { metalness: 0.1, roughness: 0.25 }),
      );
      mesh.position.set(axis.x, axis.y, 0);
      this.addPickable(this.content, mesh, { kind: "jewel", entityId: jewel.id, baseColor: color });
    }

    this.applySelection();
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
