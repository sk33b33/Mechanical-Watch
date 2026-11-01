import type { AppStore } from "@/app/store";
import type { KeyValueStore } from "@/persistence/autosave";
import { carouselSlots, CAROUSEL_SLOTS, openProject, type ProjectSummary } from "@/persistence/library";
import { springStep } from "@/app/splash/splashGears";
import {
  angleForIndex, CAROUSEL, cardOpacity, displayAngle, flickVelocity, frontIndex, hoverOffset, isLocked, ringRadius, stepRing,
  type DragSample, type RingState,
} from "./carouselMath";
import { movementPortrait, portraitSvg } from "./movementPortrait";

export interface CarouselOpenOptions {
  /** True when this is the first entry (tapping the start screen): leaving it, by any way, sets the browser time and the dial view. */
  entering?: boolean;
}

export interface CarouselView {
  open(options?: CarouselOpenOptions): void;
  close(): void;
  readonly isOpen: boolean;
}

export interface CarouselHooks {
  /** Stops and restarts the 3D drawing while the carousel covers it. */
  suspendViewport: () => void;
  resumeViewport: () => void;
  notify: (message: string, kind: "error" | "info") => void;
  /** The application root: made inert while the carousel is up, so nothing behind it can be tabbed to or clicked. */
  appRoot: HTMLElement;
  /** Starts a new, empty project in the editor (a tapped empty place). */
  startNewProject: () => void;
  /** Called when the carousel is left. `chose` is true when a movement was picked or a new project started; `entering` as in the open options. */
  left: (info: { chose: boolean; entering: boolean }) => void;
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
  /** The saved design on this place, or null for an empty place. */
  summary: ProjectSummary | null;
  element: HTMLElement;
  art: HTMLElement;
}

/**
 * The carousel (follow-up 53, 54; ASM-0097, ASM-0098): eight places on a ring, each holding a design saved in this
 * browser and put on the carousel, or empty. It fills the whole window and shows nothing else: no toolbar, no panels, no
 * edge tabs. The one control is a small Exit button (the other way out is Escape). Choosing a design, or tapping an
 * empty place to start a new project, leaves the carousel and the editor appears.
 *
 * Cards hover up and down; dragging turns the ring and letting go while moving flicks it, either way; it slows to a halt
 * and a magnet locks the nearest place at the front. Tapping a place at the side turns it to the front; tapping the locked
 * front one opens that design (and the other cards disappear) or, if it is empty, starts a new project. The motion maths is
 * in `carouselMath.ts`; this file only reads the library and moves elements, and never writes to a design.
 */
