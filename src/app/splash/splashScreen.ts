import type { KeyValueStore } from "@/persistence/autosave";
import { gearOutline, SPLASH_TOOTH, splashGearAngles, splashGearTrain, splashTrainBounds, type SplashGear } from "./splashGears";
import { playEntryClick } from "./splashSound";
import { unlockAudio } from "@/app/audio/audioContext";

export interface SplashOptions {
  /** Where the overlay is mounted (document.body). */
  host: HTMLElement;
  /** The application root, made inert while the splash is up so nothing behind it can be tabbed to or clicked. */
  appRoot: HTMLElement;
  storage: KeyValueStore | null;
  /** Facts shown as chips, read from the design and the code, never hard-coded claims. */
  chips: readonly string[];
  /** The standing honesty line (CLAUDE.md "Safety of claims"). */
  note: string;
  /** Called the moment the screen is entered (the caller starts the app and sets its clock). */
  onEnter: () => void;
}

export const SPLASH_SOUND_KEY = "mw3d.splash.sound";
/** How long the exit zoom-and-fade runs (the app behind zooms in over the same time); reduced motion skips it. */
const LEAVE_MILLISECONDS = 1200;
/** Driver angular speed (rad/s): slow enough to read as a mechanism rather than a spinner. */
const DRIVER_SPEED = 0.16;
/** Pointer parallax travel in pixels for the gear layer and the plate (opposite directions). */
const PARALLAX = { gears: 18, plate: 7 } as const;
/** Fraction of the shorter canvas side the first (largest) gear's radius covers. */
const GEAR_SCALE_FRACTION = 0.3;
/** The gear outlines' glow: a bright core line, a tight halo and a wide soft bloom (follow-up 30, brighter). */
const GLOW = {
  colour: "rgba(120, 220, 255, 1)",
  core: "rgba(210, 244, 255, 1)",
  coreWidth: 2,
  haloBlur: 26,
  bloomBlur: 60,
  bloomWidth: 7,
  bloomAlpha: 0.32,
  fill: "rgba(70, 170, 235, 0.14)",
  detail: "rgba(140, 226, 255, 0.55)",
} as const;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The tap-to-enter start screen: a brushed-metal backdrop with a slowly turning, glowing gear train
 * (`splashGears.ts`), a translucent glass plate with the title and honesty line, pointer/tilt
 * parallax, and a soft click on entry. Tap, click or any key enters. Decorative (L0 visual): it reads
 * the design only to print its declared validation level and never changes it.
 */
