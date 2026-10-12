import { expect, selectTreeItem, test } from "./fixtures";

test("the teaching movement's own screws show their frame and dimensions", async ({ app }) => {
  await selectTreeItem(app, /^Mainplate screw 1/);
  const inspector = app.locator(".inspector");
  await expect(inspector.locator('[data-field="Frame"]')).toHaveValue(/.+/);
  await expect(inspector.locator('[data-field="Diameter (mm)"]')).toHaveValue("0.8");
  await expect(inspector).toContainText("ASM-0056");
});

test("a new screw starts with no frame chosen and lists what is missing", async ({ app }) => {
  await app.getByRole("button", { name: "+ Screw" }).click();
  await expect(app.locator(".console")).toContainText("SCREW-001");
});
