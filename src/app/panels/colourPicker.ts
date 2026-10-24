import type { HexColour } from "@/domain/appearance";
import { hexToHsv, hsvToHex, parseTypedColour, type Hsv } from "@/app/colour/colourMath";

/**
 * The colour chart (follow-up 39, ASM-0090): a square to click and drag (left to right is how vivid, bottom to top
 * how bright), a hue bar, a box to type "#rrggbb" in, and a button back to the built-in colour. Touch and mouse both
 * work (pointer events). While a drag is going `onLive` gets each colour as it moves, between `onStart` and `onEnd`,
 * so the caller can make the whole drag one undoable step; a typed colour, a key press or Reset is a single
 * `onChange`.
 */
export interface ColourPickerHandlers {
  onStart: () => void;
  onLive: (colour: HexColour) => void;
  onEnd: () => void;
  onChange: (colour: HexColour | null) => void;
}

export interface ColourPicker {
  element: HTMLElement;
  /** Shows `colour` (the colour in force), and whether it is the built-in one. */
  show: (colour: HexColour, isBuiltIn: boolean, title: string) => void;
}

const CHART = { width: 224, height: 140 } as const;
/** Arrow keys move the chart marker this far (Shift: ten times). */
const KEY_STEP = 0.01;

export function createColourPicker(handlers: ColourPickerHandlers): ColourPicker {
  const root = document.createElement("div");
  root.className = "colour-picker";
  root.dataset.testid = "colour-picker";

  const heading = document.createElement("div");
  heading.className = "colour-picker-title";

  const chartWrap = document.createElement("div");
  chartWrap.className = "colour-chart-wrap";
  const chart = document.createElement("canvas");
  chart.width = CHART.width;
  chart.height = CHART.height;
  chart.className = "colour-chart";
  chart.tabIndex = 0;
  chart.dataset.testid = "colour-chart";
  chart.setAttribute("role", "slider");
  chart.setAttribute("aria-label", "Colour chart: left to right more vivid, bottom to top brighter");
  const marker = document.createElement("div");
  marker.className = "colour-chart-marker";
  chartWrap.append(chart, marker);

  const hue = document.createElement("input");
  hue.type = "range";
  hue.min = "0";
  hue.max = "360";
  hue.step = "1";
  hue.className = "colour-hue";
  hue.dataset.testid = "colour-hue";
  hue.setAttribute("aria-label", "Hue");

  const row = document.createElement("div");
  row.className = "colour-picker-row";
  const preview = document.createElement("span");
  preview.className = "colour-preview";
  const hex = document.createElement("input");
  hex.type = "text";
  hex.className = "colour-hex";
  hex.maxLength = 7;
  hex.spellcheck = false;
  hex.dataset.testid = "colour-hex";
  hex.setAttribute("aria-label", "Colour as #rrggbb");
  const reset = document.createElement("button");
  reset.type = "button";
  reset.textContent = "Built-in colour";
  reset.dataset.testid = "colour-reset";
  reset.title = "Go back to the colour the app uses when none is chosen";
  row.append(preview, hex, reset);

  root.append(heading, chartWrap, hue, row);

  let current: Hsv = { h: 0, s: 1, v: 1 };
  let dragging = false;

  const paintChart = (): void => {
    const ctx = chart.getContext("2d");
    if (ctx === null) return;
    ctx.fillStyle = hsvToHex({ h: current.h, s: 1, v: 1 });
    ctx.fillRect(0, 0, CHART.width, CHART.height);
    const white = ctx.createLinearGradient(0, 0, CHART.width, 0);
    white.addColorStop(0, "rgba(255,255,255,1)");
    white.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = white;
    ctx.fillRect(0, 0, CHART.width, CHART.height);
    const black = ctx.createLinearGradient(0, 0, 0, CHART.height);
    black.addColorStop(0, "rgba(0,0,0,0)");
    black.addColorStop(1, "rgba(0,0,0,1)");
    ctx.fillStyle = black;
    ctx.fillRect(0, 0, CHART.width, CHART.height);
  };

  const sync = (): void => {
    const colour = hsvToHex(current);
    paintChart();
    marker.style.left = `${String(current.s * 100)}%`;
    marker.style.top = `${String((1 - current.v) * 100)}%`;
    hue.value = String(Math.round(current.h));
    preview.style.background = colour;
    if (document.activeElement !== hex) hex.value = colour;
    hex.classList.remove("invalid");
    chart.setAttribute("aria-valuetext", colour);
  };

  const live = (next: Hsv): void => {
    current = next;
    sync();
    if (dragging) handlers.onLive(hsvToHex(current));
    else handlers.onChange(hsvToHex(current));
  };

  const fromPointer = (event: PointerEvent): Hsv => {
    const rect = chart.getBoundingClientRect();
    const s = Math.min(1, Math.max(0, (event.clientX - rect.left) / Math.max(1, rect.width)));
    const v = 1 - Math.min(1, Math.max(0, (event.clientY - rect.top) / Math.max(1, rect.height)));
    return { h: current.h, s, v };
  };

  const startDrag = (event: PointerEvent, target: HTMLElement): void => {
    dragging = true;
    target.setPointerCapture(event.pointerId);
    handlers.onStart();
  };
  const endDrag = (): void => {
    if (!dragging) return;
    dragging = false;
    handlers.onEnd();
  };

  chart.addEventListener("pointerdown", (event) => {
    startDrag(event, chart);
    live(fromPointer(event));
  });
  chart.addEventListener("pointermove", (event) => { if (dragging) live(fromPointer(event)); });
  chart.addEventListener("pointerup", endDrag);
  chart.addEventListener("pointercancel", endDrag);
  chart.addEventListener("keydown", (event) => {
    const step = event.shiftKey ? KEY_STEP * 10 : KEY_STEP;
    const moves: Record<string, Partial<Hsv>> = {
      ArrowLeft: { s: current.s - step }, ArrowRight: { s: current.s + step }, ArrowUp: { v: current.v + step }, ArrowDown: { v: current.v - step },
    };
    const move = moves[event.key];
    if (move === undefined) return;
    event.preventDefault();
    live({ ...current, s: Math.min(1, Math.max(0, move.s ?? current.s)), v: Math.min(1, Math.max(0, move.v ?? current.v)) });
  });

  hue.addEventListener("pointerdown", () => { dragging = true; handlers.onStart(); });
  hue.addEventListener("input", () => { live({ ...current, h: Number(hue.value) }); });
  hue.addEventListener("change", endDrag);
  hue.addEventListener("pointerup", endDrag);

  const commitTyped = (): void => {
    const typed = parseTypedColour(hex.value);
    if (typed === null) {
      hex.classList.add("invalid");
      return;
    }
    current = hexToHsv(typed);
    sync();
    handlers.onChange(typed);
  };
  hex.addEventListener("change", commitTyped);
  hex.addEventListener("keydown", (event) => { if (event.key === "Enter") commitTyped(); });
  reset.addEventListener("click", () => { handlers.onChange(null); });

  return {
    element: root,
    show(colour, isBuiltIn, title) {
      heading.textContent = title;
      current = hexToHsv(colour);
      reset.disabled = isBuiltIn;
      sync();
    },
  };
}
