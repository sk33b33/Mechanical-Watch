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
const locked = async (page: Page): Promise<void> => {
  await expect(carousel(page)).toHaveAttribute("data-locked", "true", { timeout: 15000 });
};
const SLOT_STEP = (2 * Math.PI) / 8; // the ring has eight places

/**
 * Saves the open design in the library, clones it into `names.length` differently coloured designs, puts the first
 * `onCarousel` of them on the carousel (in places 0, 1, 2, ...), then reloads the page.
 */
async function seed(page: Page, names: readonly string[], onCarousel = names.length): Promise<void> {
  await page.getByRole("button", { name: "Projects…" }).click();
  await page.getByTestId("projects-save").click();
  await page.locator("dialog[open]").getByRole("button", { name: "Close", exact: true }).click();
  await page.evaluate(`(() => {
    const names = ${JSON.stringify(names)};
    const lib = JSON.parse(localStorage.getItem("mw3d.library"));
    const doc = JSON.parse(Object.values(lib.entries)[0].design);
    const dials = ["#1f3a5f", "#d9a38c", "#2f5d3a", "#4a525c", "#f0ead6", "#6b3f5c", "#c9b458", "#233d3a"];
    const entries = {};
    const slots = [null, null, null, null, null, null, null, null];
    names.forEach((name, i) => {
      const d = JSON.parse(JSON.stringify(doc));
      d.movement.id = "movement_demo_" + i;
      d.movement.name = name;
      d.movement.appearance.dial = dials[i % dials.length];
      d.movement.appearance.hourMarkerLume = i % 2 === 1;
      entries["movement_demo_" + i] = { name, savedAt: new Date(Date.now() - i * 3600000).toISOString(), design: JSON.stringify(d) };
      if (i < ${String(onCarousel)}) slots[i] = "movement_demo_" + i;
    });
    localStorage.setItem("mw3d.library", JSON.stringify({ format: "mechanical-watchmaker-3d.library", entries }));
    localStorage.setItem("mw3d.carousel", JSON.stringify({ slots }));
  })()`);
  await page.reload();
  await expect(page.locator("canvas")).toBeVisible();
}

