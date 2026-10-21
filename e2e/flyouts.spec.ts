import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

// The software renderer draws a large viewport slowly; keep the window small and run one at a time.
test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 1100, height: 720 } });

const frame = (page: Page, id: string) => page.locator(`.panel-frame-${id}`);
const tab = (page: Page, id: string) => page.getByTestId(`flyout-tab-${id}`);

test.describe("flyout panels (the default layout)", () => {
  test.use({ layout: "default" });

  test("every panel starts tucked away behind a tab that hugs its screen edge, and the movement has the whole window", async ({ app }) => {
    for (const id of ["tree", "inspector", "console"]) {
      await expect(frame(app, id)).toBeHidden();
      await expect(tab(app, id)).toBeVisible();
      await expect(tab(app, id)).toHaveAttribute("aria-expanded", "false");
    }
    // Hugging the edge: Components at the left, Inspector at the right, Validation at the bottom.
    const w = 1100;
    const h = 720;
    expect((await tab(app, "tree").boundingBox())?.x).toBeLessThan(2);
    const inspectorBox = await tab(app, "inspector").boundingBox();
    expect((inspectorBox?.x ?? 0) + (inspectorBox?.width ?? 0)).toBeGreaterThan(w - 2);
    const consoleBox = await tab(app, "console").boundingBox();
    expect((consoleBox?.y ?? 0) + (consoleBox?.height ?? 0)).toBeGreaterThan(h - 2);
    const canvas = await app.locator(".viewport canvas").boundingBox();
    expect(canvas?.width).toBeGreaterThan(w - 4);
  });

  test("pressing a tab slides its panel out over the movement, and pressing it again slides it back", async ({ app }) => {
    await tab(app, "tree").click();
    await expect(frame(app, "tree")).toBeVisible();
    await expect(tab(app, "tree")).toHaveAttribute("aria-expanded", "true");
    // It is a live panel: pick a part from it, and the inspector flyout shows that part.
    await app.locator(".tree-item", { hasText: /^Barrel drum/ }).first().click();
    await tab(app, "inspector").click();
    await expect(frame(app, "inspector")).toBeVisible();
    await expect(app.locator(".inspector")).toContainText("Barrel drum");
    // The panels overlay the movement rather than squeezing it.
    expect((await app.locator(".viewport canvas").boundingBox())?.width).toBeGreaterThan(1096);
    await tab(app, "tree").click();
    await expect(frame(app, "tree")).toBeHidden();
    await expect(tab(app, "tree")).toHaveAttribute("aria-expanded", "false");
    await expect(frame(app, "inspector")).toBeVisible();
  });

  test("the header buttons slide the flyouts out too, and Escape slides every open one back", async ({ app }) => {
    await app.getByTestId("toggle-console").click();
    await expect(frame(app, "console")).toBeVisible();
    await expect(app.getByTestId("toggle-console")).toHaveAttribute("aria-pressed", "true");
    await app.getByTestId("toggle-tree").click();
    await expect(frame(app, "tree")).toBeVisible();
    await app.keyboard.press("Escape");
    for (const id of ["tree", "inspector", "console"]) await expect(frame(app, id)).toBeHidden();
    await expect(app.getByTestId("toggle-console")).toHaveAttribute("aria-pressed", "false");
  });

  test("starting the tutorial slides out the panels it points at (Components and Inspector)", async ({ app }) => {
    await app.getByRole("button", { name: "Tutorial…", exact: true }).click();
    await expect(frame(app, "tree")).toBeVisible();
    await expect(frame(app, "inspector")).toBeVisible();
    await expect(frame(app, "console")).toBeHidden();
  });

  test("a flyout can be docked, and tucked away again, from its own title bar; the choice is remembered", async ({ app }) => {
    await tab(app, "inspector").click();
    await frame(app, "inspector").getByRole("button", { name: "Dock the Inspector panel" }).click();
    await expect(frame(app, "inspector")).toHaveAttribute("data-mode", "DOCKED");
    await expect(tab(app, "inspector")).toBeHidden();
    await app.reload();
    await expect(frame(app, "inspector")).toHaveAttribute("data-mode", "DOCKED");
    await frame(app, "inspector").getByRole("button", { name: "Make the Inspector panel a flyout" }).click();
    await expect(frame(app, "inspector")).toHaveAttribute("data-mode", "FLYOUT");
    // Tucked away this way it slides out at once, so the change is visible.
    await expect(frame(app, "inspector")).toBeVisible();
    await expect(tab(app, "inspector")).toBeVisible();
    // Which flyouts are open is not remembered across a reload: the panels start closed again.
    await app.reload();
    await expect(frame(app, "inspector")).toHaveAttribute("data-mode", "FLYOUT");
    await expect(frame(app, "inspector")).toBeHidden();
  });
});
