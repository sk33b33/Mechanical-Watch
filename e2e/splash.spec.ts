import { expect, test as base } from "@playwright/test";

// These tests need the real start screen, so they bypass the shared fixture (which loads with ?splash=off).
const test = base;

test("the start screen shows on load, is honest about validation, and a key press enters the app", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto("/");
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload();
  const splash = page.locator(".splash");
  await expect(splash).toBeVisible();
  await expect(splash).toContainText("Tap to enter");
  await expect(splash).toContainText("Declares L2 Kinematic");
  await expect(splash).toContainText("Physical validation pending");
  await expect(splash).toContainText("nothing here is physically validated");
  // The app behind it cannot be reached while it is up.
  await expect(page.locator("#app")).toHaveJSProperty("inert", true);
  await page.keyboard.press("Space");
  await expect(splash).toHaveCount(0);
  await expect(page.locator("#app")).toHaveJSProperty("inert", false);
  await expect(page.locator("canvas").first()).toBeVisible();
  expect(errors, "uncaught page errors").toEqual([]);
});

test("a tap on the start screen enters, and the sound choice is remembered", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload();
  await page.getByRole("button", { name: "Sound on" }).click();
  await expect(page.getByRole("button", { name: "Sound off" })).toBeVisible();
  await expect(page.locator(".splash")).toBeVisible(); // toggling the sound does not enter
  await page.reload();
  await expect(page.getByRole("button", { name: "Sound off" })).toBeVisible();
  await page.getByRole("button", { name: "Tap to enter" }).click();
  await expect(page.locator(".splash")).toHaveCount(0);
});

test("?splash=off skips the start screen", async ({ page }) => {
  await page.goto("/?splash=off");
  await expect(page.locator("canvas").first()).toBeVisible();
  await expect(page.locator(".splash")).toHaveCount(0);
});

test("entering opens the teaching movement at the browser's time, in the dial view (follow-up 31, ASM-0085)", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload();
  await page.getByRole("button", { name: "Tap to enter" }).click();
  await expect(page.locator(".splash")).toHaveCount(0);
  await expect(page.locator("header, .header").first()).toContainText("Teaching movement");
  const clockText = (d: Date): string => `${String(d.getHours() % 12 === 0 ? 12 : d.getHours() % 12)}:${String(d.getMinutes()).padStart(2, "0")}`;
  const now = new Date();
  const soon = new Date(now.getTime() + 60_000);
  const before = new Date(now.getTime() - 60_000);
  const reading = (await page.getByTestId("dial-reading").innerText()).replace("Dial ", "");
  expect([clockText(before), clockText(now), clockText(soon)].some((t) => reading.startsWith(t))).toBe(true);
});

test("entering fades the start screen away with no zoom (follow-up 44)", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload();
  await page.getByRole("button", { name: "Tap to enter" }).click();
  // The app behind it is simply there: no zoom-in animation class.
  await expect(page.locator("#app")).not.toHaveClass(/app-zoom-in/);
  await expect(page.locator(".splash")).toHaveCount(0);
});

test("tilting the phone pans the start screen to reveal complication parts beyond its edges (follow-up 44)", async ({ browser }) => {
  // A touch phone: coarse pointer, portrait.
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto("/");
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload();
  const splash = page.locator(".splash");
  await expect(splash).toBeVisible();
  // A hint, or (where the browser asks first) the Enable tilt button, shows until readings arrive.
  await expect(page.locator(".splash-tilt-note:not([hidden]), .splash-tilt:not([hidden])")).toHaveCount(1);
  // At rest none of the parts is on screen.
  await expect(splash).toHaveAttribute("data-parts-visible", "0");
  const tilt = (gamma: number, beta: number) =>
    page.evaluate(`window.dispatchEvent(new DeviceOrientationEvent("deviceorientation", { gamma: ${String(gamma)}, beta: ${String(beta)}, alpha: 0 }))`);
  await tilt(0, 55); // the first reading is "level", however the phone is held
  // Readings arriving, the Enable tilt button is gone and the hint is up.
  await expect(page.locator(".splash-tilt")).toBeHidden();
  await expect(page.locator(".splash-tilt-note")).toBeVisible();
  await tilt(-25, 55); // tilted to the left: the view pans to reveal what is on the left
  await expect.poll(async () => Number(await splash.getAttribute("data-pan-x"))).toBeGreaterThan(100);
  await expect(splash).not.toHaveAttribute("data-parts-visible", "0");
  await tilt(25, 55); // tilted to the right: the view pans the other way
  await expect.poll(async () => Number(await splash.getAttribute("data-pan-x"))).toBeLessThan(-100);
  await expect(splash).not.toHaveAttribute("data-parts-visible", "0");
  await tilt(0, 55); // level again: back to rest
  await expect.poll(async () => Number(await splash.getAttribute("data-pan-x"))).toBeLessThan(10);
  await expect(splash).toHaveAttribute("data-parts-visible", "0");
  await page.getByRole("button", { name: "Tap to enter" }).click();
  await expect(splash).toHaveCount(0);
  expect(errors, "uncaught page errors").toEqual([]);
  await context.close();
});
