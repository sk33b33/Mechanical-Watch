import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { AppStore } from "@/app/store";
import type { GearId } from "@/domain/gear";
import { toMetres } from "@/units/length";
import { createGearGeometry } from "@/geometry/gearGeometry";

const SELECTED_COLOR = 0x4fa3ff;
const DEFAULT_COLOR = 0x8fa3b8;

/**
 * Presentation layer only. Reads the domain model + kinematic solution
 * from the store and renders it; never computes mechanical state itself
 * (see docs/MASTER_BUILD_PROMPT.md "Single source of truth").
 *
 * A gear whose parameters are currently invalid (e.g. mid-edit) is
 * simply not rendered — the validation console reports why — rather
 * than silently coercing the user's values or crashing the viewport.
 */
export class Viewport {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly gearMeshes = new Map<GearId, THREE.Mesh>();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly container: HTMLElement;
  private readonly store: AppStore;
  private animationHandle: number | null = null;
  private lastTimestampMs: number | null = null;
  private unsubscribe: (() => void) | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor(container: HTMLElement, store: AppStore) {
    this.container = container;
    this.store = store;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.001, 10);
    this.camera.position.set(0, 0, 0.05);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;

    this.scene.background = new THREE.Color(0x0b0d10);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(0.05, 0.08, 0.1);
    this.scene.add(keyLight);

    this.renderer.domElement.addEventListener("click", this.handleClick);
    this.resizeObserver = new ResizeObserver(() => {
      this.resize();
    });
    this.resizeObserver.observe(container);
    this.resize();

    this.rebuildGearMeshes();
    this.unsubscribe = store.subscribe(() => {
      this.rebuildGearMeshes();
    });

    this.animationHandle = requestAnimationFrame(this.animate);
  }

  private resize(): void {
    const { clientWidth, clientHeight } = this.container;
    if (clientWidth === 0 || clientHeight === 0) {
      return;
    }
    this.camera.aspect = clientWidth / clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(clientWidth, clientHeight);
  }

  private rebuildGearMeshes(): void {
    for (const mesh of this.gearMeshes.values()) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.gearMeshes.clear();

    for (const gear of Object.values(this.store.movement.gears)) {
      const axis = this.store.analysis.placement.shaftPositions.get(gear.shaftId);
      if (axis === undefined) {
        continue;
      }

      let geometry: THREE.ExtrudeGeometry;
      try {
        geometry = createGearGeometry(gear);
      } catch {
        // Invalid parameters (e.g. mid-edit): the validation console
        // already reports this; skip rendering rather than crash.
        continue;
      }

      const material = new THREE.MeshStandardMaterial({
        color: gear.id === this.store.selectedGearId ? SELECTED_COLOR : DEFAULT_COLOR,
        metalness: 0.4,
        roughness: 0.5,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(toMetres(axis.x), toMetres(axis.y), 0);
      mesh.userData.gearId = gear.id;
      this.scene.add(mesh);
      this.gearMeshes.set(gear.id, mesh);
    }
  }

  private applySelectionHighlight(): void {
    for (const [gearId, mesh] of this.gearMeshes) {
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.color.set(gearId === this.store.selectedGearId ? SELECTED_COLOR : DEFAULT_COLOR);
    }
  }

  private applyKinematicRotation(): void {
    for (const gear of Object.values(this.store.movement.gears)) {
      const mesh = this.gearMeshes.get(gear.id);
      if (mesh === undefined) {
        continue;
      }
      const angle = this.store.simulation.shaftAngle[gear.shaftId] ?? 0;
      mesh.rotation.z = angle;
    }
  }

  private readonly handleClick = (event: MouseEvent): void => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects([...this.gearMeshes.values()], false);
    const gearId = (hits[0]?.object.userData.gearId as GearId | undefined) ?? null;
    this.store.selectGear(gearId);
    this.applySelectionHighlight();
  };

  private readonly animate = (timestampMs: number): void => {
    const elapsedSeconds = this.lastTimestampMs === null ? 0 : (timestampMs - this.lastTimestampMs) / 1000;
    this.lastTimestampMs = timestampMs;

    this.store.tick(elapsedSeconds);
    this.applyKinematicRotation();
    this.applySelectionHighlight();
    this.controls.update();
    this.renderer.render(this.scene, this.camera);

    this.animationHandle = requestAnimationFrame(this.animate);
  };

  dispose(): void {
    if (this.animationHandle !== null) {
      cancelAnimationFrame(this.animationHandle);
    }
    this.unsubscribe?.();
    this.resizeObserver?.disconnect();
    this.renderer.domElement.removeEventListener("click", this.handleClick);
    this.renderer.dispose();
  }
}
