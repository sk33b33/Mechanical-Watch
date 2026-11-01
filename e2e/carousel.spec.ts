import { expect, test } from "./fixtures";
import type { Locator, Page } from "@playwright/test";

// The software renderer draws a large viewport slowly; keep the window small and run one at a time.
test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 1100, height: 720 }, layout: "default" });

const carousel = (page: Page): Locator => page.getByTestId("carousel");
const openCarousel = async (page: Page): Promise<void> => {
  await page.getByTestId("carousel-open").click();
  await expect(carousel(page)).toBeVisible();
};
const num = async (page: Page, key: string): Promise<number> => Number(await carousel(page).getAttribute(`data-${key}`));

/** Fills the library with designs of different colours (cloned from the teaching movement), then reloads the page. */
async function seed(page: Page, names: readonly string[]): Promise<void> {
  await openCarousel(page);
  await page.getByTestId("carousel-save").click();
  await page.getByTestId("carousel-close").click();
  await page.evaluate(`(() => {
    const names = ${JSON.stringify(names)};
    const lib = JSON.parse(localStorage.getItem("mw3d.library"));
    const doc = JSON.parse(Object.values(lib.entries)[0].design);
    const dials = ["#1f3a5f", "#d9a38c", "#2f5d3a", "#4a525c", "#f0ead6", "#6b3f5c", "#c9b458", "#233d3a"];
    const entries = {};
    names.forEach((name, i) => {
      const d = JSON.parse(JSON.stringify(doc));
      d.movement.id = "movement_demo_" + i;
      d.movement.name = name;
      d.movement.appearance.dial = dials[i % dials.length];
      d.movement.appearance.hourMarkerLume = i % 2 === 1;
      entries["movement_demo_" + i] = { name, savedAt: new Date(Date.now() - i * 3600000).toISOString(), design: JSON.stringify(d) };
    });
    localStorage.setItem("mw3d.library", JSON.stringify({ format: "mechanical-watchmaker-3d.library", entries }));
  })()`);
  await page.reload();
  await expect(page.locator("canvas")).toBeVisible();
}

/** A press, a quick sweep of `dx` pixels over `ms`, and a release: a flick. */
async function flick(page: Page, dx: number, ms = 90): Promise<void> {
  const box = await page.getByTestId("carousel").locator(".carousel-stage").boundingBox();
  if (box === null) throw new Error("no stage");
  const y = box.y + box.height * 0.5;
  const x0 = box.x + box.width * 0.5 - dx / 2;
  await page.mouse.move(x0, y);
  await page.mouse.down();
  const steps = 6;
  for (let i = 1; i <= steps; i += 1) {
    await page.mouse.move(x0 + (dx * i) / steps, y);
    await page.waitForTimeout(ms / steps);
  }
  await page.mouse.up();
}

const locked = async (page: Page): Promise<void> => {
  await expect(carousel(page)).toHaveAttribute("data-locked", "true", { timeout: 15000 });
};

