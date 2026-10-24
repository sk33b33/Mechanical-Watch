import { expect, test } from "./fixtures";

// The teaching movement's date wheel sits at x = -6 mm, y = 0.8 mm and the month wheel at (-6, -5) mm. In the dial
// view the dial is centred in the viewport, east (screen right) is -X, and the view fits the dial's 28 mm with a
// margin, so a millimetre is about the viewport's height / (28 × 1.12) pixels.
async function wheelPixel(app: import("@playwright/test").Page, xMm: number, yMm: number): Promise<{ x: number; y: number; perMm: number }> {
  const box = await app.locator("canvas").first().boundingBox();
  if (box === null) throw new Error("no canvas");
  const perMm = Math.min(box.height, box.width) / (28 * 1.12);
  return { x: box.x + box.width / 2 - xMm * perMm, y: box.y + box.height / 2 - yMm * perMm, perMm };
}

test("Move wheels: dragging a calendar wheel by its window moves it with its window, one undoable step (ASM-0087)", async ({ app }) => {
  test.setTimeout(180_000);
  await app.getByTestId("move-wheels").click();
  await expect(app.getByTestId("move-wheels")).toHaveText("Stop moving wheels");
  const at = await wheelPixel(app, -6, 0.8);
  await app.mouse.move(at.x, at.y);
  await app.mouse.down();
  await app.mouse.move(at.x + 2 * at.perMm, at.y, { steps: 4 });
  await app.mouse.move(at.x + 4 * at.perMm, at.y + at.perMm, { steps: 4 });
  await app.mouse.up();
  await expect(app.getByRole("button", { name: "Undo", exact: true })).toBeEnabled();
  // The date star arbor moved about 4 mm toward screen-right (-X): x went from -6 mm to about -10 mm.
  await app.locator(".tree-item", { hasText: /^Date star/ }).first().click();
  const x = Number(await app.locator('.field:has(label:text-is("X (mm)")) input').inputValue());
  expect(x).toBeLessThan(-8.5);
  expect(x).toBeGreaterThan(-11.5);
  // Undo puts it back as one step.
  await app.getByRole("button", { name: "Undo", exact: true }).click();
  await app.locator(".tree-item", { hasText: /^Date star/ }).first().click();
  expect(Number(await app.locator('.field:has(label:text-is("X (mm)")) input').inputValue())).toBeCloseTo(-6, 3);
});

test("Fix chain: a tidy design has nothing to fix; two overlapping wheels are listed, and applying pushes them apart (ASM-0087)", async ({ app }) => {
  test.setTimeout(180_000);
  await app.getByTestId("fix-chain").click();
  await expect(app.getByTestId("fix-chain-empty")).toBeVisible();
  await app.getByRole("button", { name: "Close", exact: true }).click();

  // Drag the date wheel down on top of the month wheel.
  await app.getByTestId("move-wheels").click();
  const at = await wheelPixel(app, -6, 0.8);
  await app.mouse.move(at.x, at.y);
  await app.mouse.down();
  await app.mouse.move(at.x, at.y + 3 * at.perMm, { steps: 3 });
  await app.mouse.move(at.x, at.y + 5.8 * at.perMm, { steps: 3 });
  await app.mouse.up();

  await app.getByTestId("fix-chain").click();
  const list = app.getByTestId("fix-chain-changes");
  await expect(list).toContainText("Date");
  await expect(list).toContainText("away from Month");
  await app.getByTestId("fix-chain-apply").click();
  await expect(app.locator(".fix-chain-dialog")).not.toBeVisible();

  // Tidy now: nothing left to fix.
  await app.getByTestId("fix-chain").click();
  await expect(app.getByTestId("fix-chain-empty")).toBeVisible();
});

test("a saved layout set to open at startup is what opens next time, and unsetting returns to the teaching movement (follow-up 36)", async ({ app }) => {
  test.setTimeout(180_000);
  // Name the design so it can be told apart, save it, and mark it to open at startup.
  await app.locator('.field:has(label:text-is("Name")) input').first().fill("My dial layout");
  await app.locator('.field:has(label:text-is("Name")) input').first().press("Enter");
  await app.getByRole("button", { name: "Projects…" }).click();
  await app.getByRole("button", { name: "Save current design" }).click();
  await app.getByTestId("startup-on").click();
  await expect(app.locator("dialog[open]")).toContainText("★ My dial layout");
  await app.locator("dialog[open]").getByRole("button", { name: "Close", exact: true }).click();

  // A fresh start (no start=plain) opens it, and says so.
  await app.goto("/?splash=off");
  await expect(app.locator(".header-title")).toContainText("My dial layout");
  await expect(app.getByTestId("toolbar-notice")).toContainText("your startup layout");

  // Stop opening it at startup: the teaching movement is back.
  await app.getByRole("button", { name: "Projects…" }).click();
  await app.getByTestId("startup-off").click();
  await app.locator("dialog[open]").getByRole("button", { name: "Close", exact: true }).click();
  await app.goto("/?splash=off");
  await expect(app.locator(".header-title")).toContainText("Teaching movement");
  await expect(app.locator(".header-title")).not.toContainText("My dial layout");
});
