import type { KeyValueStore } from "@/persistence/autosave";
import {
  clampRect,
  defaultRect,
  dockedTracks,
  effectiveMode,
  LAYOUT_STORAGE_KEY,
  PANEL_IDS,
  PANEL_TITLES,
  parseLayout,
  serializeLayout,
  toggleFocus,
  togglePanel,
  withMode,
  withRect,
  type LayoutState,
  type PanelId,
  type PanelMode,
  type Rect,
} from "./layoutState";

/** A side panel's window: its chrome (title bar, controls) and the body a panel renders into. */
export interface PanelWindow {
  id: PanelId;
  frame: HTMLElement;
  body: HTMLDivElement;
  /** Sets the title bar text (e.g. the validation counts). */
  setTitle: (text: string) => void;
}

type Notify = (message: string, kind: "info" | "error") => void;

const CONTROL_LABELS: Record<"dock" | "float" | "window" | "hide", { glyph: string; title: string; name: (panel: string) => string }> = {
  dock: { glyph: "⇲", title: "Dock back into the workspace", name: (p) => `Dock the ${p} panel` },
  float: { glyph: "⧉", title: "Float over the movement (drag the title bar; resize from the corner)", name: (p) => `Float the ${p} panel` },
  window: { glyph: "↗", title: "Open in its own browser window (e.g. on a second screen)", name: (p) => `Open the ${p} panel in its own window` },
  hide: { glyph: "✕", title: "Hide (reopen from the header)", name: (p) => `Hide the ${p} panel` },
};

function readLayout(storage: KeyValueStore | null): LayoutState {
  try {
    return parseLayout(storage?.getItem(LAYOUT_STORAGE_KEY) ?? null);
  } catch {
    return parseLayout(null);
  }
}

/**
 * Owns where the side panels live: docked in the grid, floating over the
 * viewport, in a separate browser window, or closed. Panels keep
 * rendering into their body wherever it is, so a panel in another
 * window stays live. Layout is per-viewer UI state (browser storage,
 * best effort) and never touches the design.
 */
export class PanelLayout {
  private state: LayoutState;
  private readonly windows = new Map<PanelId, PanelWindow>();
  private readonly popups = new Map<PanelId, Window>();
  private readonly listeners = new Set<() => void>();
  private zTop = 30;
  private saveTimer: number | null = null;

  constructor(
    private readonly workspace: HTMLElement,
    private readonly storage: KeyValueStore | null,
    private readonly notify: Notify,
  ) {
    this.state = readLayout(storage);
    // A reload or closed tab would otherwise orphan the separate windows.
    window.addEventListener("pagehide", () => {
      for (const popup of this.popups.values()) popup.close();
    });
    window.addEventListener("resize", () => { this.apply(); });
  }

  get layout(): LayoutState {
    return this.state;
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  /** Creates the window for a panel. `bodyClass` is the panel's own class list (e.g. "panel inspector"). */
  add(id: PanelId, bodyClass: string): PanelWindow {
    const frame = document.createElement("section");
    frame.className = `panel-frame panel-frame-${id}`;
    frame.dataset.panel = id;
    frame.setAttribute("aria-label", PANEL_TITLES[id]);

    const bar = document.createElement("div");
    bar.className = "panel-titlebar";
    const title = document.createElement("span");
    title.className = "panel-title";
    title.textContent = PANEL_TITLES[id];
    const controls = document.createElement("span");
    controls.className = "panel-controls";
    for (const action of ["dock", "float", "window", "hide"] as const) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "panel-control";
      button.dataset.action = action;
      button.textContent = CONTROL_LABELS[action].glyph;
      button.title = CONTROL_LABELS[action].title;
      button.setAttribute("aria-label", CONTROL_LABELS[action].name(PANEL_TITLES[id]));
      button.addEventListener("click", () => {
        const mode: PanelMode = action === "dock" ? "DOCKED" : action === "float" ? "FLOATING" : action === "window" ? "WINDOW" : "HIDDEN";
        this.setMode(id, mode);
      });
      controls.appendChild(button);
    }
    bar.append(title, controls);
    this.enableDrag(id, frame, bar);

    const body = document.createElement("div");
    body.className = bodyClass;
    frame.append(bar, body);
    this.workspace.appendChild(frame);

    // Record a floating window's size after the user resizes it from the corner.
    new ResizeObserver(() => {
      if (effectiveMode(this.state, id) !== "FLOATING" || frame.ownerDocument !== document) return;
      const rect = this.state.panels[id].rect;
      const { offsetWidth: w, offsetHeight: h } = frame;
      if (rect !== null && w > 0 && h > 0 && (rect.w !== w || rect.h !== h)) {
        this.state = withRect(this.state, id, { ...rect, w, h });
        this.save();
      }
    }).observe(frame);
    frame.addEventListener("pointerdown", () => { this.raise(frame); });

    const win: PanelWindow = { id, frame, body, setTitle: (text) => { title.textContent = text; } };
    this.windows.set(id, win);
    this.apply();
    return win;
  }

