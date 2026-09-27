import { expect, test } from "./fixtures";

test("saving a gear's values as a preset and applying it to another gear fills that gear's fields", async ({ app }) => {
  // Centre wheel: module 0.12 mm, thickness 0.2 mm. Escape pinion: same module, thickness 0.5 mm —
  // a real change to look for once the preset is applied.
  await app.locator(".tree-item", { hasText: /^Centre wheel/ }).first().click();
  const presetName = app.locator('.inspector input[placeholder="Preset name"]');
  await presetName.fill("Standard train gear");
  await app.getByRole("button", { name: "Save current values as preset", exact: true }).click();
  await expect(app.locator(".inspector")).toContainText("Standard train gear");

  await app.locator(".tree-item", { hasText: /^Escape pinion/ }).first().click();
  await expect(app.locator('.inspector [data-field="Thickness (mm)"]')).toHaveValue("0.5");

  await app.locator(".inspector .list-row", { hasText: "Standard train gear" }).getByRole("button", { name: "Apply", exact: true }).click();
  await expect(app.locator('.inspector [data-field="Thickness (mm)"]')).toHaveValue("0.2");
  await expect(app.locator('.inspector [data-field="Module (mm)"]')).toHaveValue("0.12");

  // The preset survives a reload (it's stored separately from the design).
  await app.reload();
  await app.locator(".tree-item", { hasText: /^Fourth wheel/ }).first().click();
  await app.locator(".inspector .list-row", { hasText: "Standard train gear" }).getByRole("button", { name: "Remove", exact: true }).click();
  await expect(app.locator(".inspector")).not.toContainText("Standard train gear");
});
