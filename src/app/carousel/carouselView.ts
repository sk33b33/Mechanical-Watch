import type { AppStore } from "@/app/store";
import type { KeyValueStore } from "@/persistence/autosave";
import { listProjects, openProject, saveProject, type ProjectSummary } from "@/persistence/library";
import { springStep } from "@/app/splash/splashGears";
import {
  angleForIndex, CAROUSEL, cardOpacity, displayAngle, flickVelocity, frontIndex, hoverOffset, isLocked, ringRadius, stepRing,
  type DragSample, type RingState,
} from "./carouselMath";
import { movementPortrait, portraitSvg } from "./movementPortrait";

export interface CarouselView {
  open(): void;
  close(): void;
  readonly isOpen: boolean;
}

export interface CarouselHooks {
  /** Stops and restarts the 3D drawing while the carousel covers it. */
  suspendViewport: () => void;
  resumeViewport: () => void;
  notify: (message: string, kind: "error" | "info") => void;
}

/** How long a chosen card takes to grow while the rest fade (ms); reduced motion skips it. */
const EXPAND_MILLISECONDS = 520;
/** The rate (rad/s) of the spring that turns a tapped card to the front. */
const GOTO_OMEGA = 9;
/** The gap (px) left between neighbouring cards on the ring. */
const CARD_GAP = 28;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

interface Card {
  summary: ProjectSummary;
  element: HTMLElement;
  art: HTMLElement;
}

/**
 * The carousel view (follow-up 53, ASM-0097): every design saved in this browser as a card on a ring. Cards hover up and
 * down; dragging turns the ring and letting go while moving flicks it, either way; it slows to a halt and a magnet locks the
 * nearest card at the front; tapping the locked card opens that design for editing and the other cards disappear. The motion
 * maths is in `carouselMath.ts`; this file only reads the library and moves elements. It opens nothing by itself and never
 * writes to a design (the "Save current design" button saves the open one into the library, as in Projects).
 */