  setMode(id: PanelId, mode: PanelMode): void {
    if (mode === "WINDOW") {
      this.openPopup(id);
      return;
    }
    this.state = withMode(this.state, id, mode);
    this.commit();
  }

  toggle(id: PanelId): void {
    this.state = togglePanel(this.state, id);
    this.commit();
  }

  toggleFocus(): void {
    this.state = toggleFocus(this.state);
    this.commit();
  }

  private commit(): void {
    this.apply();
    this.save();
    for (const listener of this.listeners) listener();
  }

  /** Makes the DOM match the state: grid tracks, frame placement, popups. */
  private apply(): void {
    const tracks = dockedTracks(this.state);
    this.workspace.style.setProperty("--tree-width", `${String(tracks.tree)}px`);
    this.workspace.style.setProperty("--inspector-width", `${String(tracks.inspector)}px`);
    this.workspace.style.setProperty("--console-height", `${String(tracks.console)}px`);
    this.workspace.classList.toggle("focus-view", this.state.focus);
    const bounds = { w: window.innerWidth, h: window.innerHeight };
    for (const id of PANEL_IDS) {
      const win = this.windows.get(id);
      if (win === undefined) continue;
      const mode = effectiveMode(this.state, id);
      if (mode !== "WINDOW") this.closePopup(id);
      const { frame } = win;
      frame.dataset.mode = mode;
      frame.hidden = mode === "HIDDEN";
      if (mode === "FLOATING") {
        const rect = clampRect(this.state.panels[id].rect ?? defaultRect(id, bounds), bounds);
        this.state = withRect(this.state, id, rect);
        this.place(frame, rect);
      } else if (mode === "DOCKED") {
        frame.style.removeProperty("left");
        frame.style.removeProperty("top");
        frame.style.removeProperty("width");
        frame.style.removeProperty("height");
        frame.style.removeProperty("z-index");
      }
    }
  }

  private place(frame: HTMLElement, rect: Rect): void {
    frame.style.left = `${String(rect.x)}px`;
    frame.style.top = `${String(rect.y)}px`;
    frame.style.width = `${String(rect.w)}px`;
    frame.style.height = `${String(rect.h)}px`;
    if (frame.style.zIndex === "") this.raise(frame);
  }

  private raise(frame: HTMLElement): void {
    if (frame.dataset.mode !== "FLOATING") return;
    this.zTop += 1;
    frame.style.zIndex = String(this.zTop);
  }

