import { readFileSync } from "node:fs";
import { expect, test } from "./fixtures";

test("every available output downloads with the expected content; STEP is refused", async ({ app }) => {
  await app.getByRole("button", { name: "Outputs…" }).click();
  const rows = app.locator(".outputs-table tr");
  await expect(rows).toHaveCount(6);
  const checks: [RegExp, (text: string) => void][] = [
    [/-report\.html$/, (t) => { expect(t).toContain("engineering report"); expect(t).toContain("not validated"); }],
    [/-bom\.csv$/, (t) => { expect(t.split("\r\n")[0]).toContain("Specification (nominal)"); }],
    [/-plan\.svg$/, (t) => { expect(t.startsWith("<svg")).toBe(true); expect(t).toContain("not a manufacturing drawing"); }],
    [/-plan\.dxf$/, (t) => { expect(t.trimEnd().endsWith("EOF")).toBe(true); }],
    [/-visual\.stl$/, (t) => { expect(t.startsWith("solid ")).toBe(true); }],
  ];
  for (let i = 0; i < 5; i += 1) {
    const [download] = await Promise.all([
      app.waitForEvent("download"),
      rows.nth(i).getByRole("button", { name: "Download" }).click(),
    ]);
    const path = await download.path();
    const check = checks.find(([pattern]) => pattern.test(download.suggestedFilename()));
    expect(check, download.suggestedFilename()).toBeDefined();
    check?.[1](readFileSync(path, "utf8"));
  }
  await expect(rows.nth(5).getByRole("button", { name: "Download" })).toBeDisabled();
  await expect(rows.nth(5)).toContainText("Not available");
});

test("the project library saves and reopens a design", async ({ app }) => {
  await app.getByRole("button", { name: "Projects…" }).click();
  await app.getByRole("button", { name: "Save current design" }).click();
  await expect(app.locator(".projects-table")).toContainText("(open now)");
  await app.getByRole("button", { name: "Close" }).click();
  await app.getByTestId("new-design").selectOption("demo");
  await app.getByRole("button", { name: "Projects…" }).click();
  await app.locator(".projects-table tr", { hasText: "Teaching movement" }).getByRole("button", { name: "Open" }).click();
  await expect(app.locator(".tree-item", { hasText: /^Keyless works/ })).toBeVisible();
});
