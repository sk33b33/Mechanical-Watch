import { describe, expect, it } from "vitest";
import { CHAIN_CAVEAT_TEXT, CHAIN_PRINT_CSS, chainPrintDocument, chainStandaloneSvg, escapeHtml } from "./chainDiagramPrint";

describe("printable drive chain (ASM-0086)", () => {
  const svg = '<svg class="chain-svg" viewBox="0 0 10 10"><rect width="5" height="5"/></svg>';
  const html = chainPrintDocument({ svg, movementName: 'Test <b>"movement"</b>', summary: "All 3 parts are connected to the mainspring through one chain.", generatedAt: new Date("2026-10-24T10:00:00Z") });

  it("is a complete portrait A4 page with the diagram inside, black on white", () => {
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("@page { size: A4 portrait;");
    expect(html).toContain(svg);
    expect(html).toContain("background: #fff");
    expect(html).toContain(CHAIN_PRINT_CSS.trim().split("\n")[0] ?? "");
  });

  it("states the connection summary, when it was generated and the validation caveat", () => {
    expect(html).toContain("All 3 parts are connected to the mainspring through one chain.");
    expect(html).toContain("2026-10-24T10:00:00.000Z");
    expect(html).toContain(escapeHtml(CHAIN_CAVEAT_TEXT));
    expect(CHAIN_CAVEAT_TEXT).toContain("physical validation");
  });

  it("escapes the movement name so it cannot inject markup", () => {
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;b&gt;&quot;movement&quot;&lt;/b&gt;");
  });

  it("builds a standalone SVG with its namespace, print colours and a white background", () => {
    const file = chainStandaloneSvg(svg);
    expect(file.startsWith("<?xml")).toBe(true);
    expect(file).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(file).toContain("<style>");
    expect(file).toContain('<rect width="100%" height="100%" fill="#ffffff"/>');
    expect(chainStandaloneSvg('<svg xmlns="http://www.w3.org/2000/svg"></svg>').match(/xmlns=/g)).toHaveLength(1);
  });
});
