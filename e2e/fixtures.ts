import { test as base, expect, type Page } from "@playwright/test";

/**
 * Every test starts from a fresh browser profile with the default design
 * (the teaching movement) and fails if the page throws.
 */
export const test = base.extend<{ app: Page }>({
  app: async ({ page }, use) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.goto("/");
    await page.evaluate(() => { localStorage.clear(); });
    await page.reload();
    await expect(page.locator("canvas")).toBeVisible();
    await use(page);
    expect(errors, "uncaught page errors").toEqual([]);
  },
});

export { expect };

/** The simulated dial reading as hours (1–12), minutes and seconds. */
export async function dialReading(page: Page): Promise<{ h: number; m: number; s: number }> {
  const text = await page.getByTestId("dial-reading").innerText();
  const match = /Dial (\d+):(\d+):(\d+)/.exec(text);
  if (match === null) throw new Error(`unexpected dial reading: ${text}`);
  return { h: Number(match[1]), m: Number(match[2]), s: Number(match[3]) };
}

/** Minutes past 12 o'clock on a 12-hour dial. */
export function minutesPastTwelve(r: { h: number; m: number }): number {
  return (r.h % 12) * 60 + r.m;
}

export async function selectTreeItem(page: Page, name: RegExp): Promise<void> {
  await page.locator(".tree-item", { hasText: name }).first().click();
}
