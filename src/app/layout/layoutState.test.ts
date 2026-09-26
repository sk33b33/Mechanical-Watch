import { describe, expect, it } from "vitest";
import {
  clampRect,
  defaultLayout,
  defaultRect,
  dockedTracks,
  effectiveMode,
  DEFAULT_DOCKED_SIZE,
  maxDockedSize,
  MIN_DOCKED_SIZE,
  MIN_VIEWPORT,
  MIN_VISIBLE_TITLE,
  WORKSPACE_CHROME_HEIGHT,
  withDockedSize,
  PANEL_IDS,
  parseLayout,
  serializeLayout,
  TITLE_BAR_HEIGHT,
  toggleFocus,
  togglePanel,
  withMode,
  withRect,
} from "./layoutState";

describe("workspace layout state", () => {
  it("starts with every panel docked at its usual size", () => {
    expect(dockedTracks(defaultLayout())).toEqual({ tree: 260, inspector: 320, console: 200 });
  });

  it("a floating, separate-window or hidden panel gives its docked space to the viewport", () => {
    let s = withMode(defaultLayout(), "tree", "FLOATING");
    s = withMode(s, "inspector", "WINDOW");
    s = withMode(s, "console", "HIDDEN");
    expect(dockedTracks(s)).toEqual({ tree: 0, inspector: 0, console: 0 });
  });

  it("focus view hides only docked panels, and leaving it brings them back", () => {
    const floating = withMode(defaultLayout(), "inspector", "FLOATING");
    const focused = toggleFocus(floating);
    expect(effectiveMode(focused, "tree")).toBe("HIDDEN");
    expect(effectiveMode(focused, "inspector")).toBe("FLOATING");
    expect(dockedTracks(focused)).toEqual({ tree: 0, inspector: 0, console: 0 });
    expect(effectiveMode(toggleFocus(focused), "tree")).toBe("DOCKED");
  });

  it("in focus view a panel reopens floating, so the movement keeps the viewport", () => {
    const s = togglePanel(toggleFocus(defaultLayout()), "inspector");
    expect(s.focus).toBe(true);
    expect(effectiveMode(s, "inspector")).toBe("FLOATING");
    expect(effectiveMode(s, "tree")).toBe("HIDDEN");
  });

  it("toggling hides a shown panel and reopens it where it last was", () => {
    const floating = withMode(defaultLayout(), "console", "FLOATING");
    const hidden = togglePanel(floating, "console");
    expect(effectiveMode(hidden, "console")).toBe("HIDDEN");
    expect(effectiveMode(togglePanel(hidden, "console"), "console")).toBe("FLOATING");
    // A panel closed from its own window reopens docked or floating, never as a window.
    const fromWindow = withMode(withMode(defaultLayout(), "tree", "WINDOW"), "tree", "HIDDEN");
    expect(effectiveMode(togglePanel(fromWindow, "tree"), "tree")).toBe("DOCKED");
  });

  it("docking a panel ends focus view rather than leaving it hidden", () => {
    const s = withMode(toggleFocus(defaultLayout()), "tree", "DOCKED");
    expect(s.focus).toBe(false);
    expect(effectiveMode(s, "tree")).toBe("DOCKED");
  });

  it("property: a clamped floating window always keeps its title bar reachable", () => {
    let seed = 11;
    const next = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let i = 0; i < 500; i += 1) {
      const bounds = { w: 400 + next() * 2000, h: 300 + next() * 1200 };
      const r = clampRect({ x: (next() - 0.5) * 6000, y: (next() - 0.5) * 6000, w: next() * 3000, h: next() * 3000 }, bounds);
      expect(r.x + r.w).toBeGreaterThanOrEqual(MIN_VISIBLE_TITLE - 1e-9);
      expect(r.x).toBeLessThanOrEqual(bounds.w - MIN_VISIBLE_TITLE + 1e-9);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeLessThanOrEqual(bounds.h - TITLE_BAR_HEIGHT + 1e-9);
    }
  });

  it("default floating positions lie within the window", () => {
    for (const id of PANEL_IDS) {
      const r = defaultRect(id, { w: 1400, h: 900 });
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(1400);
      expect(r.y + r.h).toBeLessThanOrEqual(900);
    }
  });

  it("round-trips through storage; a separate window comes back in the page", () => {
    let s = withRect(withMode(defaultLayout(), "inspector", "FLOATING"), "inspector", { x: 10, y: 20, w: 300, h: 400 });
    s = withMode(s, "console", "WINDOW");
    const back = parseLayout(serializeLayout(s));
    expect(back.panels.inspector).toEqual({ mode: "FLOATING", lastVisible: "FLOATING", rect: { x: 10, y: 20, w: 300, h: 400 }, dockedSize: 320 });
    expect(back.panels.console.mode).toBe("DOCKED");
  });

  it("unreadable saved layouts fall back to the default, field by field", () => {
    expect(parseLayout(null)).toEqual(defaultLayout());
    expect(parseLayout("{not json")).toEqual(defaultLayout());
    expect(parseLayout("42")).toEqual(defaultLayout());
    const partial = parseLayout(JSON.stringify({ panels: { tree: { mode: "SIDEWAYS", rect: { x: "a" } }, inspector: { mode: "HIDDEN" } }, focus: "yes" }));
    expect(partial.panels.tree).toEqual({ mode: "DOCKED", lastVisible: "DOCKED", rect: null, dockedSize: 260 });
    expect(partial.panels.inspector.mode).toBe("HIDDEN");
    expect(partial.focus).toBe(false);
  });

});

