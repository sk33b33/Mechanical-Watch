import { expect, selectTreeItem, test } from "./fixtures";

test("the toolbar shows the spring's state of wind and the reserve left", async ({ app }) => {
  // Fully wound at start: 6.5 turns, and 39 h at the balance-governed rate (a hair over 39 h).
  await expect(app.getByTestId("reserve")).toHaveText(/^Spring 6\.\d\d turns · 39\.0 h left$/);
});

test("the barrel arbor carries the mainspring data and its power reserve", async ({ app }) => {
  await selectTreeItem(app, /^Barrel arbor/);
  const inspector = app.locator(".inspector");
  await expect(inspector).toContainText("SIMPLIFIED ENERGY MODEL (L3)");
  await expect(inspector.locator('[data-field="Usable turns"]')).toHaveValue("6.5");
  await expect(inspector).toContainText("39.0 h");
});

test("pallet geometry: the teaching pallets meet the locking points; a whole-tooth span is refused", async ({ app }) => {
  await selectTreeItem(app, /^Escapement/);
  const inspector = app.locator(".inspector");
  // 2.3 mm tip radius, 3.5 of 15 teeth = 84°: 2.3 / cos 42° mm.
  await expect(inspector).toContainText("3.0950 mm");
  await expect(app.locator(".console")).not.toContainText("ESC-104");
  const span = inspector.locator('[data-field="Span (teeth)"]');
  await span.fill("3");
  await span.press("Tab");
  await expect(app.locator(".console")).toContainText("ESC-104");
});

test("the amplitude is predicted only once Q and the escapement efficiency are entered", async ({ app }) => {
  await selectTreeItem(app, /^Escapement/);
  const inspector = app.locator(".inspector");
  await expect(inspector).toContainText("needs escapement efficiency, balance quality factor Q");
  const eta = inspector.locator('[data-field="Escapement efficiency (0–1)"]');
  await eta.fill("0.35");
  await eta.press("Tab");
  const q = app.locator('.inspector [data-field="Balance quality factor Q"]');
  await q.fill("250");
  await q.press("Tab");
  await expect(app.locator(".inspector")).toContainText(/Predicted amplitude \(full → let down\)\s*\d+\.\d° → \d+\.\d°/);
  await expect(app.locator(".console")).toContainText("SPR-002");
});
