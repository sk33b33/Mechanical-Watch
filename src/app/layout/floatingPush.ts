/**
 * Where a floating control (the tick button, bottom right) goes when a flyout slides out (follow-up 44): the
 * flyout pushes it along its own direction of travel, just far enough to clear its inner edge, and it springs
 * back to rest when the flyout slides away. Pure screen geometry; nothing in the movement reads it.
 */
export type FlyoutEdge = "left" | "right" | "bottom";

/** A flyout that is out: the edge it comes from and how far it reaches in (px), measured along its travel. */
export interface OpenFlyout {
  edge: FlyoutEdge;
  size: number;
}

/** The control's resting box, as insets from the window's right and bottom edges plus its size (px). */
export interface RestingBox {
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export const FLOATING_PUSH = {
  /** Space left between the flyout's edge and the control it has pushed. */
  gapPx: 10,
  /** A control pushed off by a flyout from the far side always keeps this much on screen, so it can be found again. */
  minVisiblePx: 16,
} as const;

/**
 * How far to translate the control from its resting place (px, +x right, +y down) so that no open flyout
 * covers it. A flyout only pushes a control it would overlap. A flyout from the right pushes it left, from
 * the bottom up, from the left right (it only ever reaches a button at the right edge on a narrow window).
 */
export function pushOffset(box: RestingBox, viewport: { w: number; h: number }, open: readonly OpenFlyout[]): { x: number; y: number } {
  const gap = FLOATING_PUSH.gapPx;
  const left = viewport.w - box.right - box.width;
  const right = viewport.w - box.right;
  const top = viewport.h - box.bottom - box.height;
  const bottom = viewport.h - box.bottom;
  let x = 0;
  let y = 0;
  for (const flyout of open) {
    if (!(flyout.size > 0)) continue;
    if (flyout.edge === "right") {
      const limit = viewport.w - flyout.size - gap;
      if (right > limit) x = Math.min(x, limit - right);
    } else if (flyout.edge === "left") {
      const limit = flyout.size + gap;
      if (left < limit) x = Math.max(x, limit - left);
    } else {
      const limit = viewport.h - flyout.size - gap;
      if (bottom > limit) y = Math.min(y, limit - bottom);
    }
  }
  // Pushed towards the right edge (by a left flyout), keep a sliver on screen.
  const farthestRight = viewport.w - FLOATING_PUSH.minVisiblePx - left;
  if (x > farthestRight) x = Math.max(0, farthestRight);
  // Pushed above the window or off the left by a very large flyout: stay inside it.
  if (top + y < 0) y = -top;
  if (left + x < 0) x = -left;
  return { x, y };
}
