import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

// The edge tabs of the flyout panels must always be on the visible screen, on the side their panel slides in from.
test.use({ layout: "default" });

interface Box { left: number; top: number; right: number; bottom: number }
const tabBoxes = (page: Page): Promise<Record<string, Box>> => page.evaluate<Record<string, Box>>(`(() => {
  const out = {};
  for (const tab of document.querySelectorAll(".flyout-tab")) {
    const r = tab.getBoundingClientRect();
    out[tab.dataset.testid || tab.textContent.trim().slice(0, 12)] = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  }
  return out;
})()`);

async function expectTabsOnScreen(page: Page, width: number, height: number): Promise<void> {
  expect(await page.evaluate<number[]>(`[innerWidth, innerHeight, document.documentElement.scrollWidth, document.documentElement.scrollHeight]`), "the layout viewport is the screen").toEqual([width, height, width, height]);
  const boxes = await tabBoxes(page);
  const named = (prefix: string): Box => {
    const key = Object.keys(boxes).find((k) => k.startsWith(prefix));
    const box = key === undefined ? undefined : boxes[key];
    if (box === undefined) throw new Error(`no ${prefix} tab`);
    return box;
  };
  const onScreen = (box: Box): void => {
    expect(box.left).toBeGreaterThanOrEqual(-2);
    expect(box.right).toBeLessThanOrEqual(width + 2);
    expect(box.top).toBeGreaterThanOrEqual(0);
    expect(box.bottom).toBeLessThanOrEqual(height + 1);
  };
  // Components hugs the left edge, Inspector and Colours the right, Validation the bottom.
  const components = named("flyout-tab-tree");
  const inspector = named("flyout-tab-inspector");
  const colours = named("flyout-tab-colours");
  const validation = named("flyout-tab-console");
  for (const box of [components, inspector, colours, validation]) onScreen(box);
  expect(components.left).toBeLessThanOrEqual(2);
  expect(inspector.right).toBeGreaterThanOrEqual(width - 2);
  expect(colours.right).toBeGreaterThanOrEqual(width - 2);
  expect(validation.bottom).toBeGreaterThanOrEqual(height - 2);
}

test("on a laptop window every edge tab hugs its own edge, also in focus view", async ({ app }) => {
  await app.setViewportSize({ width: 1280, height: 720 });
  await app.waitForTimeout(300);
  await expectTabsOnScreen(app, 1280, 720);
  await app.getByTestId("focus-view").click();
  await expectTabsOnScreen(app, 1280, 720);
});

test("on a phone every edge tab is on the visible screen (the page does not grow past it)", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto("/?splash=off&start=plain");
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload();
  await expect(page.locator("canvas")).toBeVisible();
  await expectTabsOnScreen(page, 390, 844);
  // And on its side.
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(300);
  await expectTabsOnScreen(page, 844, 390);
  await context.close();
});

test("pinch-zoomed in (Android's desktop mode) the tabs stay on the visible screen's edges and zoom with the page, as the rest of the UI does (follow-up 58)", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 980, height: 600 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto("/?splash=off&start=plain");
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload();
  await expect(page.locator("canvas")).toBeVisible();
  const read = (): Promise<{ vv: { left: number; top: number; width: number; height: number; scale: number }; tabs: Record<string, Box> }> => page.evaluate(`(() => {
    const vv = window.visualViewport;
    const tabs = {};
    for (const tab of document.querySelectorAll(".flyout-tab")) {
      const r = tab.getBoundingClientRect();
      tabs[tab.dataset.testid] = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    }
    return { vv: { left: vv.offsetLeft, top: vv.offsetTop, width: vv.width, height: vv.height, scale: vv.scale }, tabs };
  })()`);
  const flat = await read();
  const session = await context.newCDPSession(page);
  await session.send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 });
  await expect.poll(async () => (await read()).vv.scale).toBeCloseTo(2, 1);
  await page.waitForTimeout(400);
  const zoomed = await read();
  expect(zoomed.vv.width).toBeLessThan(flat.vv.width * 0.6);
  for (const [id, box] of Object.entries(zoomed.tabs)) {
    // Inside the part of the page the screen shows, as the layout (not zoomed) coordinates of the page say.
    expect(box.left, id).toBeGreaterThanOrEqual(zoomed.vv.left - 2);
    expect(box.right, id).toBeLessThanOrEqual(zoomed.vv.left + zoomed.vv.width + 2);
    expect(box.top, id).toBeGreaterThanOrEqual(zoomed.vv.top - 2);
    expect(box.bottom, id).toBeLessThanOrEqual(zoomed.vv.top + zoomed.vv.height + 2);
    // Part of the page, so the same size on the page as unzoomed and therefore twice as big on the screen at twice the zoom.
    const before = flat.tabs[id];
    expect(box.right - box.left, id).toBeCloseTo(before.right - before.left, -1);
    expect((box.right - box.left) * zoomed.vv.scale, id).toBeGreaterThan((before.right - before.left) * 1.7);
  }
  // Each still hugs its own side of what is visible.
  expect(zoomed.tabs["flyout-tab-inspector"].right).toBeGreaterThanOrEqual(zoomed.vv.left + zoomed.vv.width - 2);
  expect(zoomed.tabs["flyout-tab-console"].bottom).toBeGreaterThanOrEqual(zoomed.vv.top + zoomed.vv.height - 2);
  await context.close();
});

