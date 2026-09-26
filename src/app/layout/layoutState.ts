/**
 * Workspace layout: where each side panel lives. UI state only; it is
 * never part of a design and never affects the domain model.
 *
 * - DOCKED: in its column or row of the workspace grid.
 * - FLOATING: a movable, resizable window over the viewport.
 * - WINDOW: its own browser window (for a second screen). Not restored
 *   after a reload, since browsers only open windows on a user action.
 * - HIDDEN: hidden; reopened from the header.
 *
 * Focus view hides every docked panel so the viewport fills the window;
 * floating and separate windows stay open.
 */

export const PANEL_IDS = ["tree", "inspector", "console"] as const;
export type PanelId = (typeof PANEL_IDS)[number];

export type PanelMode = "DOCKED" | "FLOATING" | "WINDOW" | "HIDDEN";
/** The modes a hidden panel can reopen to. */
export type VisibleMode = "DOCKED" | "FLOATING";

/** A floating window's position and size in CSS pixels, relative to the browser window. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PanelState {
  mode: PanelMode;
  /** What reopening a hidden panel restores. */
  lastVisible: VisibleMode;
  /** Floating position; null until the panel has floated (a default is then used). */
  rect: Rect | null;
  /** Docked width (side columns) or height (validation row) the user has dragged it to, in CSS px. */
  dockedSize: number;
}

export interface LayoutState {
  panels: Record<PanelId, PanelState>;
  focus: boolean;
}

/** Docked track sizes (CSS px). UI choices, not engineering values. */
export const DEFAULT_DOCKED_SIZE: Record<PanelId, number> = { tree: 260, inspector: 320, console: 200 };
/** Smallest a docked panel can be dragged to while staying usable. */
export const MIN_DOCKED_SIZE: Record<PanelId, number> = { tree: 160, inspector: 220, console: 80 };
/** Resizing a docked panel never shrinks the movement view below this. */
export const MIN_VIEWPORT = { w: 320, h: 200 };
/** Header and toolbar rows above the viewport (must match the grid rows in style.css). */
export const WORKSPACE_CHROME_HEIGHT = 40 + 36;
/** Arrow keys on a resize handle move it this far (Shift: ×4). */
export const KEYBOARD_RESIZE_STEP = 16;

/** Floating windows keep at least this much of their title bar on screen, so they can always be dragged back. */
export const MIN_VISIBLE_TITLE = 80;
export const TITLE_BAR_HEIGHT = 28;
export const MIN_FLOATING_SIZE = { w: 200, h: 120 };

export const PANEL_TITLES: Record<PanelId, string> = { tree: "Components", inspector: "Inspector", console: "Validation" };

export function defaultLayout(): LayoutState {
  const docked = (id: PanelId): PanelState => ({ mode: "DOCKED", lastVisible: "DOCKED", rect: null, dockedSize: DEFAULT_DOCKED_SIZE[id] });
  return { panels: { tree: docked("tree"), inspector: docked("inspector"), console: docked("console") }, focus: false };
}

/** The mode the panel is actually shown in: focus view hides docked panels. */
export function effectiveMode(state: LayoutState, id: PanelId): PanelMode {
  const mode = state.panels[id].mode;
  return state.focus && mode === "DOCKED" ? "HIDDEN" : mode;
}

export function isShown(state: LayoutState, id: PanelId): boolean {
  return effectiveMode(state, id) !== "HIDDEN";
}

export function withMode(state: LayoutState, id: PanelId, mode: PanelMode): LayoutState {
  const panel = state.panels[id];
  const lastVisible: VisibleMode = mode === "DOCKED" || mode === "FLOATING" ? mode : panel.lastVisible;
  // Docking a panel while in focus view would leave it hidden, so docking ends focus view.
  const focus = mode === "DOCKED" ? false : state.focus;
  return { focus, panels: { ...state.panels, [id]: { ...panel, mode, lastVisible } } };
}

/**
 * The header's panel button: hide a shown panel, or reopen a hidden one
 * where it was. In focus view a panel reopens floating, so the movement
 * keeps the whole viewport.
 */
export function togglePanel(state: LayoutState, id: PanelId): LayoutState {
  if (isShown(state, id)) return withMode(state, id, "HIDDEN");
  const reopen: VisibleMode = state.focus ? "FLOATING" : state.panels[id].lastVisible;
  return withMode(state, id, reopen);
}

/** Leaving focus view brings docked panels back; panels closed by hand stay closed. */
export function toggleFocus(state: LayoutState): LayoutState {
  return { ...state, focus: !state.focus };
}

export function withRect(state: LayoutState, id: PanelId, rect: Rect): LayoutState {
  return { ...state, panels: { ...state.panels, [id]: { ...state.panels[id], rect } } };
}

interface Bounds {
  w: number;
  h: number;
}

/**
 * Grid track sizes for the docked panels that are shown. Given the window
 * size, panels give way (in proportion, down to their minimum) so the
 * movement view keeps at least MIN_VIEWPORT; the sizes the user chose are
 * kept and come back when the window grows again.
 */
