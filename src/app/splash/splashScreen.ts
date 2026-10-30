import type { KeyValueStore } from "@/persistence/autosave";
import { gearOutline, moonLitPoints, partOnScreen, SPLASH_PARTS, SPLASH_TOOTH, splashGearAngles, splashGearTrain, splashTrainBounds, TILT, tiltInput, type SplashGear, type SplashPart, type TiltReading } from "./splashGears";
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
/** How long the exit fade runs (follow-up 44: a plain fade, the zoom was removed); reduced motion skips it. */
const LEAVE_MILLISECONDS = 600;
/** Driver angular speed (rad/s): slow enough to read as a mechanism rather than a spinner. */
const DRIVER_SPEED = 0.16;
/** The plate drifts against the pan: this fraction of it (the plate moves a little the other way, for depth). */
const PLATE_DRIFT = 0.04;
/** The gear layer pans this fraction of the view (the parts beyond the edges pan the whole of it, so they come in faster). */
const GEARS_PAN_SHARE = 0.8;
/** The pan eases toward its target at this rate (per second) so it glides rather than snaps. */
const PAN_EASE = 6;
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

  /** The three glow passes on the path just drawn: a wide soft bloom, a tight halo and a bright near-white core. */
  const glowStroke = (c: CanvasRenderingContext2D, ratio: number, weight = 1): void => {
    c.shadowColor = GLOW.colour;
    c.shadowBlur = GLOW.bloomBlur * ratio;
    c.strokeStyle = `rgba(90, 200, 255, ${String(GLOW.bloomAlpha)})`;
    c.lineWidth = GLOW.bloomWidth * weight;
    c.stroke();
    c.shadowBlur = GLOW.haloBlur * ratio;
    c.strokeStyle = GLOW.colour;
    c.lineWidth = (GLOW.coreWidth + 1) * weight;
    c.stroke();
    c.shadowBlur = 8 * ratio;
    c.strokeStyle = GLOW.core;
    c.lineWidth = GLOW.coreWidth * 0.6 * weight;
    c.stroke();
  };

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
    glowStroke(c, ratio);

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

  /** The decorative complication parts beyond the screen edges, each drawn once to its own sprite like the gears. */
  interface PartSprite { canvas: HTMLCanvasElement; centre: number; part: SplashPart }
  let partSprites: PartSprite[] = [];

  const renderPartSprite = (part: SplashPart, ratio: number): PartSprite => {
    const R = part.radius * Math.min(width, height);
    const reach = part.kind === "YEAR_COUNTER" ? R * 3.6 : R * 1.1;
    const half = Math.ceil(reach + GLOW.bloomBlur + GLOW.bloomWidth);
    const sprite = document.createElement("canvas");
    sprite.width = Math.round(half * 2 * ratio);
    sprite.height = sprite.width;
    const c = sprite.getContext("2d");
    if (c === null) return { canvas: sprite, centre: half, part };
    c.setTransform(ratio, 0, 0, ratio, 0, 0);
    c.lineJoin = "round";
    c.lineCap = "round";
    const circle = (x: number, y: number, r: number): void => { c.moveTo(x + r, y); c.arc(x, y, r, 0, Math.PI * 2); };
    const spokes = (count: number, inner: number, outer: number, phase = 0): void => {
      for (let k = 0; k < count; k += 1) {
        const a = phase + (k * 2 * Math.PI) / count;
        c.moveTo(half + Math.cos(a) * inner, half + Math.sin(a) * inner);
        c.lineTo(half + Math.cos(a) * outer, half + Math.sin(a) * outer);
      }
    };
    const outlinePath = (teeth: number, radius: number): void => {
      const unit = radius / (teeth / 2 + SPLASH_TOOTH.addendum);
      gearOutline(teeth, 0).forEach((pt, i) => { if (i === 0) c.moveTo(half + pt.x * unit, half + pt.y * unit); else c.lineTo(half + pt.x * unit, half + pt.y * unit); });
      c.closePath();
    };
    c.beginPath();
    if (part.kind === "MOON") {
      circle(half, half, R);
      circle(half, half, R * 0.7);
      circle(half, half, R * 0.18);
      spokes(5, R * 0.18, R * 0.7);
      glowStroke(c, ratio);
      // Eight phase icons around the rim: outline, then the lit part filled.
      for (let k = 0; k < 8; k += 1) {
        const a = -Math.PI / 2 + (k * 2 * Math.PI) / 8;
        const ix = half + Math.cos(a) * R * 0.85;
        const iy = half + Math.sin(a) * R * 0.85;
        const ir = R * 0.1;
        c.beginPath();
        circle(ix, iy, ir);
        glowStroke(c, ratio, 0.5);
        const lit = moonLitPoints(k / 8, ir);
        if (lit.length > 0) {
          c.beginPath();
          lit.forEach((pt, i) => { if (i === 0) c.moveTo(ix + pt.x, iy + pt.y); else c.lineTo(ix + pt.x, iy + pt.y); });
          c.closePath();
          c.fillStyle = "rgba(214, 244, 255, 0.85)";
          c.shadowBlur = 8 * ratio;
          c.fill();
        }
      }
    } else if (part.kind === "DATE_STAR") {
      outlinePath(31, R);
      circle(half, half, R * 0.62);
      circle(half, half, R * 0.15);
      spokes(5, R * 0.15, R * 0.62);
      glowStroke(c, ratio);
    } else if (part.kind === "MONTH_STAR") {
      outlinePath(12, R);
      circle(half, half, R * 0.55);
      circle(half, half, R * 0.14);
      spokes(4, R * 0.14, R * 0.55, Math.PI / 4);
      glowStroke(c, ratio);
    } else if (part.kind === "BALANCE") {
      circle(half, half, R);
      circle(half, half, R * 0.88);
      spokes(2, -R * 0.88, R * 0.88);
      for (const a of [0.9, 2.2, 4.0, 5.4]) circle(half + Math.cos(a) * R * 0.94, half + Math.sin(a) * R * 0.94, R * 0.04);
      glowStroke(c, ratio);
      // The hairspring: a flat spiral of five turns from the staff out towards the rim.
      c.beginPath();
      const turns = 5;
      for (let i = 0; i <= 160; i += 1) {
        const t = i / 160;
        const a = t * turns * 2 * Math.PI;
        const r = R * (0.08 + 0.5 * t);
        if (i === 0) c.moveTo(half + Math.cos(a) * r, half + Math.sin(a) * r); else c.lineTo(half + Math.cos(a) * r, half + Math.sin(a) * r);
      }
      glowStroke(c, ratio, 0.45);
    } else if (part.kind === "YEAR_COUNTER") {
      const boxWidth = R * 0.8;
      const gap = R * 0.14;
      const total = 4 * boxWidth + 3 * gap;
      for (let k = 0; k < 4; k += 1) {
        const x = half - total / 2 + k * (boxWidth + gap);
        c.rect(x, half - R * 0.55, boxWidth, R * 1.1);
      }
      glowStroke(c, ratio);
      c.font = `${String(Math.round(R * 0.9))}px ui-monospace, monospace`;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillStyle = "rgba(214, 244, 255, 0.9)";
      c.shadowColor = GLOW.colour;
      c.shadowBlur = 10 * ratio;
      Array.from(String(new Date().getFullYear()).padStart(4, "0")).forEach((digit, k) => {
        c.fillText(digit, half - total / 2 + k * (boxWidth + gap) + boxWidth / 2, half);
      });
    } else {
      // The season wheel: four wedges with a small mark in each.
      circle(half, half, R);
      circle(half, half, R * 0.3);
      spokes(4, R * 0.3, R, Math.PI / 4);
      for (let k = 0; k < 4; k += 1) {
        const a = (k * Math.PI) / 2;
        circle(half + Math.cos(a) * R * 0.64, half + Math.sin(a) * R * 0.64, R * 0.1);
      }
      glowStroke(c, ratio);
    }
    return { canvas: sprite, centre: half, part };
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
    partSprites = SPLASH_PARTS.map((part) => renderPartSprite(part, ratio));
    draw();
  };

  /** Seconds the parts have been turning, and the view's pan in pixels (eased toward its target every frame). */
  let partTime = 0;
  let panX = 0;
  let panY = 0;

  const draw = (): void => {
    if (context === null) return;
    context.clearRect(0, 0, width, height);
    const angles = splashGearAngles(train, driverAngle);
    context.globalCompositeOperation = "lighter";
    train.forEach((gear, index) => {
      const sprite = sprites[index];
      if (sprite === undefined) return;
      const cx = originX + gear.x * scale + panX * GEARS_PAN_SHARE;
      const cy = originY + gear.y * scale + panY * GEARS_PAN_SHARE;
      context.save();
      context.translate(cx, cy);
      context.rotate(angles[index] ?? 0);
      context.drawImage(sprite.canvas, -sprite.centre, -sprite.centre, sprite.centre * 2, sprite.centre * 2);
      context.restore();
    });
    // The complication parts waiting beyond the edges: drawn only when the pan brings them on screen.
    let visible = 0;
    for (const sprite of partSprites) {
      const { part } = sprite;
      if (!partOnScreen(part, width, height, { x: panX, y: panY })) continue;
      visible += 1;
      const angle = part.kind === "BALANCE" ? Math.sin(partTime * 2 * Math.PI * 0.6) * 1.0 : part.spin * partTime;
      context.save();
      context.translate(width / 2 + part.ax * width + panX, height / 2 + part.ay * height + panY);
      context.rotate(angle);
      context.drawImage(sprite.canvas, -sprite.centre, -sprite.centre, sprite.centre * 2, sprite.centre * 2);
      context.restore();
    }
    context.globalCompositeOperation = "source-over";
    root.dataset.partsVisible = String(visible);
  };

  // --- pointer and tilt --------------------------------------------------------------------
  let pointerX = 0;
  let pointerY = 0;
  let tiltX = 0;
  let tiltY = 0;
  let tiltActive = false;
  let level: TiltReading | null = null;

  let frame = 0;
  let last = performance.now();
  const tick = (now: number): void => {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    driverAngle += DRIVER_SPEED * dt;
    partTime += dt;
    // A tilted phone looks towards where it points (the scene moves the other way) and can pan the whole way to the
    // parts beyond the edges; a mouse pointer only nudges the view.
    const targetX = tiltActive ? -tiltX * TILT.panFraction * width : pointerX * TILT.pointerPanFraction * width;
    const targetY = tiltActive ? -tiltY * TILT.panFraction * height : pointerY * TILT.pointerPanFraction * height;
    const ease = Math.min(1, dt * PAN_EASE);
    panX += (targetX - panX) * ease;
    panY += (targetY - panY) * ease;
    plate.style.transform = `translate(${String(-panX * PLATE_DRIFT)}px, ${String(-panY * PLATE_DRIFT)}px)`;
    root.dataset.panX = String(Math.round(panX));
    root.dataset.panY = String(Math.round(panY));
    draw();
    frame = requestAnimationFrame(tick);
  };

  const onPointer = (event: PointerEvent): void => {
    if (event.pointerType === "touch") return;
    pointerX = (event.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
    pointerY = (event.clientY / Math.max(1, window.innerHeight)) * 2 - 1;
  };
  const screenAngle = (): number => window.screen.orientation.angle;
  /** The first reading is "level", whatever the way the phone is held; turning the screen starts again. */
  const onTilt = (event: DeviceOrientationEvent): void => {
    if (event.gamma === null || event.beta === null) return;
    // Readings are arriving, so no permission is needed (or it was given): the button has done its job.
    if (!tiltButton.hidden) {
      tiltButton.hidden = true;
      if (!tiltActive) tiltNote.hidden = false;
    }
    const reading: TiltReading = { gamma: event.gamma, beta: event.beta };
    if (level === null) { level = reading; return; }
    const input = tiltInput(reading, level, screenAngle());
    tiltX = input.x;
    tiltY = input.y;
    if (!tiltActive) {
      tiltActive = true;
      tiltNote.hidden = true;
      tiltButton.hidden = true;
    }
  };
  let tiltStarted = false;
  const startTilt = (): void => {
    if (tiltStarted) return;
    tiltStarted = true;
    window.addEventListener("deviceorientation", onTilt);
    window.screen.orientation.addEventListener("change", () => { level = null; });
  };

  // The listener is always attached on a touch device. iOS (and recent Chrome, which also has `requestPermission`) may
  // deliver nothing until the user allows it from a tap on a control, so a button asks; the first reading hides it.
  const tiltSupported = typeof window.DeviceOrientationEvent !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
  const askPermission = (window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> } | undefined)?.requestPermission;
  const tiltNote = el("div", "splash-tilt-note", "Tilt your phone to look around");
  const tiltButton = el("button", "splash-tilt", "Enable tilt");
  tiltButton.type = "button";
  tiltButton.hidden = true;
  tiltNote.hidden = true;
  tiltButton.addEventListener("click", (event) => {
    event.stopPropagation();
    askPermission?.call(window.DeviceOrientationEvent)
      .then((result) => {
        if (result === "granted") { startTilt(); tiltButton.hidden = true; tiltNote.hidden = false; }
        else tiltButton.textContent = "Tilt not allowed";
      })
      .catch(() => { tiltButton.textContent = "Tilt not available"; });
  });
  root.append(tiltNote, tiltButton);

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
    // A plain fade: the splash goes and the app is simply there (no zoom, follow-up 44).
    root.classList.add("splash-leaving");
    appRoot.inert = false;
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
    if (tiltSupported) {
      startTilt();
      if (askPermission === undefined) tiltNote.hidden = false;
      else tiltButton.hidden = false;
    }
    frame = requestAnimationFrame(tick);
  }
  enter.focus();
  return { dismiss };
}
