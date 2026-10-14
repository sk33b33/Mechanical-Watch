import { expect, selectTreeItem, test } from "./fixtures";

test("the teaching movement's own season complication shows its month complication and dimensions", async ({ app }) => {
  await selectTreeItem(app, /^Season \(driven/);
  const inspector = app.locator(".inspector");
  await expect(inspector.locator('[data-field="Month complication"]')).toHaveValue(/.+/);
  await expect(inspector.locator('[data-field="Wheel tip Ø \\(mm\\)"]')).toHaveValue("3");
  await expect(inspector).toContainText("ASM-0057");
  await expect(inspector).toContainText("Quarter");
});

test("a new season complication starts with no month complication chosen and lists what is missing", async ({ app }) => {
  await app.getByRole("button", { name: "+ Season" }).click();
  await expect(app.locator(".console")).toContainText("SEASON-001");
});