/** A press, a quick sweep of `dx` pixels over `ms`, and a release: a flick. */
async function flick(page: Page, dx: number, ms = 90): Promise<void> {
  const box = await page.getByTestId("carousel").locator(".carousel-stage").boundingBox();
  if (box === null) throw new Error("no stage");
  const y = box.y + box.height * 0.8;
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

test.describe("carousel of saved movements (ASM-0097, ASM-0098)", () => {
  test("the carousel shows no other control: the toolbar, header and edge tabs are all behind it and cannot be reached", async ({ app }) => {
    await openCarousel(app);
    await locked(app);
    // Whatever is at the places of the header, toolbar and each edge tab is the carousel, not the editor.
    const covered = await app.evaluate<boolean[]>(`(() => {
      const points = [[200, 20], [200, 58], [900, 20], [4, 360], [1096, 360], [1096, 560], [550, 714]];
      return points.map(([x, y]) => { const el = document.elementFromPoint(x, y); return !!el && !!el.closest(".carousel"); });
    })()`);
    expect(covered).toEqual([true, true, true, true, true, true, true]);
    expect(await app.evaluate<boolean>(`document.querySelector("#app").inert`)).toBe(true);
    // The only control on it is the small Exit button.
    await expect(carousel(app).getByRole("button", { name: "Exit carousel" })).toBeVisible();
    await expect(carousel(app).locator("button:not(.carousel-card):not(.carousel-exit)")).toHaveCount(0);
  });

  test("it has eight places; with nothing on it every one is a translucent square saying Empty", async ({ app }) => {
    await openCarousel(app);
    await expect(app.locator(".carousel-card")).toHaveCount(8);
    await expect(app.getByTestId("carousel-empty-slot")).toHaveCount(8);
    for (const slot of await app.getByTestId("carousel-empty-slot").all()) await expect(slot).toContainText("Empty");
    await locked(app);
    await expect(carousel(app)).toHaveAttribute("data-front-empty", "true");
  });

  test("tapping the empty place in front starts a new project and the editor appears; the carousel is gone", async ({ app }) => {
    await openCarousel(app);
    await locked(app);
    await app.locator(".carousel-card.front").click({ force: true }); // (force: the cards hover, so never stand still)
    await expect(carousel(app)).toHaveClass(/expanding/);
    await expect(carousel(app)).toBeHidden({ timeout: 10000 });
    await expect(app.locator(".header-title")).toContainText("Untitled movement");
    expect(await app.evaluate<boolean>(`document.querySelector("#app").inert`)).toBe(false);
    await expect(app.getByRole("button", { name: "Undo", exact: true })).toBeEnabled();
  });

  test("a tap on an empty place at the side turns it to the front first, and only a tap on the locked front one starts the project", async ({ app }) => {
    await seed(app, ["Alpha"], 1);
    await openCarousel(app);
    await locked(app);
    await expect(app.locator(".carousel-card.front")).toContainText("Alpha");
    // The next place round the ring is empty and stands to the right; tap it.
    await app.locator(".carousel-card.empty").first().click({ force: true });
    await expect(carousel(app)).toHaveAttribute("data-locked", "true", { timeout: 10000 });
    await expect(carousel(app)).toHaveAttribute("data-front-empty", "true");
    await expect(carousel(app)).toBeVisible();
    await expect(app.locator(".header-title")).not.toContainText("Untitled");
  });

  test("the movements on the carousel are cards with a picture of their dial, in their places, among the empty ones", async ({ app }) => {
    await seed(app, ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot"], 5);
    await openCarousel(app);
    await expect(app.locator(".carousel-card")).toHaveCount(8);
    await expect(app.getByTestId("carousel-card")).toHaveCount(5);
    await expect(app.getByTestId("carousel-empty-slot")).toHaveCount(3);
    // A saved design that is not put on the carousel is not on it.
    await expect(app.locator(".carousel-card", { hasText: "Foxtrot" })).toHaveCount(0);
    await expect(app.locator(".carousel-card .carousel-portrait")).toHaveCount(5, { timeout: 15000 });
    expect(await app.locator("canvas").count()).toBe(1);
    await locked(app);
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
    expect(new Set(second.map((v) => Math.round(v))).size).toBeGreaterThan(1);
    for (const v of [...first, ...second]) expect(Math.abs(v)).toBeLessThanOrEqual(10);
  });

  test("a flick spins the ring the way it was flicked, slows gradually, and locks a card in the centre", async ({ app }) => {
    await seed(app, ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot"]);
    await openCarousel(app);
    await locked(app);
    const start = await num(app, "angle");
    await flick(app, 360);
    await app.waitForTimeout(250);
    expect(await num(app, "angle"), "dragging right turns the ring right").toBeGreaterThan(start + 0.3);
    await expect(carousel(app)).toHaveAttribute("data-locked", "false");
    const a = await num(app, "angle");
    await app.waitForTimeout(150);
    const b = await num(app, "angle");
    await app.waitForTimeout(150);
    const c = await num(app, "angle");
    expect(Math.abs(c - b)).toBeLessThanOrEqual(Math.abs(b - a) + 0.02);
    await locked(app);
    const end = await num(app, "angle");
    expect(Math.abs(end / SLOT_STEP - Math.round(end / SLOT_STEP)), "locked exactly on a place").toBeLessThan(0.01);
    expect(end).toBeGreaterThan(start + 0.5);
    const before = await num(app, "angle");
    await flick(app, -360);
    await locked(app);
    expect(await num(app, "angle")).toBeLessThan(before - 0.5);
  });

  test("a gentle nudge is pulled to the nearest place rather than left between two", async ({ app }) => {
    await seed(app, ["Alpha", "Bravo", "Charlie"]);
    await openCarousel(app);
    await locked(app);
    const box = await app.locator(".carousel-stage").boundingBox();
    if (box === null) throw new Error("no stage");
    await app.mouse.move(box.x + 300, box.y + 560);
    await app.mouse.down();
    await app.mouse.move(box.x + 330, box.y + 560, { steps: 3 });
    await app.waitForTimeout(400);
    await app.mouse.up();
    await expect(carousel(app)).toHaveAttribute("data-locked", "true", { timeout: 10000 });
    const angle = await num(app, "angle");
    expect(Math.abs(angle / SLOT_STEP - Math.round(angle / SLOT_STEP))).toBeLessThan(0.01);
  });

  test("tapping a card at the side turns it to the centre; tapping the locked centre card opens it, and the rest disappear", async ({ app }) => {
    await seed(app, ["Alpha", "Bravo", "Charlie", "Delta", "Echo"]);
    await openCarousel(app);
    await locked(app);
    const frontId = await carousel(app).getAttribute("data-front-id");
    await app.getByTestId("carousel-card").filter({ hasText: "Bravo" }).click({ force: true });
    await expect(carousel(app)).toHaveAttribute("data-locked", "true", { timeout: 10000 });
    await expect(app.locator(".carousel-card.front")).toContainText("Bravo");
    expect(await carousel(app).getAttribute("data-front-id")).not.toBe(frontId);
    await expect(carousel(app)).toBeVisible();
    await app.locator(".carousel-card.front").click({ force: true });
    await expect(carousel(app)).toHaveClass(/expanding/);
    await expect(app.locator(".carousel-card:not(.chosen)").first()).toHaveCSS("opacity", "0");
    await expect(carousel(app)).toBeHidden({ timeout: 10000 });
    // The UI appears the moment the movement is chosen, and Undo brings back the one that was open.
    await expect(app.locator(".header-title")).toContainText("Bravo");
    expect(await app.evaluate<boolean>(`document.querySelector("#app").inert`)).toBe(false);
    await expect(app.getByRole("button", { name: "Undo", exact: true })).toBeEnabled();
    await expect(app.locator("canvas")).toBeVisible();
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
    await app.locator(".carousel-card.front").click({ force: true });
    await expect(carousel(app)).toBeVisible();
    await expect(carousel(app)).not.toHaveClass(/expanding/);
  });

  test("the button enters carousel mode, Exit and Escape leave it, and the movement behind is unchanged", async ({ app }) => {
    const before = await app.locator(".header-title").innerText();
    await openCarousel(app);
    await app.keyboard.press("Escape");
    await expect(carousel(app)).toBeHidden();
    expect(await app.evaluate<boolean>(`document.querySelector("#app").inert`)).toBe(false);
    await openCarousel(app);
    await carousel(app).getByRole("button", { name: "Exit carousel" }).click();
    await expect(carousel(app)).toBeHidden();
    await expect(app.getByTestId("carousel-open")).toBeVisible();
    expect(await app.locator(".header-title").innerText()).toBe(before);
    await expect(app.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
  });
});

test.describe("putting movements on the carousel from Projects (ASM-0098)", () => {
  const openProjects = async (page: Page): Promise<void> => { await page.getByRole("button", { name: "Projects…" }).click(); };
  const closeProjects = async (page: Page): Promise<void> => { await page.locator("dialog[open]").getByRole("button", { name: "Close", exact: true }).click(); };

  test("there is no longer a button to open one design at startup", async ({ app }) => {
    await openProjects(app);
    await app.getByTestId("projects-save").click();
    await expect(app.locator(".projects-table")).toContainText("Teaching movement");
    await expect(app.getByTestId("startup-on")).toHaveCount(0);
    await expect(app.getByTestId("startup-off")).toHaveCount(0);
    await expect(app.locator("dialog[open]")).not.toContainText("startup");
    await expect(app.locator("dialog[open]")).not.toContainText("★");
  });

  test("Save and add to carousel saves the design and puts it in the first place; Remove takes it off; it appears on the carousel", async ({ app }) => {
    await openProjects(app);
    await app.getByTestId("projects-save-carousel").click();
    await expect(app.locator(".projects-table")).toContainText("on the carousel, place 1");
    await expect(app.getByTestId("carousel-remove")).toBeVisible();
    await expect(app.locator("dialog[open]")).toContainText("1 of 8 places used");
    await closeProjects(app);
    await openCarousel(app);
    await expect(app.getByTestId("carousel-card")).toHaveCount(1);
    await expect(app.locator(".carousel-card.front")).toContainText("Teaching movement");
    await app.getByRole("button", { name: "Exit carousel" }).click();
    await openProjects(app);
    await app.getByTestId("carousel-remove").click();
    await expect(app.locator(".projects-table")).not.toContainText("on the carousel");
    await expect(app.getByTestId("carousel-add")).toBeVisible();
    await app.getByTestId("carousel-add").click();
    await expect(app.locator(".projects-table")).toContainText("place 1");
  });

  test("the carousel holds eight: a ninth is refused, and room made lets it in", async ({ app }) => {
    await seed(app, ["D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9"], 8);
    await openProjects(app);
    await expect(app.locator("dialog[open]")).toContainText("8 of 8 places used");
    const ninth = app.locator(".projects-table tr", { hasText: "D9" });
    await ninth.getByTestId("carousel-add").click();
    await expect(app.getByTestId("toolbar-notice")).toContainText("full");
    await expect(ninth).not.toContainText("on the carousel");
    await app.locator(".projects-table tr", { hasText: "D4" }).getByTestId("carousel-remove").click();
    await app.locator(".projects-table tr", { hasText: "D9" }).getByTestId("carousel-add").click();
    await expect(app.locator(".projects-table tr", { hasText: "D9" })).toContainText("place 4");
    await expect(app.locator("dialog[open]")).toContainText("8 of 8 places used");
  });

  test("deleting a saved design empties its place on the carousel", async ({ app }) => {
    await seed(app, ["D1", "D2"]);
    await openProjects(app);
    await app.locator(".projects-table tr", { hasText: "D1" }).getByRole("button", { name: "Delete" }).click();
    await closeProjects(app);
    await openCarousel(app);
    await expect(app.getByTestId("carousel-card")).toHaveCount(1);
    await expect(app.getByTestId("carousel-empty-slot")).toHaveCount(7);
  });
});
