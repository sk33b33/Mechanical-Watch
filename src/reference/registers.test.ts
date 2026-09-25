import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ASSUMPTIONS } from "./assumptions";
import { RULE_IDS } from "./ruleIds";

function readReference(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(`../../reference/${relativePath}`, import.meta.url)), "utf8");
}

describe("reference registers stay in sync with code", () => {
  it("every assumption in code exists in ASSUMPTION_REGISTER.md with the same status, and vice versa", () => {
    const markdown = readReference("assumptions/ASSUMPTION_REGISTER.md");
    const rows = [...markdown.matchAll(/^\| (ASM-\d{4}) \| .* \| (\w+) \|$/gm)].map((m) => ({
      id: m[1],
      status: m[2],
    }));

    expect(rows.map((r) => r.id).sort()).toEqual(Object.keys(ASSUMPTIONS).sort());
    for (const row of rows) {
      expect(ASSUMPTIONS[row.id as keyof typeof ASSUMPTIONS].status).toBe(row.status);
    }
  });

  it("every rule ID in code exists in RULE_IDS.md, and vice versa", () => {
    const markdown = readReference("validation/RULE_IDS.md");
    const ids = [...markdown.matchAll(/^([A-Z]+-\d{3})\s/gm)].map((m) => m[1]);
    expect([...ids].sort()).toEqual([...RULE_IDS].sort());
  });
});