export function dockedTracks(state: LayoutState, bounds?: Bounds): Record<PanelId, number> {
  const size = (id: PanelId): number => (effectiveMode(state, id) === "DOCKED" ? state.panels[id].dockedSize : 0);
  let tree = size("tree");
  let inspector = size("inspector");
  let console = size("console");
  if (bounds !== undefined) {
    // Each side column gives up space in proportion to how far it is above its minimum.
    const excess = tree + inspector - (bounds.w - MIN_VIEWPORT.w);
    if (excess > 0) {
      const spareTree = tree === 0 ? 0 : Math.max(0, tree - MIN_DOCKED_SIZE.tree);
      const spareInspector = inspector === 0 ? 0 : Math.max(0, inspector - MIN_DOCKED_SIZE.inspector);
      const spare = spareTree + spareInspector;
      // If even the minimums don't fit, the panels stay at their minimum (the window is too small).
      const give = spare === 0 ? 0 : Math.min(1, excess / spare);
      tree = tree === 0 ? 0 : Math.floor(tree - spareTree * give);
      inspector = inspector === 0 ? 0 : Math.floor(inspector - spareInspector * give);
    }
    const rows = bounds.h - WORKSPACE_CHROME_HEIGHT - MIN_VIEWPORT.h;
    if (console > rows) console = Math.max(MIN_DOCKED_SIZE.console, Math.floor(rows));
  }
  return { tree, inspector, console };
}

/** The largest a docked panel may be dragged to, leaving the movement view MIN_VIEWPORT beside the other docked panels. */
export function maxDockedSize(state: LayoutState, id: PanelId, bounds: Bounds): number {
  const tracks = dockedTracks(state, bounds);
  const limit = id === "console"
    ? bounds.h - WORKSPACE_CHROME_HEIGHT - MIN_VIEWPORT.h
    : bounds.w - MIN_VIEWPORT.w - (id === "tree" ? tracks.inspector : tracks.tree);
  return Math.max(MIN_DOCKED_SIZE[id], Math.floor(limit));
}

/** Sets a docked panel's size, kept between its minimum and what leaves the movement view room. */
export function withDockedSize(state: LayoutState, id: PanelId, size: number, bounds: Bounds): LayoutState {
  const wanted = Number.isFinite(size) ? size : DEFAULT_DOCKED_SIZE[id];
  const dockedSize = Math.round(Math.min(maxDockedSize(state, id, bounds), Math.max(MIN_DOCKED_SIZE[id], wanted)));
  return { ...state, panels: { ...state.panels, [id]: { ...state.panels[id], dockedSize } } };
}

/** Where a panel floats the first time: beside the movement rather than over its centre. */
export function defaultRect(id: PanelId, bounds: { w: number; h: number }): Rect {
  // Below the header, toolbar and the viewport's own tool rows, so the view buttons stay reachable.
  const top = 128;
  switch (id) {
    case "tree":
      return clampRect({ x: 12, y: top, w: 260, h: Math.min(520, bounds.h - top - 24) }, bounds);
    case "inspector":
      return clampRect({ x: bounds.w - 352, y: top, w: 340, h: Math.min(600, bounds.h - top - 24) }, bounds);
    case "console":
      return clampRect({ x: 290, y: bounds.h - 250, w: Math.min(680, bounds.w - 320), h: 230 }, bounds);
  }
}

/** Keeps a floating window reachable: its title bar stays within the browser window. */
export function clampRect(rect: Rect, bounds: { w: number; h: number }): Rect {
  const w = Math.max(MIN_FLOATING_SIZE.w, Math.min(rect.w, bounds.w));
  const h = Math.max(MIN_FLOATING_SIZE.h, Math.min(rect.h, bounds.h));
  const x = Math.min(Math.max(rect.x, MIN_VISIBLE_TITLE - w), bounds.w - MIN_VISIBLE_TITLE);
  const y = Math.min(Math.max(rect.y, 0), bounds.h - TITLE_BAR_HEIGHT);
  return { x, y, w, h };
}

export const LAYOUT_STORAGE_KEY = "mw3d.layout";

export function serializeLayout(state: LayoutState): string {
  return JSON.stringify(state);
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseRect(value: unknown): Rect | null {
  if (typeof value !== "object" || value === null) return null;
  const r = value as Record<string, unknown>;
  return finite(r.x) && finite(r.y) && finite(r.w) && finite(r.h) ? { x: r.x, y: r.y, w: r.w, h: r.h } : null;
}

/**
 * Reads a saved layout, field by field. Anything unreadable falls back to
 * the default for that field; a separate window reopens where it last
 * was in the page.
 */
export function parseLayout(text: string | null): LayoutState {
  const layout = defaultLayout();
  if (text === null) return layout;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return layout;
  }
  if (typeof raw !== "object" || raw === null) return layout;
  const saved = raw as { panels?: unknown; focus?: unknown };
  const panels = typeof saved.panels === "object" && saved.panels !== null ? (saved.panels as Record<string, unknown>) : {};
  for (const id of PANEL_IDS) {
    const p = panels[id];
    if (typeof p !== "object" || p === null) continue;
    const { mode, lastVisible, rect, dockedSize } = p as Record<string, unknown>;
    const visible: VisibleMode = lastVisible === "FLOATING" ? "FLOATING" : "DOCKED";
    const restored: PanelMode = mode === "FLOATING" || mode === "HIDDEN" || mode === "DOCKED" ? mode : visible;
    // Clamped to the window when applied; here only nonsense is rejected.
    const size = finite(dockedSize) && dockedSize >= MIN_DOCKED_SIZE[id] ? dockedSize : DEFAULT_DOCKED_SIZE[id];
    layout.panels[id] = { mode: restored, lastVisible: visible, rect: parseRect(rect), dockedSize: size };
  }
  layout.focus = saved.focus === true;
  return layout;
}
