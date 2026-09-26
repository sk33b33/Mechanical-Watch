import type { AppStore } from "@/app/store";
import type { Viewport } from "./viewport";

/** Section offsets offered by the slider, in metres (display only). */
const SECTION_OFFSET_RANGE_METRES = 0.02;

function slider(min: number, max: number, step: number, value: number, title: string): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "range";
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  input.title = title;
  return input;
}

function labelled(text: string, ...children: HTMLElement[]): HTMLLabelElement {
  const label = document.createElement("label");
  label.className = "viewport-control";
  label.append(text, ...children);
  return label;
}

/**
 * Workspace view controls: measure mode, exploded view, dial visibility
 * and section view. These change only what is drawn, never the design,
 * validation or measurements.
 */
export function mountViewportControls(container: HTMLElement, viewport: Viewport, store: AppStore): void {
  const bar = document.createElement("div");
  bar.className = "viewport-tools";

  const measure = document.createElement("button");
  measure.type = "button";
  measure.title = "Pick two parts to measure between them. Values come from the design model.";
  measure.addEventListener("click", () => {
    store.setMeasuring(!store.measuring);
  });

  const explode = slider(0, 1, 0.01, 0, "Spread parts apart along the shaft axes. Display only.");
  explode.addEventListener("input", () => {
    viewport.setExplode(Number(explode.value));
  });

  const sectionOn = document.createElement("input");
  sectionOn.type = "checkbox";
  sectionOn.title = "Cut the view with a vertical plane. Display only.";
  const angle = slider(0, 180, 1, 0, "Section plane direction (degrees from +X)");
  const offset = slider(-SECTION_OFFSET_RANGE_METRES, SECTION_OFFSET_RANGE_METRES, 0.0001, 0, "Section plane position");
  const through = document.createElement("button");
  through.type = "button";
  through.textContent = "Through selection";
  through.title = "Move the section plane onto the selected part's axis";
  const applySection = (): void => {
    viewport.setSection({ enabled: sectionOn.checked, angleDeg: Number(angle.value), offsetMetres: Number(offset.value) });
  };
  for (const el of [sectionOn, angle, offset]) el.addEventListener("input", applySection);
  through.addEventListener("click", () => {
    sectionOn.checked = true;
    applySection();
    const value = viewport.offsetThroughSelection();
    if (value === null) return;
    offset.value = String(value);
    applySection();
  });

  const dialOn = document.createElement("input");
  dialOn.type = "checkbox";
  dialOn.checked = true;
  dialOn.title = "Show the dial. It hides the motion works when seen from the dial side. Display only.";
  dialOn.addEventListener("input", () => {
    viewport.setDialVisible(dialOn.checked);
  });

  const note = document.createElement("span");
  note.className = "viewport-note";
  note.textContent = "View only";
  note.title = "Exploded and section views never change the design, validation or measurements.";

  bar.append(
    measure,
    labelled("Explode", explode),
    labelled("Dial", dialOn),
    labelled("Section", sectionOn),
    labelled("Angle", angle),
    labelled("Offset", offset),
    through,
    note,
  );
  container.appendChild(bar);

  const refresh = (): void => {
    measure.textContent = store.measuring ? "Stop measuring" : "Measure";
    measure.classList.toggle("active", store.measuring);
    through.disabled = store.selectedId === null;
  };
  refresh();
  store.subscribe(refresh);
}
