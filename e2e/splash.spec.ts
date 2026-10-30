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

/** A touch phone's start screen, with a helper that sends synthetic orientation readings. */
async function openPhoneSplash(browser: import("@playwright/test").Browser, width = 390, height = 844) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto("/");
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload();
  const splash = page.locator(".splash");
  await expect(splash).toBeVisible();
  const tilt = (alpha: number, beta: number, gamma: number) =>
    page.evaluate(`window.dispatchEvent(new DeviceOrientationEvent("deviceorientation", { gamma: ${String(gamma)}, beta: ${String(beta)}, alpha: ${String(alpha)} }))`);
  return { context, page, splash, tilt, errors };
}

test("the start screen is exactly the phone's screen and the page behind it cannot scroll or widen it (follow-up 51)", async ({ browser }) => {
  const { context, page, splash, errors } = await openPhoneSplash(browser);
  const box = await splash.boundingBox();
  expect(box).not.toBeNull();
  expect(Math.round(box?.width ?? 0)).toBe(390);
  expect(Math.round(box?.height ?? 0)).toBe(844);
  // The drawing canvas fills the screen exactly (it used to be 60px bigger than its buffer).
  const canvas = await page.locator(".splash-gears").boundingBox();
  expect(Math.round(canvas?.x ?? 1)).toBe(0);
  expect(Math.round(canvas?.width ?? 0)).toBe(390);
  expect(Math.round(canvas?.height ?? 0)).toBe(844);
  // Nothing behind it widens the layout.
  const sizes = await page.evaluate<{ scrollWidth: number; innerWidth: number; locked: boolean }>(
    `({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth, locked: document.documentElement.classList.contains("splash-open") })`);
  expect(sizes.locked).toBe(true);
  expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.innerWidth);
  await page.getByRole("button", { name: "Tap to enter" }).click();
  await expect(splash).toHaveCount(0);
  expect(await page.evaluate<boolean>(`document.documentElement.classList.contains("splash-open")`)).toBe(false);
  expect(errors, "uncaught page errors").toEqual([]);
  await context.close();
});

test("a sharp tilt, from a phone stood almost upright, glides without jumping and stays within the pan range (follow-up 51)", async ({ browser }) => {
  const { context, splash, tilt, errors } = await openPhoneSplash(browser);
  await tilt(0, 89.5, 0); // held nearly upright: the first reading is level (where the Euler angles used to flip)
  await expect(splash).toHaveAttribute("data-parts-visible", "0");
  const pans: number[] = [];
  const pan = async () => Number(await splash.getAttribute("data-pan-x"));
  // Swing it sharply to the right in small readings that include the wild alpha/gamma swings a real sensor gives there.
  for (let degrees = 0; degrees <= 60; degrees += 3) {
    await tilt(degrees * 1.2, 89.5 - degrees * 0.1, degrees);
    pans.push(await pan());
  }
  await expect.poll(pan).toBeLessThan(-100);
  const range = 0.46 * 390;
  const settled = await pan();
  expect(Math.abs(settled)).toBeLessThanOrEqual(range + 1);
  // The pan only ever moved one way and never by more than a fraction of the range between samples (no jump).
  for (let i = 1; i < pans.length; i += 1) {
    const step = (pans[i] ?? 0) - (pans[i - 1] ?? 0);
    expect(step, `sample ${String(i)}`).toBeLessThanOrEqual(1);
    expect(Math.abs(step), `sample ${String(i)}`).toBeLessThan(0.6 * range);
  }
  expect(errors, "uncaught page errors").toEqual([]);
  await context.close();
});

test("at the farthest tilt in every direction the view still shows gears in all its quarters (follow-up 51)", async ({ browser }) => {
  for (const [width, height] of [[390, 844], [844, 390]] as const) {
    const { context, page, splash, tilt, errors } = await openPhoneSplash(browser, width, height);
    await tilt(0, 60, 0);
    // How many of a 3 x 3 grid of cells on the canvas have some lit pixel, read off the 2D canvas.
    const litCells = () => page.evaluate<number>(`(() => {
      const canvas = document.querySelector(".splash-gears");
      const context2d = canvas ? canvas.getContext("2d") : null;
      if (!canvas || !context2d) return -1;
      let lit = 0;
      const cw = Math.floor(canvas.width / 3);
      const ch = Math.floor(canvas.height / 3);
      for (let gx = 0; gx < 3; gx += 1) for (let gy = 0; gy < 3; gy += 1) {
        const data = context2d.getImageData(gx * cw, gy * ch, cw, ch).data;
        let any = false;
        for (let i = 3; i < data.length; i += 28) if (data[i] > 40) { any = true; break; }
        if (any) lit += 1;
      }
      return lit;
    })()`);
    // Directions as the user tilts: (right, down) in {-1, 0, 1}. A phone on its side (screen angle 90) swaps the sensor's axes.
    const sideways = width > height;
    const directions: [number, number, string][] = [[0, 0, "rest"], [1, 0, "right"], [-1, 0, "left"], [0, 1, "down"], [0, -1, "up"], [1, 1, "down-right"], [-1, -1, "up-left"], [1, -1, "up-right"], [-1, 1, "down-left"]];
    for (const [right, down, name] of directions) {
      const gamma = 30 * (sideways ? -down : right);
      const beta = 60 + 30 * (sideways ? right : down);
      await tilt(0, beta, gamma);
      await expect.poll(async () => {
        const px = Math.abs(Number(await splash.getAttribute("data-pan-x")));
        const py = Math.abs(Number(await splash.getAttribute("data-pan-y")));
        return (right === 0 || px > 0.4 * width) && (down === 0 || py > 0.4 * height);
      }, { message: `${name} reaches its pan` }).toBe(true);
      await page.waitForTimeout(500);
      expect(await litCells(), `${name} at ${String(width)}x${String(height)}`).toBeGreaterThanOrEqual(8);
    }
    expect(errors, "uncaught page errors").toEqual([]);
    await context.close();
  }
});
