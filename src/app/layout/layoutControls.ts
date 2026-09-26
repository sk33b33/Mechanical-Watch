import { effectiveMode, isShown, PANEL_IDS, PANEL_TITLES, type PanelId, type PanelMode } from "./layoutState";
import type { PanelLayout } from "./panelWindows";

const WHERE: Record<PanelMode, string> = {
  DOCKED: "docked",
  FLOATING: "floating over the movement",
  WINDOW: "in its own window",
  HIDDEN: "hidden",
};

/** Header buttons: show or hide each panel, and the focus view that gives the movement the whole viewport. */
export function mountLayoutControls(container: HTMLElement, layout: PanelLayout): void {
  container.className = "layout-controls";
  const buttons = new Map<PanelId, HTMLButtonElement>();
  for (const id of PANEL_IDS) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = PANEL_TITLES[id];
    button.dataset.testid = `toggle-${id}`;
    button.addEventListener("click", () => { layout.toggle(id); });
    buttons.set(id, button);
    container.appendChild(button);
  }
  const focus = document.createElement("button");
  focus.type = "button";
  focus.dataset.testid = "focus-view";
  focus.addEventListener("click", () => { layout.toggleFocus(); });
  container.appendChild(focus);

  const render = (): void => {
    const state = layout.layout;
    for (const [id, button] of buttons) {
      const shown = isShown(state, id);
      button.classList.toggle("active", shown);
      button.setAttribute("aria-pressed", String(shown));
      button.title = `${PANEL_TITLES[id]}: ${WHERE[effectiveMode(state, id)]}. Click to ${shown ? "hide" : state.focus ? "open floating" : "reopen"}.`;
    }
    focus.textContent = state.focus ? "Exit focus" : "Focus";
    focus.classList.toggle("active", state.focus);
    focus.setAttribute("aria-pressed", String(state.focus));
    focus.title = state.focus
      ? "Bring the docked panels back"
      : "Hide the docked panels so the movement fills the window. Floating and separate windows stay open; panels opened now float.";
  };
  render();
  layout.onChange(render);
}
