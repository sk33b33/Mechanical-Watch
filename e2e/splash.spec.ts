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
