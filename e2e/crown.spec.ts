import { dialReading, expect, minutesPastTwelve, selectTreeItem, test } from "./fixtures";

test.describe("keyless works", () => {
  test("crown out: turning the crown sets the hands through the setting train", async ({ app }) => {
    const before = minutesPastTwelve(await dialReading(app));
    await app.getByTestId("crown-action").selectOption("SET_FORWARD");
    // The crown turns at 1 rev/s and the teaching setting train gives 2 minute-hand turns per crown turn.
    await expect.poll(async () => minutesPastTwelve(await dialReading(app)) - before, { timeout: 10_000 }).toBeGreaterThanOrEqual(60);
    await selectTreeItem(app, /^Keyless works/);
    await expect(app.locator(".inspector")).toContainText("pulled out (setting)");
  });

  test("crown in: winding is clockwise seen from the crown; the other way slips", async ({ app }) => {
    await selectTreeItem(app, /^Keyless works/);
    await expect(app.locator(".inspector")).toContainText("clockwise seen from the crown");
    await expect(app.locator(".inspector")).toContainText("0.350000 rev");
    await app.getByTestId("crown-action").selectOption("WIND");
    await expect(app.getByTestId("toolbar-notice")).toBeHidden();
    await app.getByTestId("crown-action").selectOption("WIND_REVERSE");
    await expect(app.getByTestId("toolbar-notice")).toContainText("nothing is wound");
  });

  test("a movement without keyless works sets the hands directly", async ({ app }) => {
    await app.getByTestId("new-design").selectOption("demo");
    const options = await app.getByTestId("crown-action").locator("option").allInnerTexts();
    expect(options).toEqual(["Running", "Set hands forward", "Set hands backward"]);
  });

  test("the dial view shows the crown at 3 o'clock and the dial can be hidden", async ({ app }) => {
    await app.getByRole("button", { name: "Dial side" }).click();
    const dialToggle = app.locator(".viewport-control", { hasText: "Dial" }).locator("input");
    await expect(dialToggle).toBeChecked();
    await dialToggle.uncheck();
    await expect(dialToggle).not.toBeChecked();
    await selectTreeItem(app, /^Keyless works/);
    await expect(app.locator(".inspector")).toContainText("3.00 o'clock");
  });
});