export function mountCarousel(host: HTMLElement, store: AppStore, storage: KeyValueStore | null, hooks: CarouselHooks): CarouselView {
  const root = el("div", "carousel");
  root.dataset.testid = "carousel";
  root.hidden = true;
  root.setAttribute("role", "region");
  root.setAttribute("aria-label", "Saved movements carousel");

  const bar = el("div", "carousel-bar");
  const title = el("strong", "carousel-title", "Saved movements");
  const hint = el("span", "carousel-hint muted", "Flick or drag to spin · tap the centre one to open it");
  const saveButton = el("button", "carousel-save", "Save current design");
  saveButton.type = "button";
  saveButton.dataset.testid = "carousel-save";
  saveButton.title = "Saves the design that is open into this browser, so it appears here. Saving it again updates the same entry.";
  const closeButton = el("button", "carousel-close", "Close");
  closeButton.type = "button";
  closeButton.dataset.testid = "carousel-close";
  closeButton.title = "Back to the movement that is open";
  bar.append(title, hint, saveButton, closeButton);

  const stage = el("div", "carousel-stage");
  stage.tabIndex = 0;
  stage.setAttribute("aria-label", "Spin with the arrow keys; Enter opens the centre movement");
  const ring = el("div", "carousel-ring");
  stage.appendChild(ring);
  const empty = el("p", "carousel-empty");
  empty.dataset.testid = "carousel-empty";
  empty.hidden = true;
  const caption = el("div", "carousel-caption");
  caption.dataset.testid = "carousel-caption";
  caption.setAttribute("aria-live", "polite");
  root.append(bar, stage, empty, caption);
  host.appendChild(root);

  let cards: Card[] = [];
  let state: RingState = { angle: 0, velocity: 0 };
  let radius = 0;
  let isOpen = false;
  let expanding = false;
  let frame = 0;
  let last = 0;
  let clock = 0;
  let dragging = false;
  /** A tapped card the ring is turning to the front: the angle it is heading for. */
  let goingTo: number | null = null;
  let lastFront = -1;
  let loadToken = 0;
  const reduced = (): boolean => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const cardAt = (index: number): Card | undefined => cards[index];
  const front = (): Card | undefined => cardAt(frontIndex(state.angle, cards.length));

  const describe = (card: Card): string =>
    card.summary.problem === null ? `${card.summary.name}, saved ${new Date(card.summary.savedAt).toLocaleString()}` : `${card.summary.name}: ${card.summary.problem}`;

  /** Places every card on the ring for the current angle and time, and publishes the state for tests and assistive tools. */
  const paint = (): void => {
    const count = cards.length;
    const still = reduced();
    cards.forEach((card, index) => {
      const shown = displayAngle(index, count, state.angle);
      const bob = still ? 0 : hoverOffset(index, clock);
      card.element.style.transform = `rotateY(${String((shown * 180) / Math.PI)}deg) translateZ(${String(radius)}px) translateY(${String(bob)}px)`;
      const opacity = cardOpacity(shown);
      card.element.style.opacity = String(opacity);
      card.element.style.pointerEvents = opacity > 0.3 ? "auto" : "none";
      card.element.style.zIndex = String(Math.round(Math.cos(shown) * 100));
    });
    const at = frontIndex(state.angle, count);
    const locked = isLocked(state, count) && goingTo === null && !dragging;
    root.dataset.frontIndex = String(at);
    root.dataset.frontId = cards[at]?.summary.id ?? "";
    root.dataset.locked = String(locked);
    root.dataset.angle = state.angle.toFixed(4);
    if (at !== lastFront || locked) {
      cards.forEach((card, index) => card.element.classList.toggle("front", index === at && locked));
      if (at !== lastFront) {
        lastFront = at;
        const current = cards[at];
        caption.textContent = current === undefined ? "" : describe(current);
      }
    }
  };

  const tick = (now: number): void => {
    frame = requestAnimationFrame(tick);
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    clock += dt;
    const count = cards.length;
    if (!expanding && !dragging && count > 1) {
      if (goingTo !== null) {
        const next = springStep(state.angle, state.velocity, goingTo, GOTO_OMEGA, dt);
        state = { angle: next.position, velocity: next.velocity };
        if (Math.abs(state.angle - goingTo) < 5e-4 && Math.abs(state.velocity) < 5e-3) {
          state = { angle: goingTo, velocity: 0 };
          goingTo = null;
        }
      } else {
        state = stepRing(state, count, dt);
      }
    }
    if (!expanding) paint();
  };

  // --- cards ---------------------------------------------------------------------------------
  const layoutRing = (): void => {
    const first = cards[0];
    const width = first === undefined ? 0 : first.element.offsetWidth;
    radius = ringRadius(cards.length, width, CARD_GAP);
    ring.style.transform = `translateZ(${String(-radius)}px)`;
  };

  const fillPortraits = (token: number): void => {
    let index = 0;
    // One portrait per frame, so a long library does not freeze the page while it is drawn.
    const next = (): void => {
      if (token !== loadToken || !isOpen) return;
      const card = cards[index];
      index += 1;
      if (card === undefined) return;
      if (card.summary.problem === null) {
        const opened = openProject(storage, card.summary.id);
        const portrait = opened.ok ? movementPortrait(opened.value) : null;
        card.art.replaceChildren();
        if (portrait === null) {
          card.art.appendChild(el("div", "carousel-no-dial", opened.ok ? "No dial to show" : opened.reason));
        } else {
          card.art.appendChild(portraitSvg(portrait));
        }
        card.element.classList.toggle("portrait-ready", portrait !== null);
      }
      requestAnimationFrame(next);
    };
    requestAnimationFrame(next);
  };

  const build = (): void => {
    loadToken += 1;
    ring.replaceChildren();
    cards = [];
    lastFront = -1;
    goingTo = null;
    empty.hidden = true;
    const list = listProjects(storage);
    if (!list.ok) {
      empty.textContent = list.reason;
      empty.hidden = false;
      paint();
      return;
    }
    if (list.value.length === 0) {
      empty.textContent = "Nothing is saved in this browser yet. Press “Save current design” to put the open movement here, and it will appear on the carousel.";
      empty.hidden = false;
    }
    list.value.forEach((summary, index) => {
      const element = el("button", "carousel-card");
      element.type = "button";
      element.tabIndex = -1;
      element.dataset.testid = "carousel-card";
      element.dataset.id = summary.id;
      element.dataset.index = String(index);
      element.setAttribute("aria-label", summary.problem === null ? summary.name : `${summary.name} (cannot be opened)`);
      const art = el("div", "carousel-art");
      art.appendChild(el("div", "carousel-no-dial", summary.problem === null ? "Drawing…" : "Cannot be opened"));
      const name = el("div", "carousel-name", summary.name);
      const date = el("div", "carousel-date muted", new Date(summary.savedAt).toLocaleString());
      element.append(art, name, date);
      if (summary.problem !== null) {
        const badge = el("div", "carousel-badge issue-error", summary.problem);
        element.appendChild(badge);
      }
      ring.appendChild(element);
      cards.push({ summary, element, art });
    });
    // Start with the design that is open, if it is saved, in front; otherwise the newest.
    const openIndex = cards.findIndex((c) => c.summary.id === store.movement.id);
    state = { angle: angleForIndex(Math.max(0, openIndex), cards.length), velocity: 0 };
    layoutRing();
    paint();
    fillPortraits(loadToken);
  };

  // --- opening a card --------------------------------------------------------------------------
  const finishOpening = (card: Card): void => {
    const opened = openProject(storage, card.summary.id);
    if (!opened.ok) {
      hooks.notify(`Could not open “${card.summary.name}”: ${opened.reason}`, "error");
      shut();
      return;
    }
    store.load(opened.value);
    hooks.notify(`Opened “${card.summary.name}”. Undo (Ctrl+Z) brings back the previous design.`, "info");
    shut();
  };

  const openCard = (card: Card): void => {
    if (expanding) return;
    if (card.summary.problem !== null) {
      hooks.notify(`“${card.summary.name}” cannot be opened: ${card.summary.problem}`, "error");
      return;
    }
    expanding = true;
    root.classList.add("expanding");
    card.element.classList.add("chosen");
    // The chosen card grows to fill the view while every other card fades away.
    const grow = Math.max(stage.clientWidth / Math.max(1, card.element.offsetWidth), stage.clientHeight / Math.max(1, card.element.offsetHeight)) * 1.15;
    card.element.style.setProperty("--grow", String(grow));
    if (reduced()) finishOpening(card);
    else window.setTimeout(() => { finishOpening(card); }, EXPAND_MILLISECONDS);
  };

  // --- gestures ----------------------------------------------------------------------------------
  let pressed: { x: number; startAngle: number; time: number; target: Element | null; samples: DragSample[]; pointer: number } | null = null;
  const seconds = (): number => performance.now() / 1000;

  stage.addEventListener("pointerdown", (event) => {
    if (expanding || cards.length === 0 || (event.pointerType === "mouse" && event.button !== 0)) return;
    pressed = { x: event.clientX, startAngle: state.angle, time: seconds(), target: event.target instanceof Element ? event.target : null, samples: [{ time: seconds(), angle: state.angle }], pointer: event.pointerId };
    goingTo = null;
    state = { angle: state.angle, velocity: 0 };
    dragging = true;
    stage.classList.add("dragging");
    stage.setPointerCapture(event.pointerId);
  });
  stage.addEventListener("pointermove", (event) => {
    if (pressed?.pointer !== event.pointerId || cards.length < 2) return;
    const angle = pressed.startAngle + (event.clientX - pressed.x) * CAROUSEL.dragRadiansPerPixel;
    state = { angle, velocity: 0 };
    pressed.samples.push({ time: seconds(), angle });
    if (pressed.samples.length > 40) pressed.samples.shift();
  });
  const release = (event: PointerEvent, cancelled: boolean): void => {
    if (pressed?.pointer !== event.pointerId) return;
    const press = pressed;
    pressed = null;
    dragging = false;
    stage.classList.remove("dragging");
    if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
    if (cancelled) return;
    const moved = Math.abs(event.clientX - press.x);
    const elapsed = (seconds() - press.time) * 1000;
    if (moved <= CAROUSEL.tapMaxMovePixels && elapsed <= CAROUSEL.tapMaxMilliseconds) {
      const tapped = press.target?.closest<HTMLElement>(".carousel-card");
      const index = tapped === null || tapped === undefined ? -1 : Number(tapped.dataset.index);
      const card = cardAt(index);
      if (card === undefined) return;
      // The locked card in front opens; any other card turns to the front first.
      if (index === frontIndex(state.angle, cards.length) && isLocked(state, cards.length)) openCard(card);
      else goingTo = angleForIndex(index, cards.length, state.angle);
      return;
    }
    state = { angle: state.angle, velocity: flickVelocity(press.samples, seconds()) };
  };
  stage.addEventListener("pointerup", (event) => { release(event, false); });
  stage.addEventListener("pointercancel", (event) => { release(event, true); });
  stage.addEventListener("keydown", (event) => {
    if (expanding || cards.length === 0) return;
    const at = frontIndex(state.angle, cards.length);
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const next = (at + (event.key === "ArrowRight" ? 1 : -1) + cards.length) % cards.length;
      goingTo = angleForIndex(next, cards.length, state.angle);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const card = front();
      if (card !== undefined && isLocked(state, cards.length)) openCard(card);
    }
  });
  // A tap on a card is also a click for keyboard and assistive tools; the pointer path above handles real taps.
  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !expanding) { event.stopPropagation(); shut(); }
  });

  saveButton.addEventListener("click", () => {
    const result = saveProject(storage, store.movement);
    if (result.ok) hooks.notify(`Saved “${store.movement.name}” in this browser.`, "info");
    else hooks.notify(result.reason, "error");
    build();
  });
  closeButton.addEventListener("click", () => { shut(); });
  window.addEventListener("resize", () => { if (isOpen) { layoutRing(); paint(); } });

  function shut(): void {
    if (!isOpen) return;
    isOpen = false;
    expanding = false;
    cancelAnimationFrame(frame);
    root.hidden = true;
    root.classList.remove("expanding");
    loadToken += 1;
    ring.replaceChildren();
    cards = [];
    hooks.resumeViewport();
  }

  return {
    open() {
      if (isOpen) return;
      isOpen = true;
      expanding = false;
      root.hidden = false;
      hooks.suspendViewport();
      build();
      last = performance.now();
      frame = requestAnimationFrame(tick);
      stage.focus({ preventScroll: true });
    },
    close: shut,
    get isOpen() { return isOpen; },
  };
}
