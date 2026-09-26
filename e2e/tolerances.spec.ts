import { readFileSync } from "node:fs";
import { expect, selectTreeItem, test } from "./fixtures";

test("a gear-mesh module tolerance shows its worst-case centre distance in the inspector, and on the downloaded plan (ASM-0027)", async ({ app }) => {
  await selectTreeItem(app, /^Centre wheel/);
  const inspector = app.locator(".inspector");
  await inspector.locator('button[title*="Declare a tolerance"]').first().click();
  await inspector.locator('[data-field="Module: lower dev. (mm)"]').fill("-0.005");
  await inspector.locator('[data-field="Module: lower dev. (mm)"]').press("Tab");
  await inspector.locator('[data-field="Module: upper dev. (mm)"]').fill("0.005");
  await inspector.locator('[data-field="Module: upper dev. (mm)"]').press("Tab");
  // (80 + 10) / 2 teeth × 0.005 mm = 0.225 mm about the 5.400 mm nominal.
  await expect(inspector).toContainText("Centre distance (tol., with Third pinion)");
  await expect(inspector).toContainText("5.1750 mm … 5.6250 mm");
  await expect(app.locator(".console")).toContainText("gear-mesh centre distance");

  await app.getByRole("button", { name: "Outputs…" }).click();
  const row = app.locator(".outputs-table tr", { hasText: "Plan drawing (.svg)" });
  const [download] = await Promise.all([
    app.waitForEvent("download"),
    row.getByRole("button", { name: "Download" }).click(),
  ]);
  const path = await download.path();
  const svg = readFileSync(path, "utf8");
  expect(svg).toMatch(/5\.4000 · tol 5\.17\d*…5\.62\d*/);
});

test("a FIXED shaft gets position tolerances, and its arbor picks them up in a mesh's worst case", async ({ app }) => {
  await selectTreeItem(app, /^Centre arbor/);
  const inspector = app.locator(".inspector");
  await expect(inspector).toContainText("Fixed position X");
  await expect(inspector).toContainText("Fixed position Y");
  await inspector.locator(".list-row", { hasText: "Fixed position X: nominal only" }).getByRole("button", { name: "Add" }).click();
  await inspector.locator('[data-field="Fixed position X: lower dev. (mm)"]').fill("-100");
  await inspector.locator('[data-field="Fixed position X: lower dev. (mm)"]').press("Tab");
  await inspector.locator('[data-field="Fixed position X: upper dev. (mm)"]').fill("100");
  await inspector.locator('[data-field="Fixed position X: upper dev. (mm)"]').press("Tab");
  await expect(app.locator(".console")).toContainText("TOL-002");
  await expect(app.locator(".console")).toContainText("centre distance: nominal 5.0400 mm");
});
