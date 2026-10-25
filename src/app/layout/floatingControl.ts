import { FLYOUT_EDGE, PANEL_IDS } from "./layoutState";
import { pushOffset, type OpenFlyout } from "./floatingPush";
import type { PanelLayout } from "./panelWindows";

/** Where the floating control rests (CSS `right` and `bottom`, px); the CSS class and this agree. */
export const FLOATING_REST = { right: 12, bottom: 12 } as const;

/**
 * Mounts a control floating in the bottom right corner of the window (follow-up 44). When a flyout panel
 * slides out the control is pushed along the flyout's direction of travel just far enough to clear it, and it
 * springs back to rest (an overshooting ease, see `.floating-control`) when the flyout slides away. The flyouts
 * are read from the DOM as they are drawn (`data-open`, their size), so any panel that becomes a flyout does the same.
 */
export function mountFloatingControl(control: HTMLElement, host: HTMLElement, layout: PanelLayout): void {
  control.classList.add("floating-control");
  host.appendChild(control);

  const openFlyouts = (): OpenFlyout[] => {
    const open: OpenFlyout[] = [];
    for (const frame of document.querySelectorAll<HTMLElement>('.panel-frame[data-mode="FLYOUT"][data-open="true"]')) {
      const id = PANEL_IDS.find((panelId) => frame.classList.contains(`panel-frame-${panelId}`));
      if (id === undefined) continue;
      const edge = FLYOUT_EDGE[id];
      open.push({ edge, size: edge === "bottom" ? frame.offsetHeight : frame.offsetWidth });
    }
    return open;
  };

  const place = (): void => {
    const { x, y } = pushOffset(
      { ...FLOATING_REST, width: control.offsetWidth, height: control.offsetHeight },
      { w: window.innerWidth, h: window.innerHeight },
      openFlyouts(),
    );
    control.style.transform = x === 0 && y === 0 ? "" : `translate(${String(Math.round(x))}px, ${String(Math.round(y))}px)`;
    control.dataset.pushed = String(x !== 0 || y !== 0);
  };

  layout.onChange(place);
  window.addEventListener("resize", place);
  place();
}
