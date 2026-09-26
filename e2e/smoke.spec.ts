import { expect, test } from "./fixtures";

test("the teaching movement loads, validates and runs", async ({ app }) => {
  await expect(app.locator(".console")).toContainText("No errors against the declared level (L2 Kinematic)");
  await expect(app.locator(".tree-item", { hasText: /^Keyless works/ })).toBeVisible();
  await expect(app.locator(".tree-item", { hasText: /^Dial$/ })).toBeVisible();
  // The simulation is running: simulated time advances.
  const t0 = await app.getByTestId("sim-clock").innerText();
  await expect.poll(async () => app.getByTestId("sim-clock").innerText()).not.toBe(t0);
});

test("selecting a gear shows its derived pitch diameter", async ({ app }) => {
  await app.locator(".tree-item", { hasText: /^Centre wheel/ }).first().click();
  await expect(app.locator(".inspector")).toContainText("9.6000 mm"); // d = m z = 0.12 × 80
});

test("an invalid edit is reported, and undo restores the design", async ({ app }) => {
  await app.locator(".tree-item", { hasText: /^Centre wheel/ }).first().click();
  const teeth = app.locator('.inspector [data-field="Tooth count"]');
  await teeth.fill("0");
  await teeth.press("Tab");
  await expect(app.locator(".console")).toContainText("GEAR-001");
  // The Ctrl+Z shortcut is left to text fields while one has focus, so use the toolbar button.
  await app.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(app.locator(".console")).toContainText("No errors against the declared level");
});

test("the design survives a reload through autosave", async ({ app }) => {
  const name = app.locator('.inspector [data-field="Name"]');
  await name.fill("Autosave check");
  await name.press("Tab");
  await app.reload();
  await expect(app.locator('.inspector [data-field="Name"]')).toHaveValue("Autosave check");
});
