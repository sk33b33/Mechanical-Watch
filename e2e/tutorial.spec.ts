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
  await expect(banner).toContainText("Add a bridge");
  await expect(app.locator('[data-tutorial="add-bridge"]')).toHaveClass(/tutorial-target/);

  await app.getByRole("button", { name: "Exit tutorial", exact: true }).click();
  await expect(banner).toBeHidden();
});

test("Skip this step moves on regardless of whether the design satisfies the current step", async ({ app }) => {
  await app.getByRole("button", { name: "Tutorial…", exact: true }).click();
  const banner = app.locator(".tutorial-banner");
  await expect(banner).toContainText("Start from nothing");
  await app.getByRole("button", { name: "Skip this step", exact: true }).click();
  await expect(banner).toContainText("Add the mainplate");
});
