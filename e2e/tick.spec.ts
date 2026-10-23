import { expect, test } from "./fixtures";

test("the second-hand Tick toggle is in the toolbar, on by default, and its choice survives a reload (ASM-0084)", async ({ app }) => {
  const toggle = app.getByTestId("tick-toggle");
  await expect(toggle).toHaveText("Tick: on");
  await toggle.click();
  await expect(toggle).toHaveText("Tick: off");
  await app.reload();
  await expect(app.getByTestId("tick-toggle")).toHaveText("Tick: off");
});
