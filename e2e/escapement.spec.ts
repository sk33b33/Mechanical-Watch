import { expect, selectTreeItem, test } from "./fixtures";

test("the escapement is labelled as simplified; the balance governs and the model predicts the rate", async ({ app }) => {
  await expect(app.locator(".viewport-model-label")).toHaveText("SIMPLIFIED ESCAPEMENT MODEL");
  await selectTreeItem(app, /^Escapement/);
  const inspector = app.locator(".inspector");
  // 10 mg·cm² and 246.7 µN·mm/rad: free frequency just under the 2.5 Hz nominal time needs.
  await expect(inspector).toContainText("2.4998 Hz");
  await expect(inspector).toContainText("2.5000 Hz");
  await expect(inspector).toContainText("-7.0 s/day");
  await expect(inspector).toContainText("17999 beats/h");
  await expect(inspector).toContainText("not modeled; requires physical validation");
  await expect(app.locator(".console")).toContainText("ESC-002");
});

test("an amplitude below half the lift angle is refused as an error", async ({ app }) => {
  await selectTreeItem(app, /^Escapement/);
  const amplitude = app.locator('.inspector [data-field="Amplitude (°)"]');
  await amplitude.fill("20");
  await amplitude.press("Tab");
  await expect(app.locator(".console")).toContainText("never leave the escapement");
});

test("a new escapement starts empty and lists what is missing", async ({ app }) => {
  await app.getByTestId("new-design").selectOption("empty");
  await app.getByRole("button", { name: "+ Escapement" }).click();
  await expect(app.locator(".console")).toContainText("ESC-101");
  await expect(app.locator(".viewport-model-label")).toBeVisible();
});

test("switching the drive to nominal time makes the rate a what-if", async ({ app }) => {
  await app.locator('.inspector [data-field="Drive"]').selectOption("NOMINAL_TIME");
  await selectTreeItem(app, /^Escapement/);
  await expect(app.locator(".inspector")).toContainText("Rate if it governed");
  await expect(app.locator(".inspector")).toContainText("18000 beats/h");
});
