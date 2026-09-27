import { expect, test } from "./fixtures";

test("the guided tutorial highlights each next step and advances as the design changes", async ({ app }) => {
  await app.getByRole("button", { name: "Tutorial…", exact: true }).click();
  const banner = app.locator(".tutorial-banner");
  await expect(banner).toBeVisible();
  // The teaching movement is already loaded, so the first step asks for an empty one.
  await expect(banner).toContainText("Start from nothing");
  await expect(app.locator('[data-testid="new-design"]')).toHaveClass(/tutorial-target/);

  await app.locator('[data-testid="new-design"]').selectOption("empty");
  await expect(banner).toContainText("Add the mainplate");
  await expect(app.locator('[data-tutorial="add-mainplate"]')).toHaveClass(/tutorial-target/);

  await app.locator('[data-tutorial="add-mainplate"]').click();
  await expect(banner).toContainText("Add the train bridge");
  await expect(app.locator('[data-tutorial="add-bridge"]')).toHaveClass(/tutorial-target/);

  await app.getByRole("button", { name: "Exit tutorial", exact: true }).click();
  await expect(banner).toBeHidden();
});

test("adding an arbor and a gear during the tutorial preloads real teaching-movement values, and meshing reselects the right gear", async ({ app }) => {
  await app.getByRole("button", { name: "Tutorial…", exact: true }).click();
  const banner = app.locator(".tutorial-banner");
  await app.locator('[data-testid="new-design"]').selectOption("empty");
  await app.locator('[data-tutorial="add-mainplate"]').click();
  await app.locator('[data-tutorial="add-bridge"]').click();

  await expect(banner).toContainText("Add the barrel");
  await app.locator('[data-tutorial="add-arbor"]').click();
  await expect(app.locator('.inspector [data-field="Name"]')).toHaveValue("Barrel");

  await expect(banner).toContainText("barrel its drum");
  await app.locator('[data-tutorial="add-gear"]').click();
  await expect(app.locator('.inspector [data-field="Name"]')).toHaveValue("Barrel drum");
  await expect(app.locator('.inspector [data-field="Tooth count"]')).toHaveValue("72");
  await expect(app.locator('.inspector [data-field="Module (mm)"]')).toHaveValue("0.12");

  await app.locator('[data-tutorial="add-arbor"]').click(); // Centre arbor
  await app.locator('[data-tutorial="add-gear"]').click(); // Centre pinion

  // Meshing needs the driving gear (Barrel drum) selected, so adding the pinion immediately
  // advances to the mesh step and reselects Barrel drum, rather than leaving Centre pinion selected.
  await expect(banner).toContainText("Mesh the barrel drum with the centre pinion");
  await expect(app.locator('.inspector [data-field="Name"]')).toHaveValue("Barrel drum");
  await expect(app.locator('[data-field="Mesh with"]')).toHaveClass(/tutorial-target/);
  await app.locator('[data-field="Mesh with"]').selectOption({ label: "Centre pinion (Centre arbor)" });
  await expect(banner).toContainText("Add the centre wheel");
});

test("Skip this step moves on regardless of whether the design satisfies the current step", async ({ app }) => {
  await app.getByRole("button", { name: "Tutorial…", exact: true }).click();
  const banner = app.locator(".tutorial-banner");
  await expect(banner).toContainText("Start from nothing");
  await app.getByRole("button", { name: "Skip this step", exact: true }).click();
  await expect(banner).toContainText("Add the mainplate");
});