  /** Dragging a floating window by its title bar (not by its buttons). */
  private enableDrag(id: PanelId, frame: HTMLElement, bar: HTMLElement): void {
    bar.addEventListener("pointerdown", (event) => {
      if (effectiveMode(this.state, id) !== "FLOATING" || (event.target as HTMLElement).closest("button") !== null) return;
      const start = this.state.panels[id].rect;
      if (start === null) return;
      event.preventDefault();
      bar.setPointerCapture(event.pointerId);
      const origin = { x: event.clientX, y: event.clientY };
      const move = (e: PointerEvent): void => {
        const rect = clampRect({ ...start, x: start.x + e.clientX - origin.x, y: start.y + e.clientY - origin.y }, { w: window.innerWidth, h: window.innerHeight });
        this.state = withRect(this.state, id, rect);
        this.place(frame, rect);
      };
      const end = (): void => {
        bar.removeEventListener("pointermove", move);
        bar.removeEventListener("pointerup", end);
        bar.removeEventListener("pointercancel", end);
        this.save();
      };
      bar.addEventListener("pointermove", move);
      bar.addEventListener("pointerup", end);
      bar.addEventListener("pointercancel", end);
    });
  }

  /**
   * Moves the panel into its own browser window. The window shares this
   * page's origin and styles; the panel keeps rendering into it. Closing
   * the window docks the panel back.
   */
  private openPopup(id: PanelId): void {
    const win = this.windows.get(id);
    if (win === undefined) return;
    if (this.popups.has(id)) {
      this.popups.get(id)?.focus();
      return;
    }
    const size = win.frame.getBoundingClientRect();
    const w = Math.max(360, Math.round(size.width) || 360);
    const h = Math.max(480, Math.round(size.height) || 480);
    const popup = window.open("", `mw3d-panel-${id}`, `popup,width=${String(w)},height=${String(h)}`);
    if (popup === null) {
      this.notify(`The browser blocked the ${PANEL_TITLES[id]} window. Allow pop-ups for this page, or float the panel instead.`, "error");
      this.setMode(id, "FLOATING");
      return;
    }
    const doc = popup.document;
    doc.title = `${PANEL_TITLES[id]} — Mechanical Watchmaker 3D`;
    for (const node of document.head.querySelectorAll('style, link[rel="stylesheet"]')) doc.head.appendChild(node.cloneNode(true));
    doc.documentElement.lang = document.documentElement.lang;
    doc.body.className = "popout-body";
    doc.body.appendChild(win.frame);
    this.popups.set(id, popup);
    // Undo/redo from the separate window act on the design, as they do in the main one.
    popup.addEventListener("keydown", (event) => {
      const target = event.target as HTMLElement | null;
      if (target !== null && ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) return;
      const forwarded = new KeyboardEvent("keydown", { key: event.key, ctrlKey: event.ctrlKey, metaKey: event.metaKey, shiftKey: event.shiftKey, cancelable: true });
      window.dispatchEvent(forwarded);
      if (forwarded.defaultPrevented) event.preventDefault();
    });
    const closed = (): void => { this.popupClosed(id, popup); };
    popup.addEventListener("pagehide", closed);
    // pagehide is not guaranteed for every way a window closes; poll as a backstop.
    const poll = window.setInterval(() => {
      if (popup.closed) {
        window.clearInterval(poll);
        closed();
      }
    }, 500);
    this.state = withMode(this.state, id, "WINDOW");
    this.commit();
  }

  /** The user closed the separate window: bring the panel back where it was. */
  private popupClosed(id: PanelId, popup: Window): void {
    if (this.popups.get(id) !== popup) return;
    this.popups.delete(id);
    this.returnFrame(id);
    if (this.state.panels[id].mode === "WINDOW") {
      this.state = withMode(this.state, id, this.state.panels[id].lastVisible);
      this.commit();
    }
  }

  private closePopup(id: PanelId): void {
    const popup = this.popups.get(id);
    if (popup === undefined) return;
    this.popups.delete(id);
    this.returnFrame(id);
    popup.close();
  }

  private returnFrame(id: PanelId): void {
    const win = this.windows.get(id);
    if (win !== undefined && win.frame.ownerDocument !== document) this.workspace.appendChild(win.frame);
  }

  private save(): void {
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      try {
        this.storage?.setItem(LAYOUT_STORAGE_KEY, serializeLayout(this.state));
      } catch {
        // Layout is a convenience; a full or blocked storage just means it isn't remembered.
      }
    }, 150);
  }
}
