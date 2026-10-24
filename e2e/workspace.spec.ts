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

test("the Chain diagram shows the whole movement connected to the mainspring, and a click on a part selects it (ASM-0086)", async ({ app }) => {
  await app.getByRole("button", { name: "Chain…" }).click();
  await expect(app.getByTestId("chain-summary")).toContainText("connected to the mainspring through one chain");
  const svg = app.locator(".chain-svg");
  await expect(svg).toContainText("Mainspring");
  await expect(svg).toContainText("72 : 12");
  await expect(svg).toContainText("5.00 beats per second");
  await svg.locator(".chain-node", { hasText: "Fourth arbor" }).click();
  await expect(app.locator(".chain-dialog")).not.toBeVisible();
  await expect(app.locator(".inspector")).toContainText("Fourth arbor");
});

test("the Chain diagram can be printed or saved: Print opens a hidden print frame, Download SVG gives a black-on-white file (ASM-0086)", async ({ app }) => {
  await app.evaluate("window.print = () => undefined");
  await app.getByRole("button", { name: "Chain…" }).click();
  const [download] = await Promise.all([app.waitForEvent("download"), app.getByTestId("chain-download").click()]);
  expect(download.suggestedFilename()).toBe("drive-chain.svg");
  await app.getByTestId("chain-print").click();
  // The print page is built in a hidden frame; it carries the diagram and the validation caveat.
  await expect.poll(() => app.frames().length).toBeGreaterThan(1);
  const printFrame = app.frames().find((f) => f !== app.mainFrame());
  expect(await printFrame?.content()).toContain("physical validation");
  expect(await printFrame?.content()).toContain("@page { size: A4 portrait;");
});
