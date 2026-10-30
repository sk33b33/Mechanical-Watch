import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

// The software renderer draws a large viewport slowly; keep the window small and run one at a time.
test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 1100, height: 720 } });

const stored = (page: Page): Promise<string> => page.evaluate("JSON.stringify(Object.entries(localStorage))");
const savedLume = (page: Page): Promise<unknown> =>
  page.evaluate(`JSON.parse(localStorage.getItem("mw3d.autosave") ?? "{}").movement?.appearance?.hourMarkerLume`);
const glow = (page: Page) => page.getByTestId("colour-hour-markers-glow");
const night = (page: Page) => page.getByTestId("night-mode");

test.describe("applied indices, glow in the dark and night mode (ASM-0095)", () => {
  test.use({ layout: "default" });

  test("a Glow in the dark button sits beside the hour marker colour; it is saved, undoable, and kept by Reset all colours", async ({ app }) => {
    await app.getByTestId("flyout-tab-colours").click();
    // Next to the hour markers colour button, in the same row.
    const row = app.getByTestId("colour-dial-hourMarkers").locator("xpath=ancestor::*[self::div or self::li][1]");
    await expect(row.getByTestId("colour-hour-markers-glow")).toBeVisible();
    await expect(glow(app)).toContainText("Glow in the dark");
    await expect(glow(app)).toHaveAttribute("aria-pressed", "false");
    await glow(app).click();
    await expect(glow(app)).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => savedLume(app)).toBe(true);
    // The colour button is still there to pick a colour for the top layer when the glow is off again.
    await app.getByTestId("colour-reset-all").click();
    await expect(glow(app)).toHaveAttribute("aria-pressed", "true");
    await app.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(glow(app)).toHaveAttribute("aria-pressed", "false");
    await glow(app).click();
    await glow(app).click();
    await expect(glow(app)).toHaveAttribute("aria-pressed", "false");
  });

  test("Night mode darkens the view and is a view setting: it is not saved with the design", async ({ app }) => {
    await expect(night(app)).toHaveAttribute("aria-pressed", "false");
    await night(app).click();
    await expect(night(app)).toHaveAttribute("aria-pressed", "true");
    await expect(night(app)).toHaveClass(/active/);
    expect(await stored(app)).not.toMatch(/night/i);
    await night(app).click();
    await expect(night(app)).toHaveAttribute("aria-pressed", "false");
  });

  test("lume and night mode together raise no page errors", async ({ app }) => {
    const errors: string[] = [];
    app.on("pageerror", (error) => errors.push(String(error)));
    await app.getByTestId("flyout-tab-colours").click();
    await glow(app).click();
    await night(app).click();
    await app.waitForTimeout(1200);
    await night(app).click();
    await glow(app).click();
    await app.waitForTimeout(300);
    expect(errors, "uncaught page errors").toEqual([]);
  });
});
