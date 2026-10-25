import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

// The software renderer draws a large viewport slowly; keep the window small and run one at a time.
test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 1100, height: 720 } });

const swatchOf = (page: Page, testId: string) => page.getByTestId(testId).locator(".colour-swatch");
/** The swatch's inline style, e.g. "background: rgb(255, 0, 0);" (no DOM lib in e2e, so read the attribute). */
const swatchColour = async (page: Page, testId: string): Promise<string> => (await swatchOf(page, testId).getAttribute("style")) ?? "";

test.describe("Colours flyout (ASM-0090)", () => {
  test.use({ layout: "default" });

  test("the Colours tab opens a flyout with a button for every dial-window wheel (body and text) and each dial item", async ({ app }) => {
    const tab = app.getByTestId("flyout-tab-colours");
    await expect(tab).toBeVisible();
    await expect(app.locator(".panel-frame-colours")).toBeHidden();
    await tab.click();
    await expect(app.locator(".panel-frame-colours")).toBeVisible();
    const rows = app.locator(".colour-row");
    expect(await rows.count()).toBeGreaterThan(6);
    for (const key of ["dial", "hourMarkers", "hourMarkerDigits", "dialPrint", "secondsHand", "minuteHand", "hourHand"]) {
      await expect(app.getByTestId(`colour-dial-${key}`)).toBeVisible();
    }
    await expect(app.locator('[data-testid^="colour-wheel-text-"]').first()).toBeVisible();
    await expect(app.getByTestId("colour-picker")).toBeHidden();
    // The moon wheel's second button is the colour of its moon phases.
    await expect(app.getByTestId("colour-wheel-text-Moon wheel")).toContainText("Moon phases");
    await expect(app.getByTestId("colour-wheel-text-Date")).toContainText("Text");
    // The Seconds hand button sits directly above the Minute hand button.
    const seconds = await app.getByTestId("colour-dial-secondsHand").boundingBox();
    const minute = await app.getByTestId("colour-dial-minuteHand").boundingBox();
    if (seconds === null || minute === null) throw new Error("no hand buttons");
    expect(seconds.y).toBeLessThan(minute.y);
  });

  test("the Seconds hand colour changes only the seconds hand's button", async ({ app }) => {
    await app.getByTestId("flyout-tab-colours").click();
    await app.getByTestId("colour-dial-secondsHand").click();
    await app.getByTestId("colour-hex").fill("#00ff00");
    await app.getByTestId("colour-hex").press("Enter");
    await expect.poll(() => swatchColour(app, "colour-dial-secondsHand")).toContain("rgb(0, 255, 0)");
    expect(await swatchColour(app, "colour-dial-minuteHand")).not.toContain("rgb(0, 255, 0)");
  });

  test("pressing a colour opens the chart; typing a colour changes it, saves it with the design, and the built-in button restores it", async ({ app }) => {
    await app.getByTestId("flyout-tab-colours").click();
    const before = await swatchColour(app, "colour-dial-minuteHand");
    await app.getByTestId("colour-dial-minuteHand").click();
    await expect(app.getByTestId("colour-picker")).toBeVisible();
    await app.getByTestId("colour-hex").fill("#ff0000");
    await app.getByTestId("colour-hex").press("Enter");
    await expect.poll(() => swatchColour(app, "colour-dial-minuteHand")).toContain("rgb(255, 0, 0)");
    // Only the pressed item changed.
    expect(await swatchColour(app, "colour-dial-hourHand")).not.toContain("rgb(255, 0, 0)");
    // The choice is part of the autosaved design.
    await expect.poll(() => app.evaluate("JSON.stringify(Object.entries(localStorage))")).toContain("ff0000");
    await app.getByTestId("colour-reset").click();
    await expect.poll(() => swatchColour(app, "colour-dial-minuteHand")).toBe(before);
  });

  test("clicking and dragging on the chart changes a wheel's colour, and the chart stays open while dragging", async ({ app }) => {
    await app.getByTestId("flyout-tab-colours").click();
    const wheel = app.locator('[data-testid^="colour-wheel-"]:not([data-testid^="colour-wheel-text-"])').first();
    const swatchStyle = (): Promise<string | null> => wheel.locator(".colour-swatch").getAttribute("style");
    const before = await swatchStyle();
    await wheel.click();
    const chart = app.getByTestId("colour-chart");
    await expect(chart).toBeVisible();
    const box = await chart.boundingBox();
    if (box === null) throw new Error("no chart");
    await app.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.3);
    await app.mouse.down();
    await app.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.6, { steps: 5 });
    await app.mouse.up();
    await expect(chart).toBeVisible();
    await expect.poll(swatchStyle).not.toBe(before);
    // Reset all returns every item to its built-in colour.
    await app.getByTestId("colour-reset-all").click();
    await expect.poll(swatchStyle).toBe(before);
  });
});