export function mountCarousel(host: HTMLElement, store: AppStore, storage: KeyValueStore | null, hooks: CarouselHooks): CarouselView {
  const root = el("div", "carousel");
  root.dataset.testid = "carousel";
  root.hidden = true;
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", "Saved movements carousel");

  const exitButton = el("button", "carousel-exit", "Exit carousel");
  exitButton.type = "button";
  exitButton.dataset.testid = "carousel-exit";
  exitButton.title = "Leave the carousel and go back to the movement that is open";

  const stage = el("div", "carousel-stage");
  stage.tabIndex = 0;
  stage.setAttribute("aria-label", "Spin with the arrow keys; Enter opens the centre movement or starts a new project on an empty place");
  const ring = el("div", "carousel-ring");
  stage.appendChild(ring);
  const problem = el("p", "carousel-problem");
  problem.dataset.testid = "carousel-problem";
  problem.hidden = true;
  const caption = el("div", "carousel-caption");
  caption.dataset.testid = "carousel-caption";
  caption.setAttribute("aria-live", "polite");
  root.append(stage, exitButton, problem, caption);
  host.appendChild(root);

  let cards: Card[] = [];
  let state: RingState = { angle: 0, velocity: 0 };
  let radius = 0;
  let isOpen = false;
  let expanding = false;
  let entering = false;
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

  const describe = (card: Card): string => {
    if (card.summary === null) return "Empty place: tap to start a new project";
    return card.summary.problem === null ? `${card.summary.name}, saved ${new Date(card.summary.savedAt).toLocaleString()}` : `${card.summary.name}: ${card.summary.problem}`;
  };

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
    root.dataset.frontId = cards[at]?.summary?.id ?? "";
    root.dataset.frontEmpty = String(cards[at]?.summary === null);
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
      const summary = card.summary;
      if (summary !== null && summary.problem === null) {
        const opened = openProject(storage, summary.id);
        const portrait = opened.ok ? movementPortrait(opened.value) : null;
        card.art.replaceChildren();
        if (portrait === null) card.art.appendChild(el("div", "carousel-no-dial", opened.ok ? "No dial to show" : opened.reason));
        else card.art.appendChild(portraitSvg(portrait));
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
    problem.hidden = true;
    const slots = carouselSlots(storage);
    let places: (ProjectSummary | null)[] = Array.from({ length: CAROUSEL_SLOTS }, () => null);
    if (slots.ok) places = slots.value;
    else {
      problem.textContent = `Saved movements are not available: ${slots.reason}`;
      problem.hidden = false;
    }
    places.forEach((summary, index) => {
      const element = el("button", summary === null ? "carousel-card empty" : "carousel-card");
      element.type = "button";
      element.tabIndex = -1;
      element.dataset.testid = summary === null ? "carousel-empty-slot" : "carousel-card";
      element.dataset.id = summary?.id ?? "";
      element.dataset.index = String(index);
      element.setAttribute("aria-label", summary === null ? "Empty place" : summary.problem === null ? summary.name : `${summary.name} (cannot be opened)`);
      const art = el("div", "carousel-art");
      if (summary === null) {
        art.appendChild(el("div", "carousel-empty-word", "Empty"));
        element.appendChild(art);
      } else {
        art.appendChild(el("div", "carousel-no-dial", summary.problem === null ? "Drawing…" : "Cannot be opened"));
        const name = el("div", "carousel-name", summary.name);
        const date = el("div", "carousel-date muted", new Date(summary.savedAt).toLocaleString());
        element.append(art, name, date);
        if (summary.problem !== null) element.appendChild(el("div", "carousel-badge issue-error", summary.problem));
      }
      ring.appendChild(element);
      cards.push({ summary, element, art });
    });
    // Start with the open design, if it is on the carousel, in front; otherwise the first design; otherwise the first place.
    const openIndex = places.findIndex((p) => p !== null && p.id === store.movement.id);
    const firstFilled = places.findIndex((p) => p !== null);
    state = { angle: angleForIndex(Math.max(0, openIndex >= 0 ? openIndex : firstFilled), cards.length), velocity: 0 };
    layoutRing();
    paint();
    fillPortraits(loadToken);
  };

  // --- leaving -------------------------------------------------------------------------------------
  function shut(chose: boolean): void {
    if (!isOpen) return;
    isOpen = false;
    expanding = false;
    cancelAnimationFrame(frame);
    root.hidden = true;
    root.classList.remove("expanding");
    loadToken += 1;
    ring.replaceChildren();
    cards = [];
    hooks.appRoot.inert = false;
    hooks.resumeViewport();
    const wasEntering = entering;
    entering = false;
    hooks.left({ chose, entering: wasEntering });
  }

  /** The chosen card grows to fill the window while every other card fades away, then the editor appears. */
  const choose = (card: Card, commit: () => void): void => {
    if (expanding) return;
    expanding = true;
    root.classList.add("expanding");
    card.element.classList.add("chosen");
    const grow = Math.max(window.innerWidth / Math.max(1, card.element.offsetWidth), window.innerHeight / Math.max(1, card.element.offsetHeight)) * 1.15;
    card.element.style.setProperty("--grow", String(grow));
    const finish = (): void => { commit(); shut(true); };
    if (reduced()) finish();
    else window.setTimeout(finish, EXPAND_MILLISECONDS);
  };

  const openCard = (card: Card): void => {
    if (expanding) return;
    const summary = card.summary;
    if (summary === null) {
      // An empty place: start a new project, and the editor appears.
      choose(card, () => { hooks.startNewProject(); });
      return;
    }
    if (summary.problem !== null) {
      hooks.notify(`“${summary.name}” cannot be opened: ${summary.problem}`, "error");
      return;
    }
    choose(card, () => {
      const opened = openProject(storage, summary.id);
      if (!opened.ok) {
        hooks.notify(`Could not open “${summary.name}”: ${opened.reason}`, "error");
        return;
      }
      store.load(opened.value);
      hooks.notify(`Opened “${summary.name}”. Undo (Ctrl+Z) brings back the previous design.`, "info");
    });
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
      // The locked card in front opens (or starts a new project); any other card turns to the front first.
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
      const card = cardAt(at);
      if (card !== undefined && isLocked(state, cards.length)) openCard(card);
    }
  });
  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !expanding) { event.stopPropagation(); shut(false); }
  });
  exitButton.addEventListener("click", () => { if (!expanding) shut(false); });
  window.addEventListener("resize", () => { if (isOpen) { layoutRing(); paint(); } });

  return {
    open(options) {
      if (isOpen) return;
      isOpen = true;
      expanding = false;
      entering = options?.entering === true;
      root.hidden = false;
      hooks.appRoot.inert = true;
      hooks.suspendViewport();
      build();
      last = performance.now();
      frame = requestAnimationFrame(tick);
      stage.focus({ preventScroll: true });
    },
    close() { shut(false); },
    get isOpen() { return isOpen; },
  };
}
