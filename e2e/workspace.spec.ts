import { expect, test } from "./fixtures";

test("measuring two meshed gears gives the ideal centre distance", async ({ app }) => {
  await app.getByRole("button", { name: /Measure/ }).click();
  await app.locator(".tree-item", { hasText: /^Centre wheel/ }).first().click();
  await app.locator(".tree-item", { hasText: /^Third pinion/ }).first().click();
  const panel = app.locator(".measurement-panel");
  await expect(panel).toContainText("Ideal centre distance");
  await expect(panel).toContainText("5.4000 mm"); // 0.12 × (80 + 10) / 2
});

test("zoom to selection is only available with something selected, and moves the camera without errors", async ({ app }) => {
  const zoomButton = app.getByRole("button", { name: "Zoom to selection" });
  await expect(zoomButton).toBeDisabled();
  await app.locator(".tree-item", { hasText: /^Leap year / }).first().click();
  await expect(zoomButton).toBeEnabled();
  await zoomButton.click();
  await expect(app.locator("canvas")).toBeVisible();
});

test("building from empty lists what is missing instead of guessing", async ({ app }) => {
  await app.getByTestId("new-design").selectOption("empty");
  await app.getByRole("button", { name: "+ Keyless works" }).click();
  await app.getByRole("button", { name: "+ Dial" }).click();
  await expect(app.locator(".console")).toContainText("KEY-001");
  await expect(app.locator(".console")).toContainText("DIAL-001");
});