test("pinch-zoomed in, a finger drag on a panel's title bar or tab moves the screen, and the 3D view keeps its own touch handling so a pinch over the movement zooms only the movement (follow-up 55, 57)", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 980, height: 600 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto("/?splash=off&start=plain");
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload();
  await expect(page.locator("canvas")).toBeVisible();
  const session = await context.newCDPSession(page);
  const offset = (): Promise<{ x: number; y: number; scale: number }> => page.evaluate(`({ x: Math.round(visualViewport.offsetLeft), y: Math.round(visualViewport.offsetTop), scale: visualViewport.scale })`);
  const touch = (type: "touchStart" | "touchMove" | "touchEnd", x: number, y: number): Promise<unknown> =>
    session.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
  /** A finger drag of (dx, dy) from (x, y), in 15 moves. */
  const drag = async (x: number, y: number, dx: number, dy: number): Promise<void> => {
    await touch("touchStart", x, y);
    for (let i = 1; i <= 15; i += 1) {
      await touch("touchMove", x + (dx * i) / 15, y + (dy * i) / 15);
      await page.waitForTimeout(16);
    }
    await touch("touchEnd", x + dx, y + dy);
    await page.waitForTimeout(500);
  };
  const zoom = async (factor: number): Promise<void> => {
    await session.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 });
    await page.waitForTimeout(200);
    await session.send("Emulation.setPageScaleFactor", { pageScaleFactor: factor });
    await expect.poll(async () => (await offset()).scale).toBeCloseTo(factor, 1);
    await page.waitForTimeout(300);
  };
  const canvasTouchAction = (): Promise<string> => page.evaluate<string>(`getComputedStyle(document.querySelector(".viewport canvas")).touchAction`);

  // Unzoomed and zoomed in alike, the 3D view takes the touches itself: a pinch over it zooms the movement, not the page.
  expect(await canvasTouchAction()).toBe("none");
  await zoom(2);
  await expect(page.locator("html")).toHaveClass(/vv-zoomed/);
  expect(await canvasTouchAction()).toBe("none");

  // The open panel: its title bar and its tab pan the zoomed screen, up and down and sideways.
  await page.getByTestId("flyout-tab-inspector").click();
  await expect(page.locator(".panel-frame-inspector[data-open='true']")).toBeVisible();
  await page.waitForTimeout(500);
  const spots = await page.evaluate<{ bar: [number, number]; tab: [number, number] }>(`(() => {
    const v = visualViewport;
    const mid = (e) => { const b = e.getBoundingClientRect(); return [Math.round((b.left + b.right) / 2 - v.offsetLeft), Math.round((b.top + b.bottom) / 2 - v.offsetTop)]; };
    return { bar: mid(document.querySelector(".panel-frame-inspector .panel-titlebar")), tab: mid(document.querySelector('[data-testid="flyout-tab-inspector"]')) };
  })()`);
  const beforeBar = await offset();
  await drag(spots.bar[0], spots.bar[1], 0, -100);
  expect((await offset()).y, "a drag up on the title bar moved the screen").toBeGreaterThan(beforeBar.y + 30);
  await zoom(2);
  if (!(await page.locator(".panel-frame-inspector[data-open='true']").isVisible())) await page.getByTestId("flyout-tab-inspector").click();
  await page.waitForTimeout(500);
  const beforeTab = await offset();
  await drag(spots.tab[0], spots.tab[1], 0, -100);
  expect((await offset()).y, "a drag up on the tab moved the screen").toBeGreaterThan(beforeTab.y + 30);
  await context.close();
});
