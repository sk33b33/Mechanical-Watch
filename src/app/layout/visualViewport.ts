/**
 * Keeps the flyout panels' edge tabs on the screen's edges whatever the zoom (follow-up 54, ASM-0098). On a phone in
 * desktop mode (or any pinch-zoomed page) the screen shows only part of the page, the "visual viewport": zoomed in, a
 * control fixed to the page's own edges is carried off the screen. The browser reports the visual viewport's size, offset
 * and zoom; this module publishes them as CSS variables on the page root, and the flyout styles use them to put each panel
 * and its tab at the visual viewport's edges and to cancel the zoom, so they stay the same size and at the same place on
 * the screen. Unzoomed (zoom 1, no offset) the variables are the page's own edges and nothing changes. Presentation only.
 */
export interface ViewportBox {
  /** The visual viewport's offset from the layout viewport's top left, in CSS px. */
  readonly offsetLeft: number;
  readonly offsetTop: number;
  /** The visual viewport's size in CSS px (smaller than the layout viewport when zoomed in). */
  readonly width: number;
  readonly height: number;
  /** The pinch zoom (1 unzoomed). */
  readonly scale: number;
  /** The layout viewport's size in CSS px. */
  readonly layoutWidth: number;
  readonly layoutHeight: number;
}

/**
 * The variables for a viewport box. `--vv-s` is the zoom and `--vv-inv` its inverse (the `zoom` that cancels it). The
 * edge distances are stored multiplied by the zoom because they are used inside an element that is itself zoomed by
 * `--vv-inv`: there a length L is drawn as L / zoom layout px, so L = distance * zoom puts the edge where it should be.
 */
export function viewportVariables(box: ViewportBox): Record<string, string> {
  const scale = Number.isFinite(box.scale) && box.scale > 0 ? box.scale : 1;
  const left = Math.max(0, box.offsetLeft);
  const top = Math.max(0, box.offsetTop);
  const right = Math.max(0, box.layoutWidth - box.offsetLeft - box.width);
  const bottom = Math.max(0, box.layoutHeight - box.offsetTop - box.height);
  const px = (value: number): string => `${String(Math.round(value * scale * 1000) / 1000)}px`;
  return {
    "--vv-s": String(scale),
    "--vv-inv": String(1 / scale),
    "--vv-left": px(left),
    "--vv-top": px(top),
    "--vv-right": px(right),
    "--vv-bottom": px(bottom),
  };
}

/** The pinch zoom above which the page counts as zoomed in (a little over 1, so a settling zoom of 1.0x does not flicker). */
export const ZOOMED_IN_ABOVE = 1.05;

/** Whether the page is pinch-zoomed in far enough that a drag should move the screen rather than something on it. */
export function isZoomedIn(scale: number): boolean {
  return Number.isFinite(scale) && scale > ZOOMED_IN_ABOVE;
}

/**
 * Publishes the visual viewport's variables on the page root now and whenever it zooms, pans or the window changes, and
 * marks the root `vv-zoomed` while zoomed in: the stylesheet then lets one-finger drags over the 3D view pan the zoomed
 * screen instead of turning the model (follow-up 55, ASM-0098).
 */
export function installVisualViewportVariables(doc: Document = document, win: Window = window): () => void {
  const vv = win.visualViewport;
  const root = doc.documentElement;
  let pending = false;
  const apply = (): void => {
    pending = false;
    const box: ViewportBox = vv === null
      ? { offsetLeft: 0, offsetTop: 0, width: root.clientWidth, height: root.clientHeight, scale: 1, layoutWidth: root.clientWidth, layoutHeight: root.clientHeight }
      : { offsetLeft: vv.offsetLeft, offsetTop: vv.offsetTop, width: vv.width, height: vv.height, scale: vv.scale, layoutWidth: root.clientWidth, layoutHeight: root.clientHeight };
    for (const [name, value] of Object.entries(viewportVariables(box))) root.style.setProperty(name, value);
    root.classList.toggle("vv-zoomed", isZoomedIn(box.scale));
  };
  const schedule = (): void => {
    if (pending) return;
    pending = true;
    win.requestAnimationFrame(apply);
  };
  apply();
  vv?.addEventListener("resize", schedule);
  vv?.addEventListener("scroll", schedule);
  win.addEventListener("resize", schedule);
  return () => {
    vv?.removeEventListener("resize", schedule);
    vv?.removeEventListener("scroll", schedule);
    win.removeEventListener("resize", schedule);
  };
}
