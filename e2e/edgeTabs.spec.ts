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

test("pinch-zoomed in (Android's desktop mode) the tabs stay on the visible screen's edges, at the same size on the screen", async ({ browser }) => {
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
    // The same size on the screen as unzoomed: half the page size at twice the zoom.
    const before = flat.tabs[id];
    expect((box.right - box.left) * zoomed.vv.scale, id).toBeCloseTo(before.right - before.left, -1);
  }
  // Each still hugs its own side of what is visible.
  expect(zoomed.tabs["flyout-tab-inspector"].right).toBeGreaterThanOrEqual(zoomed.vv.left + zoomed.vv.width - 2);
  expect(zoomed.tabs["flyout-tab-console"].bottom).toBeGreaterThanOrEqual(zoomed.vv.top + zoomed.vv.height - 2);
  await context.close();
});
