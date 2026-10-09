import { expect, test } from "./fixtures";

// driver.js (tutorialBanner.ts) draws the popover as #driver-popover-content / .driver-popover,
// and applies .driver-active-element to whatever it is currently spotlighting. "Exit tutorial"
// and "Skip this step"/"Done" are the popover's own close/next buttons, set via closeBtnLabel
// (the close button's accessible name, not its visible "×") and nextBtnText respectively.

test("the guided tutorial highlights each next step and advances as the design changes", async ({ app }) => {
  await app.getByRole("button", { name: "Tutorial…", exact: true }).click();
  const popover = app.locator(".driver-popover");
  await expect(popover).toBeVisible();
  // The teaching movement is already loaded, so the first step asks for an empty one.
  await expect(popover).toContainText("Start from nothing");
  await expect(app.locator('[data-testid="new-design"]')).toHaveClass(/driver-active-element/);

  await app.locator('[data-testid="new-design"]').selectOption("empty");
  await expect(popover).toContainText("Add the mainplate");
  await expect(app.locator('[data-tutorial="add-mainplate"]')).toHaveClass(/driver-active-element/);

  await app.locator('[data-tutorial="add-mainplate"]').click();
  await expect(popover).toContainText("Add the train bridge");
  await expect(app.locator('[data-tutorial="add-bridge"]')).toHaveClass(/driver-active-element/);

  await app.getByRole("button", { name: "Exit tutorial", exact: true }).click();
  await expect(popover).toBeHidden();
});

test("adding an arbor and a gear during the tutorial preloads real teaching-movement values, and meshing reselects the right gear", async ({ app }) => {
  await app.getByRole("button", { name: "Tutorial…", exact: true }).click();
  const popover = app.locator(".driver-popover");
  await app.locator('[data-testid="new-design"]').selectOption("empty");
  await app.locator('[data-tutorial="add-mainplate"]').click();
  await app.locator('[data-tutorial="add-bridge"]').click();

  await expect(popover).toContainText("Add the barrel");
  await app.locator('[data-tutorial="add-arbor"]').click();
  await expect(app.locator('.inspector [data-field="Name"]')).toHaveValue("Barrel");

  await expect(popover).toContainText("barrel its drum");
  await app.locator('[data-tutorial="add-gear"]').click();
  await expect(app.locator('.inspector [data-field="Name"]')).toHaveValue("Barrel drum");
  await expect(app.locator('.inspector [data-field="Tooth count"]')).toHaveValue("72");
  await expect(app.locator('.inspector [data-field="Module (mm)"]')).toHaveValue("0.12");

  await app.locator('[data-tutorial="add-arbor"]').click(); // Centre arbor
  await app.locator('[data-tutorial="add-gear"]').click(); // Centre pinion

  // Meshing needs the driving gear (Barrel drum) selected, so adding the pinion immediately
  // advances to the mesh step and reselects Barrel drum, rather than leaving Centre pinion selected.
  await expect(popover).toContainText("Mesh the barrel drum with the centre pinion");
  await expect(app.locator('.inspector [data-field="Name"]')).toHaveValue("Barrel drum");
  await expect(app.locator('[data-field="Mesh with"]')).toHaveClass(/driver-active-element/);
  await app.locator('[data-field="Mesh with"]').selectOption({ label: "Centre pinion (Centre arbor)" });
  await expect(popover).toContainText("Add the centre wheel");
});

test("Skip this step moves on regardless of whether the design satisfies the current step", async ({ app }) => {
  await app.getByRole("button", { name: "Tutorial…", exact: true }).click();
  const popover = app.locator(".driver-popover");
  await expect(popover).toContainText("Start from nothing");
  await app.getByRole("button", { name: "Skip this step", exact: true }).click();
  await expect(popover).toContainText("Add the mainplate");
});

test("narration toggle appears only while the tutorial is active, and mutes/unmutes on click", async ({ app }) => {
  const toggle = app.getByRole("button", { name: /Narration (on|off)/ });
  await expect(toggle).toBeHidden();

  await app.getByRole("button", { name: "Tutorial…", exact: true }).click();
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveText("🔊 Narration on");

  await toggle.click();
  await expect(toggle).toHaveText("🔇 Narration off");

  await app.getByRole("button", { name: "Exit tutorial", exact: true }).click();
  await expect(toggle).toBeHidden();
});