test.describe("carousel of saved movements (ASM-0097)", () => {
  test("with nothing saved it says so, and Save current design puts the open movement on the carousel", async ({ app }) => {
    await openCarousel(app);
    await expect(app.getByTestId("carousel-empty")).toContainText("Nothing is saved");
    await expect(app.getByTestId("carousel-card")).toHaveCount(0);
    await app.getByTestId("carousel-save").click();
    await expect(app.getByTestId("carousel-card")).toHaveCount(1);
    await expect(app.getByTestId("carousel-empty")).toBeHidden();
    await expect(app.getByTestId("carousel-card").first()).toContainText("Teaching movement");
    // A single card cannot spin: it stays locked in the middle.
    await locked(app);
    await flick(app, 300);
    await locked(app);
    expect(await num(app, "angle")).toBe(0);
    await app.getByTestId("carousel-close").click();
    await expect(carousel(app)).toBeHidden();
  });

  test("every saved movement is a card showing a picture of its dial; the open one starts in front", async ({ app }) => {
    await seed(app, ["Alpha", "Bravo", "Charlie", "Delta", "Echo"]);
    await openCarousel(app);
    await expect(app.getByTestId("carousel-card")).toHaveCount(5);
    // Each card gets a drawn dial (SVG), never a second canvas.
    await expect(app.locator(".carousel-card .carousel-portrait")).toHaveCount(5, { timeout: 15000 });
    expect(await app.locator("canvas").count()).toBe(1);
    await locked(app);
    // Newest first: Alpha is in front.
    await expect(app.locator(".carousel-card.front")).toContainText("Alpha");
    await expect(app.getByTestId("carousel-caption")).toContainText("Alpha");
  });

  test("the cards hover up and down, each out of step with the next", async ({ app }) => {
    await seed(app, ["Alpha", "Bravo", "Charlie", "Delta"]);
    await openCarousel(app);
    await locked(app);
    const ys = (): Promise<number[]> => app.evaluate<number[]>(`[...document.querySelectorAll(".carousel-card")].map((c) => new DOMMatrixReadOnly(getComputedStyle(c).transform).m42)`);
    const first = await ys();
    await app.waitForTimeout(900);
    const second = await ys();
    expect(second.some((v, i) => Math.abs(v - (first[i] ?? 0)) > 1), "some card moved vertically").toBe(true);
    // They are not all at the same height at once.
    expect(new Set(second.map((v) => Math.round(v))).size).toBeGreaterThan(1);
    // And never by more than a few pixels.
    for (const v of [...first, ...second]) expect(Math.abs(v)).toBeLessThanOrEqual(10);
  });

  test("a flick spins the ring the way it was flicked, slows gradually, and locks a card in the centre", async ({ app }) => {
    await seed(app, ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot"]);
    await openCarousel(app);
    await locked(app);
    const start = await num(app, "angle");
    await flick(app, 360);
    await app.waitForTimeout(250);
    const early = await num(app, "angle");
    expect(early, "dragging right turns the ring right").toBeGreaterThan(start + 0.3);
    // Still turning some time after the release, with the speed falling.
    await expect(carousel(app)).toHaveAttribute("data-locked", "false");
    const a = await num(app, "angle");
    await app.waitForTimeout(150);
    const b = await num(app, "angle");
    await app.waitForTimeout(150);
    const c = await num(app, "angle");
    expect(Math.abs(c - b)).toBeLessThanOrEqual(Math.abs(b - a) + 0.02);
    await locked(app);
    const end = await num(app, "angle");
    const step = (2 * Math.PI) / 6;
    expect(Math.abs(end / step - Math.round(end / step)), "locked exactly on a slot").toBeLessThan(0.01);
    expect(end).toBeGreaterThan(start + 0.5);
    // The other way.
    const before = await num(app, "angle");
    await flick(app, -360);
    await locked(app);
    expect(await num(app, "angle")).toBeLessThan(before - 0.5);
  });

  test("a gentle nudge is pulled to the nearest card rather than left between two", async ({ app }) => {
    await seed(app, ["Alpha", "Bravo", "Charlie", "Delta", "Echo"]);
    await openCarousel(app);
    await locked(app);
    // Drag a little and hold still before letting go: no flick, but the ring is off a slot.
    const box = await app.locator(".carousel-stage").boundingBox();
    if (box === null) throw new Error("no stage");
    await app.mouse.move(box.x + 300, box.y + 200);
    await app.mouse.down();
    await app.mouse.move(box.x + 330, box.y + 200, { steps: 3 });
    await app.waitForTimeout(400);
    await app.mouse.up();
    await expect(carousel(app)).toHaveAttribute("data-locked", "true", { timeout: 10000 });
    const angle = await num(app, "angle");
    const step = (2 * Math.PI) / 5;
    expect(Math.abs(angle / step - Math.round(angle / step))).toBeLessThan(0.01);
  });

  test("tapping a card at the side turns it to the centre; tapping the locked centre card opens it, and the rest disappear", async ({ app }) => {
    await seed(app, ["Alpha", "Bravo", "Charlie", "Delta", "Echo"]);
    await openCarousel(app);
    await locked(app);
    const frontId = await carousel(app).getAttribute("data-front-id");
    // Bravo is the next one round the ring; tap it where it shows.
    const bravo = app.getByTestId("carousel-card").filter({ hasText: "Bravo" });
    await bravo.click({ force: true });
    await expect(carousel(app)).toHaveAttribute("data-locked", "true", { timeout: 10000 });
    await expect(app.locator(".carousel-card.front")).toContainText("Bravo");
    expect(await carousel(app).getAttribute("data-front-id")).not.toBe(frontId);
    // The carousel is still up: tapping a side card only turned it.
    await expect(carousel(app)).toBeVisible();
    // Tap the locked centre card: it expands to be customised and the others disappear.
    // (force: the cards never stand still, they hover, so the usual wait for a steady element would never end)
    await app.locator(".carousel-card.front").click({ force: true });
    await expect(carousel(app)).toHaveClass(/expanding/);
    const others = app.locator(".carousel-card:not(.chosen)");
    await expect(others.first()).toHaveCSS("opacity", "0");
    await expect(carousel(app)).toBeHidden({ timeout: 10000 });
    // The movement is open for editing, and Undo brings back the one that was open.
    await expect(app.locator(".header, header").first()).toContainText("Bravo");
    await expect(app.getByRole("button", { name: "Undo", exact: true })).toBeEnabled();
    await expect(app.locator("canvas")).toBeVisible();
  });

  test("the edge tabs stay on the screen edges over the carousel and still open their panels", async ({ app }) => {
    await seed(app, ["Alpha", "Bravo", "Charlie"]);
    await openCarousel(app);
    await locked(app);
    for (const id of ["tree", "inspector", "colours", "console"]) await expect(app.getByTestId(`flyout-tab-${id}`)).toBeVisible();
    const tree = await app.getByTestId("flyout-tab-tree").boundingBox();
    expect(tree?.x ?? 99).toBeLessThanOrEqual(2);
    const inspector = await app.getByTestId("flyout-tab-inspector").boundingBox();
    expect((inspector?.x ?? 0) + (inspector?.width ?? 0)).toBeGreaterThanOrEqual(1098);
    await app.getByTestId("flyout-tab-colours").click();
    await expect(app.locator(".panel-frame-colours[data-open='true']")).toBeVisible();
    // The carousel is still there underneath.
    await expect(carousel(app)).toBeVisible();
  });

  test("a design that cannot be opened is shown with the reason and does not open", async ({ app }) => {
    await seed(app, ["Alpha", "Bravo"]);
    await app.evaluate(`(() => {
      const lib = JSON.parse(localStorage.getItem("mw3d.library"));
      const entry = lib.entries["movement_demo_1"];
      const doc = JSON.parse(entry.design);
      doc.schemaVersion = 999;
      entry.design = JSON.stringify(doc);
      localStorage.setItem("mw3d.library", JSON.stringify(lib));
    })()`);
    await openCarousel(app);
    await expect(app.getByTestId("carousel-card")).toHaveCount(2);
    await expect(app.locator(".carousel-card", { hasText: "Bravo" })).toContainText("newer version");
    await locked(app);
    await app.locator(".carousel-card", { hasText: "Bravo" }).click({ force: true });
    await expect(carousel(app)).toHaveAttribute("data-locked", "true", { timeout: 10000 });
    // (force: the cards never stand still, they hover, so the usual wait for a steady element would never end)
    await app.locator(".carousel-card.front").click({ force: true });
    await expect(app.locator(".toolbar-notice")).toContainText("cannot be opened");
    await expect(carousel(app)).toBeVisible();
  });

  test("Escape and Close leave the carousel, and the movement behind it is unchanged", async ({ app }) => {
    await seed(app, ["Alpha", "Bravo"]);
    const before = await app.locator(".header, header").first().innerText();
    await openCarousel(app);
    await app.keyboard.press("Escape");
    await expect(carousel(app)).toBeHidden();
    await openCarousel(app);
    await app.getByTestId("carousel-close").click();
    await expect(carousel(app)).toBeHidden();
    expect(await app.locator(".header, header").first().innerText()).toBe(before);
  });
});