describe("resizing docked panels", () => {
  const bounds = { w: 1400, h: 900 };

  it("a dragged size is kept, and survives storage", () => {
    const s = withDockedSize(defaultLayout(), "inspector", 450, bounds);
    expect(dockedTracks(s, bounds).inspector).toBe(450);
    expect(dockedTracks(parseLayout(serializeLayout(s)), bounds).inspector).toBe(450);
  });

  it("stops at each panel's minimum", () => {
    for (const id of PANEL_IDS) {
      expect(dockedTracks(withDockedSize(defaultLayout(), id, 5, bounds), bounds)[id]).toBe(MIN_DOCKED_SIZE[id]);
    }
  });

  it("never takes the movement view below its minimum", () => {
    const wideTree = withDockedSize(defaultLayout(), "tree", 5000, bounds);
    const t = dockedTracks(wideTree, bounds);
    expect(bounds.w - t.tree - t.inspector).toBe(MIN_VIEWPORT.w);
    const tallConsole = dockedTracks(withDockedSize(defaultLayout(), "console", 5000, bounds), bounds);
    expect(bounds.h - WORKSPACE_CHROME_HEIGHT - tallConsole.console).toBe(MIN_VIEWPORT.h);
  });

  it("a hidden neighbour's space is available to drag into", () => {
    const hiddenInspector = withMode(defaultLayout(), "inspector", "HIDDEN");
    expect(maxDockedSize(hiddenInspector, "tree", bounds)).toBe(bounds.w - MIN_VIEWPORT.w);
  });

  it("property: in a shrinking window the panels give way but keep the chosen sizes for later", () => {
    let seed = 7;
    const next = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let i = 0; i < 300; i += 1) {
      let s = withDockedSize(defaultLayout(), "tree", 160 + next() * 800, bounds);
      s = withDockedSize(s, "inspector", 220 + next() * 800, bounds);
      const small = { w: 820 + next() * 600, h: 500 + next() * 400 };
      const t = dockedTracks(s, small);
      expect(t.tree).toBeGreaterThanOrEqual(MIN_DOCKED_SIZE.tree);
      expect(t.inspector).toBeGreaterThanOrEqual(MIN_DOCKED_SIZE.inspector);
      expect(small.w - t.tree - t.inspector).toBeGreaterThanOrEqual(MIN_VIEWPORT.w - 1e-9);
      // Back at full size, the chosen sizes return.
      expect(dockedTracks(s, bounds)).toEqual({ tree: s.panels.tree.dockedSize, inspector: s.panels.inspector.dockedSize, console: DEFAULT_DOCKED_SIZE.console });
    }
  });

  it("unreadable saved sizes fall back to the default", () => {
    const text = JSON.stringify({ panels: { tree: { mode: "DOCKED", dockedSize: -40 }, inspector: { mode: "DOCKED", dockedSize: "wide" } } });
    const s = parseLayout(text);
    expect(s.panels.tree.dockedSize).toBe(DEFAULT_DOCKED_SIZE.tree);
    expect(s.panels.inspector.dockedSize).toBe(DEFAULT_DOCKED_SIZE.inspector);
  });
});
