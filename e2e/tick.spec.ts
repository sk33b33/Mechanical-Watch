import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

// The software renderer draws a large viewport slowly; keep the window small and run one at a time.
test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 1100, height: 720 } });

const toggle = (page: Page) => page.getByTestId("tick-toggle");

test("the second-hand Tick switch floats in the bottom right corner, is on by default, and its choice survives a reload (ASM-0084)", async ({ app }) => {
  await expect(toggle(app)).toHaveText("Tick: on");
  const box = await toggle(app).boundingBox();
  if (box === null) throw new Error("no tick button");
  expect(box.x + box.width).toBeGreaterThan(1100 - 30);
  expect(box.y + box.height).toBeGreaterThan(720 - 30);
  await toggle(app).click();
  await expect(toggle(app)).toHaveText("Tick: off");
  await app.reload();
  await expect(toggle(app)).toHaveText("Tick: off");
});

test.describe("flyouts push the floating Tick switch aside and it springs back (follow-up 44)", () => {
  test.use({ layout: "default" });

  const place = async (page: Page): Promise<{ x: number; y: number; right: number; bottom: number }> => {
    const box = await toggle(page).boundingBox();
    if (box === null) throw new Error("no tick button");
    return { x: box.x, y: box.y, right: box.x + box.width, bottom: box.y + box.height };
  };

  test("a flyout from the right pushes it left of the panel, and closing the flyout brings it home", async ({ app }) => {
    const home = await place(app);
    await app.getByTestId("flyout-tab-inspector").click();
    const panel = app.locator(".panel-frame-inspector");
    await expect(panel).toBeVisible();
    await expect.poll(async () => (await place(app)).right).toBeLessThan((await panel.boundingBox())?.x ?? 0);
    expect((await place(app)).bottom).toBeCloseTo(home.bottom, 0);
    await expect(toggle(app)).toHaveAttribute("data-pushed", "true");
    // The panel never covers it, and it is still pressable.
    await toggle(app).click();
    await expect(toggle(app)).toHaveText("Tick: off");
    await app.getByTestId("flyout-tab-inspector").click();
    await expect(panel).toBeHidden();
    await expect.poll(async () => (await place(app)).right).toBeCloseTo(home.right, 0);
    await expect(toggle(app)).toHaveAttribute("data-pushed", "false");
  });

  test("a flyout from the bottom pushes it up, the Colours flyout from the right pushes it left too", async ({ app }) => {
    const home = await place(app);
    await app.getByTestId("flyout-tab-console").click();
    const panel = app.locator(".panel-frame-console");
    await expect(panel).toBeVisible();
    await expect.poll(async () => (await place(app)).bottom).toBeLessThan((await panel.boundingBox())?.y ?? 0);
    expect((await place(app)).right).toBeCloseTo(home.right, 0);
    await app.getByTestId("flyout-tab-console").click();
    await expect.poll(async () => (await place(app)).bottom).toBeCloseTo(home.bottom, 0);
    await app.getByTestId("flyout-tab-colours").click();
    const colours = app.locator(".panel-frame-colours");
    await expect(colours).toBeVisible();
    await expect.poll(async () => (await place(app)).right).toBeLessThan((await colours.boundingBox())?.x ?? 0);
    await app.getByTestId("flyout-tab-colours").click();
    await expect.poll(async () => (await place(app)).right).toBeCloseTo(home.right, 0);
  });
});