export function mountSplash(options: SplashOptions): { dismiss: () => void } {
  const { host, appRoot, storage } = options;
  const reduced = prefersReducedMotion();
  appRoot.inert = true;

  const root = el("div", "splash");
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", "Mechanical Watchmaker 3D start screen");
  root.appendChild(el("div", "splash-metal"));
  const canvas = el("canvas", "splash-gears");
  canvas.setAttribute("aria-hidden", "true");
  root.appendChild(canvas);
  root.appendChild(el("div", "splash-vignette"));
  root.appendChild(el("div", "splash-scan"));

  const plate = el("div", "splash-plate");
  plate.appendChild(el("div", "splash-eyebrow", "Parametric watch CAD · kinematic simulation"));
  const title = el("h1", "splash-title");
  title.append("Mechanical Watchmaker ", el("span", "splash-title-3d", "3D"));
  plate.appendChild(title);
  plate.appendChild(el("div", "splash-rule"));
  const enter = el("button", "splash-enter", "Tap to enter");
  enter.type = "button";
  plate.appendChild(enter);
  const chips = el("div", "splash-chips");
  for (const text of options.chips) chips.appendChild(el("span", "splash-chip", text));
  plate.appendChild(chips);
  plate.appendChild(el("p", "splash-note", options.note));
  root.appendChild(plate);

  let soundOn = ((): boolean => {
    try { return storage?.getItem(SPLASH_SOUND_KEY) !== "off"; } catch { return true; }
  })();
  const soundToggle = el("button", "splash-sound");
  soundToggle.type = "button";
  const renderSound = (): void => {
    soundToggle.textContent = soundOn ? "Sound on" : "Sound off";
    soundToggle.setAttribute("aria-pressed", String(soundOn));
  };
  renderSound();
  soundToggle.addEventListener("click", (event) => {
    event.stopPropagation();
    soundOn = !soundOn;
    try { storage?.setItem(SPLASH_SOUND_KEY, soundOn ? "on" : "off"); } catch { /* the preference just isn't remembered */ }
    renderSound();
  });
  root.appendChild(soundToggle);
  host.appendChild(root);

  // --- gear canvas -------------------------------------------------------------------------
  const train = splashGearTrain();
  const bounds = splashTrainBounds(train);
  const context = canvas.getContext("2d");
  let width = 0;
  let height = 0;
  let scale = 1;
  let driverAngle = 0.4;
  let pointerX = 0;
  let pointerY = 0;
  let shownX = 0;
  let shownY = 0;

  /**
   * Each gear is drawn once, glow and all, to its own small canvas (a sprite) at angle 0; a frame then
   * only draws those sprites rotated into place. The blur of the glow is by far the costly part, and
   * it is the same every frame, so paying for it once is what keeps the gears turning smoothly on a
   * phone (follow-up 31). The sprite is rendered at device resolution so the rotation stays crisp.
   */
  interface Sprite { canvas: HTMLCanvasElement; centre: number; ratio: number }
  let sprites: Sprite[] = [];
  let originX = 0;
  let originY = 0;

  const renderSprite = (gear: SplashGear, ratio: number): Sprite => {
    const radius = (gear.teeth / 2 + SPLASH_TOOTH.addendum) * scale;
    const half = Math.ceil(radius + GLOW.bloomBlur + GLOW.bloomWidth);
    const sprite = document.createElement("canvas");
    sprite.width = Math.round(half * 2 * ratio);
    sprite.height = sprite.width;
    const c = sprite.getContext("2d");
    if (c === null) return { canvas: sprite, centre: half, ratio };
    c.setTransform(ratio, 0, 0, ratio, 0, 0);
    c.lineJoin = "round";
    const outline = gearOutline(gear.teeth, 0);
    c.beginPath();
    outline.forEach((p, i) => { if (i === 0) c.moveTo(half + p.x * scale, half + p.y * scale); else c.lineTo(half + p.x * scale, half + p.y * scale); });
    c.closePath();
    c.fillStyle = GLOW.fill;
    c.fill();
    // Wide soft bloom, then a tight halo, then a bright near-white core line on top.
    c.shadowColor = GLOW.colour;
    c.shadowBlur = GLOW.bloomBlur * ratio;
    c.strokeStyle = `rgba(90, 200, 255, ${String(GLOW.bloomAlpha)})`;
    c.lineWidth = GLOW.bloomWidth;
    c.stroke();
    c.shadowBlur = GLOW.haloBlur * ratio;
    c.strokeStyle = GLOW.colour;
    c.lineWidth = GLOW.coreWidth + 1;
    c.stroke();
    c.shadowBlur = 8 * ratio;
    c.strokeStyle = GLOW.core;
    c.lineWidth = GLOW.coreWidth * 0.6;
    c.stroke();

    const pitchRadius = (gear.teeth / 2) * scale;
    c.strokeStyle = GLOW.detail;
    c.shadowColor = GLOW.colour;
    c.shadowBlur = 10 * ratio;
    c.lineWidth = 1.2;
    c.beginPath();
    c.arc(half, half, pitchRadius * 0.78, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.arc(half, half, pitchRadius * 0.18, 0, Math.PI * 2);
    c.stroke();
    // Spokes (same five-spoke look as the movement's own wheels) or a fine cross for the small pinions.
    const spokes = gear.spokes > 0 ? gear.spokes : 4;
    c.beginPath();
    for (let k = 0; k < spokes; k += 1) {
      const a = (k * 2 * Math.PI) / spokes;
      c.moveTo(half + Math.cos(a) * pitchRadius * 0.18, half + Math.sin(a) * pitchRadius * 0.18);
      c.lineTo(half + Math.cos(a) * pitchRadius * 0.78, half + Math.sin(a) * pitchRadius * 0.78);
    }
    c.stroke();
    return { canvas: sprite, centre: half, ratio };
  };

  const resize = (): void => {
    const ratio = Math.min(window.devicePixelRatio, 2);
    width = root.clientWidth;
    height = root.clientHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context?.setTransform(ratio, 0, 0, ratio, 0, 0);
    // The first gear's radius covers GEAR_SCALE_FRACTION of the shorter side; the train spills off-screen on purpose.
    const first = train[0];
    scale = first === undefined ? 1 : (Math.min(width, height) * GEAR_SCALE_FRACTION) / (first.teeth / 2);
    // Centre the train's bounding box in the canvas.
    originX = width * 0.5 - ((bounds.minX + bounds.maxX) / 2) * scale;
    originY = height * 0.5 - ((bounds.minY + bounds.maxY) / 2) * scale;
    sprites = train.map((gear) => renderSprite(gear, ratio));
    draw();
  };

  const draw = (): void => {
    if (context === null) return;
    context.clearRect(0, 0, width, height);
    const angles = splashGearAngles(train, driverAngle);
    context.globalCompositeOperation = "lighter";
    train.forEach((gear, index) => {
      const sprite = sprites[index];
      if (sprite === undefined) return;
      const cx = originX + gear.x * scale;
      const cy = originY + gear.y * scale;
      context.save();
      context.translate(cx, cy);
      context.rotate(angles[index] ?? 0);
      context.drawImage(sprite.canvas, -sprite.centre, -sprite.centre, sprite.centre * 2, sprite.centre * 2);
      context.restore();
    });
    context.globalCompositeOperation = "source-over";
  };

  let frame = 0;
  let last = performance.now();
  const tick = (now: number): void => {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    driverAngle += DRIVER_SPEED * dt;
    // Ease the parallax toward the pointer so it glides rather than snaps.
    shownX += (pointerX - shownX) * Math.min(1, dt * 6);
    shownY += (pointerY - shownY) * Math.min(1, dt * 6);
    canvas.style.transform = `translate(${String(shownX * PARALLAX.gears)}px, ${String(shownY * PARALLAX.gears)}px)`;
    plate.style.transform = `translate(${String(-shownX * PARALLAX.plate)}px, ${String(-shownY * PARALLAX.plate)}px)`;
    draw();
    frame = requestAnimationFrame(tick);
  };

  const onPointer = (event: PointerEvent): void => {
    pointerX = (event.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
    pointerY = (event.clientY / Math.max(1, window.innerHeight)) * 2 - 1;
  };
  // Device tilt drives the same parallax on phones/tablets (iOS asks permission, so it just never fires there unless granted).
  const onTilt = (event: DeviceOrientationEvent): void => {
    if (event.gamma === null || event.beta === null) return;
    pointerX = Math.max(-1, Math.min(1, event.gamma / 30));
    pointerY = Math.max(-1, Math.min(1, (event.beta - 45) / 30));
  };

  // --- entering ----------------------------------------------------------------------------
  let left = false;
  const dismiss = (): void => {
    if (left) return;
    left = true;
    options.onEnter();
    unlockAudio(); // the tap is the user gesture that lets the second-hand tick play
    if (soundOn) playEntryClick();
    cancelAnimationFrame(frame);
    window.removeEventListener("resize", resize);
    window.removeEventListener("pointermove", onPointer);
    window.removeEventListener("deviceorientation", onTilt);
    document.removeEventListener("keydown", onKey, true);
    root.classList.add("splash-leaving");
    appRoot.inert = false;
    if (!reduced) {
      // The movement zooms in from slightly small as the splash zooms past the viewer.
      appRoot.classList.add("app-zoom-in");
      appRoot.addEventListener("animationend", () => { appRoot.classList.remove("app-zoom-in"); }, { once: true });
    }
    const finish = (): void => { root.remove(); };
    if (reduced) finish();
    else window.setTimeout(finish, LEAVE_MILLISECONDS);
  };
  const onKey = (event: KeyboardEvent): void => {
    if (event.key === "Shift" || event.key === "Control" || event.key === "Alt" || event.key === "Meta" || event.key === "Tab") return;
    event.preventDefault();
    event.stopPropagation();
    dismiss();
  };
  root.addEventListener("click", dismiss);
  document.addEventListener("keydown", onKey, true);
  window.addEventListener("resize", resize);

  resize();
  if (!reduced) {
    window.addEventListener("pointermove", onPointer);
    window.addEventListener("deviceorientation", onTilt);
    frame = requestAnimationFrame(tick);
  }
  enter.focus();
  return { dismiss };
}
