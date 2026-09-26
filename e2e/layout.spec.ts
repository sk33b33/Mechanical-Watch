import { expect, selectTreeItem, test } from "./fixtures";
import type { Page } from "@playwright/test";

// These tests enlarge the viewport, which the software renderer used in CI draws slowly; run them
// one at a time, at a smaller window, so they don't starve each other's pages.
test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 1100, height: 720 } });

const frame = (page: Page, id: string) => page.locator(`.panel-frame-${id}`);
const canvasWidth = async (page: Page): Promise<number> => (await page.locator(".viewport canvas").boundingBox())?.width ?? 0;

test("focus view gives the movement the whole window, and brings the panels back", async ({ app }) => {
  const docked = await canvasWidth(app);
  await app.getByTestId("focus-view").click();
  for (const id of ["tree", "inspector", "console"]) await expect(frame(app, id)).toBeHidden();
  await expect.poll(() => canvasWidth(app)).toBeGreaterThan(docked + 400);
  // The simulation readouts live on the viewport, so they stay visible.
  await expect(app.getByTestId("sim-clock")).toBeVisible();
  await expect(app.getByTestId("reserve")).toBeVisible();
  await app.getByTestId("focus-view").click();
  for (const id of ["tree", "inspector", "console"]) await expect(frame(app, id)).toBeVisible();
});

test("in focus view a panel opens floating over the movement and can be dragged", async ({ app }) => {
  await app.getByTestId("focus-view").click();
  await app.getByTestId("toggle-inspector").click();
  const inspector = frame(app, "inspector");
  await expect(inspector).toHaveAttribute("data-mode", "FLOATING");
  const before = await inspector.boundingBox();
  const bar = inspector.locator(".panel-titlebar");
  const box = await bar.boundingBox();
  if (before === null || box === null) throw new Error("no inspector");
  await app.mouse.move(box.x + 40, box.y + box.height / 2);
  await app.mouse.down();
  await app.mouse.move(box.x - 260, box.y + 120, { steps: 6 });
  await app.mouse.up();
  const after = await inspector.boundingBox();
  expect(after?.x).toBeCloseTo(before.x - 300, 0);
  expect(after?.y).toBeCloseTo(before.y + 120 - box.height / 2, 0);
  // It is still the live inspector.
  await app.getByTestId("toggle-tree").click();
  await selectTreeItem(app, /^Escapement/);
  await expect(app.locator(".inspector")).toContainText("SIMPLIFIED ESCAPEMENT MODEL");
});

test("a panel pops out into its own window, stays live, and docks back when that window closes", async ({ app }) => {
  const [popup] = await Promise.all([
    app.context().waitForEvent("page"),
    frame(app, "inspector").locator('[data-action="window"]').click(),
  ]);
  await expect(popup.locator(".inspector")).toBeVisible();
  await expect(frame(app, "inspector")).toHaveCount(0);
  // Selecting in the main window updates the inspector in the separate one.
  await selectTreeItem(app, /^Escapement/);
  await expect(popup.locator(".inspector")).toContainText("SIMPLIFIED ESCAPEMENT MODEL");
  // Editing in the separate window changes the design everywhere.
  const amplitude = popup.locator('.inspector [data-field="Amplitude (°)"]');
  await amplitude.fill("20");
  await amplitude.press("Tab");
  await expect(app.locator(".console")).toContainText("never leave the escapement");
  await popup.close();
  await expect(frame(app, "inspector")).toHaveAttribute("data-mode", "DOCKED");
  await expect(app.locator(".inspector")).toContainText("SIMPLIFIED ESCAPEMENT MODEL");
});

test("hiding a panel and reopening it from the header; the layout is remembered", async ({ app }) => {
  await frame(app, "console").locator('[data-action="hide"]').click();
  await expect(frame(app, "console")).toBeHidden();
  await expect(app.getByTestId("toggle-console")).toHaveAttribute("aria-pressed", "false");
  await frame(app, "tree").locator('[data-action="float"]').click();
  await expect(frame(app, "tree")).toHaveAttribute("data-mode", "FLOATING");
  await app.waitForTimeout(400); // the layout is saved shortly after a change
  await app.reload();
  await expect(frame(app, "console")).toBeHidden();
  await expect(frame(app, "tree")).toHaveAttribute("data-mode", "FLOATING");
  await app.getByTestId("toggle-console").click();
  await expect(frame(app, "console")).toHaveAttribute("data-mode", "DOCKED");
  await expect(app.locator(".console")).toContainText("No errors against the declared level");
});

test("docked panels resize by dragging their inner edge, by keyboard, and reset on double-click", async ({ app }) => {
  const handle = frame(app, "inspector").locator(".panel-resizer");
  await expect(handle).toHaveAttribute("aria-valuenow", "320");
  const docked = await canvasWidth(app);
  const box = await handle.boundingBox();
  if (box === null) throw new Error("no resize handle");
  await app.mouse.move(box.x + box.width / 2, box.y + 200);
  await app.mouse.down();
  await app.mouse.move(box.x + box.width / 2 - 120, box.y + 200, { steps: 6 });
  await app.mouse.up();
  await expect(handle).toHaveAttribute("aria-valuenow", "440");
  await expect.poll(() => canvasWidth(app)).toBeCloseTo(docked - 120, -1);

  // Keyboard: the tree's handle moves its edge the way the arrow points.
  const treeHandle = frame(app, "tree").locator(".panel-resizer");
  await treeHandle.focus();
  await app.keyboard.press("ArrowRight");
  await expect(treeHandle).toHaveAttribute("aria-valuenow", "276");
  await app.keyboard.press("Home");
  await expect(treeHandle).toHaveAttribute("aria-valuenow", "160");

  // The movement view keeps its minimum however far a panel is dragged.
  const consoleHandle = frame(app, "console").locator(".panel-resizer");
  const c = await consoleHandle.boundingBox();
  if (c === null) throw new Error("no console handle");
  await app.mouse.move(c.x + 200, c.y + c.height / 2);
  await app.mouse.down();
  await app.mouse.move(c.x + 200, 0, { steps: 6 });
  await app.mouse.up();
  await expect.poll(async () => (await app.locator(".viewport").boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(199);

  await app.waitForTimeout(400); // the layout is saved shortly after a change
  await app.reload();
  await expect(frame(app, "inspector").locator(".panel-resizer")).toHaveAttribute("aria-valuenow", "440");
  await frame(app, "inspector").locator(".panel-resizer").dblclick();
  await expect(frame(app, "inspector").locator(".panel-resizer")).toHaveAttribute("aria-valuenow", "320");
});
