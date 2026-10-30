import { deflateSync } from "node:zlib";
import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

// The software renderer draws a large viewport slowly; keep the window small and run one at a time.
test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 1100, height: 720 } });

/** A small PNG, built here: `width` by `height` greys from `grey(x, y)`. */
function png(width: number, height: number, grey: (x: number, y: number) => number): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (bytes: Buffer): number => { let c = 0xffffffff; for (const b of bytes) c = (crcTable[(c ^ b) & 255] ?? 0) ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type: string, data: Buffer): Buffer => {
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
    const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body));
    return Buffer.concat([length, body, sum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 0; // 8-bit greyscale
  const rows: Buffer[] = [];
  for (let y = 0; y < height; y += 1) rows.push(Buffer.from([0, ...Array.from({ length: width }, (_, x) => grey(x, y))]));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(Buffer.concat(rows))), chunk("IEND", Buffer.alloc(0))]);
}

const button = (page: Page) => page.getByTestId("dial-texture-button");
const swatchData = (page: Page, testId: string): Promise<string> =>
  page.evaluate(`document.querySelector('[data-testid="${testId}"] img').src`);
const stored = (page: Page): Promise<string> => page.evaluate("JSON.stringify(Object.entries(localStorage))");

test.describe("dial textures (ASM-0094)", () => {
  test.use({ layout: "default" });

  test("a button drops a list of every texture, with Import image at the bottom", async ({ app }) => {
    await app.getByTestId("flyout-tab-colours").click();
    await expect(button(app)).toContainText("Smooth (none)");
    await expect(app.getByTestId("dial-texture-list")).toBeHidden();
    await button(app).click();
    const list = app.getByTestId("dial-texture-list");
    await expect(list).toBeVisible();
    // Smooth, then the eleven built-in textures, then Import image at the very bottom.
    const entries = list.locator("button");
    await expect(entries).toHaveCount(13);
    await expect(entries.nth(0)).toContainText("Smooth");
    for (const name of ["Brushed", "Sunburst", "Concentric rings", "Clous de Paris", "Hobnail domes", "Fine grain", "Linen weave", "Carbon twill", "Honeycomb", "Waves", "Barleycorn"]) {
      await expect(list.getByRole("option", { name })).toBeVisible();
    }
    await expect(entries.nth(12)).toHaveAttribute("data-testid", "dial-texture-import");
    await expect(entries.nth(12)).toContainText("Import image");
    await app.keyboard.press("Escape");
    await expect(list).toBeHidden();
  });

  test("choosing a texture applies it, saves it with the design, and Undo takes it back; Reset all colours keeps it", async ({ app }) => {
    await app.getByTestId("flyout-tab-colours").click();
    await button(app).click();
    await app.getByTestId("dial-texture-CLOUS_DE_PARIS").click();
    await expect(app.getByTestId("dial-texture-list")).toBeHidden();
    await expect(button(app)).toContainText("Clous de Paris");
    await expect.poll(() => stored(app)).toContain("CLOUS_DE_PARIS");
    // Reset all colours does not drop the texture.
    await app.getByTestId("colour-reset-all").click();
    await expect(button(app)).toContainText("Clous de Paris");
    await button(app).click();
    await expect(app.getByTestId("dial-texture-CLOUS_DE_PARIS")).toHaveAttribute("aria-selected", "true");
    await app.keyboard.press("Escape");
    await app.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(button(app)).toContainText("Smooth (none)");
  });

  test("the texture follows the dial's colour: the swatches are re-lit in a new dial colour, and the choice stays", async ({ app }) => {
    await app.getByTestId("flyout-tab-colours").click();
    await button(app).click();
    await app.getByTestId("dial-texture-LINEN").click();
    await button(app).click();
    const before = await swatchData(app, "dial-texture-LINEN");
    await app.keyboard.press("Escape");
    await app.getByTestId("colour-dial-dial").click();
    await app.getByTestId("colour-hex").fill("#c03020");
    await app.getByTestId("colour-hex").press("Enter");
    await expect(button(app)).toContainText("Linen weave");
    await button(app).click();
    const after = await swatchData(app, "dial-texture-LINEN");
    expect(after).not.toBe(before);
  });

  test("Import image reads a picture as a relief, lists it by name, and saves it with the design", async ({ app }) => {
    await app.getByTestId("flyout-tab-colours").click();
    await button(app).click();
    await app.getByTestId("dial-texture-file").setInputFiles({
      name: "leather-test.png",
      mimeType: "image/png",
      buffer: png(16, 16, (x, y) => ((x + y) % 4 === 0 ? 255 : 40)),
    });
    await expect(button(app)).toContainText("leather-test.png");
    await expect.poll(() => stored(app)).toContain("IMPORTED");
    await button(app).click();
    await expect(app.getByTestId("dial-texture-imported")).toHaveAttribute("aria-selected", "true");
    await expect(app.getByTestId("dial-texture-list").locator("button").last()).toHaveAttribute("data-testid", "dial-texture-import");
    // Picking a built-in one afterwards replaces it.
    await app.getByTestId("dial-texture-WAVES").click();
    await expect(button(app)).toContainText("Waves");
    await app.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(button(app)).toContainText("leather-test.png");
  });

  test("a file that is not a picture is refused with a clear message, and nothing changes", async ({ app }) => {
    await app.getByTestId("flyout-tab-colours").click();
    await button(app).click();
    await app.getByTestId("dial-texture-file").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("not a picture") });
    await expect(app.getByTestId("dial-texture-error")).toContainText("could not be read as a picture");
    await expect(button(app)).toContainText("Smooth (none)");
  });
});
