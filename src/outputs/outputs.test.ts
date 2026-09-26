import { describe, expect, it } from "vitest";
import { metres, millimetres as mm, toMillimetres } from "@/units/length";
import { setTolerance, updateGear, updateJewel, updateShaft, type Movement } from "@/domain/movement";
import { createTolerance } from "@/domain/tolerance";
import { createTeachingMovement } from "@/app/teachingMovement";
import { createDemoMovement } from "@/app/demoMovement";
import { createEmptyMovement } from "@/domain/editing";
import { analyzeMovement } from "@/analysis/analyzeMovement";
import { buildBom, bomCsv, toCsv } from "./bom";
import { componentReports, meshReports } from "./componentReport";
import { buildPlanDrawing } from "./drawing/planDrawing";
import { renderPlanSvg } from "./drawing/svg";
import { renderPlanDxf } from "./drawing/dxf";
import { buildStl } from "./stl";
import { renderMovementReport } from "./movementReport";
import { EXPORT_FORMATS, fileStem, produceExport } from "./exporters";

const teaching = createTeachingMovement();
const analysis = analyzeMovement(teaching);
const byName = <T extends { name: string }>(items: Record<string, T>, name: string): T => {
  const found = Object.values(items).find((i) => i.name === name);
  if (found === undefined) throw new Error(name);
  return found;
};
const at = new Date("2026-09-26T12:00:00Z");
/** An SI value from a report (metres) in millimetres; NaN when absent. */
const inMm = (si: number | null | undefined): number => toMillimetres(metres(si ?? Number.NaN));

describe("bill of materials", () => {
  const bom = buildBom(teaching);

  it("lists every frame, arbor, gear and bearing exactly once", () => {
    const count = (r: object): number => Object.keys(r).length;
    expect(bom).toHaveLength(count(teaching.frames) + count(teaching.shafts) + count(teaching.gears) + count(teaching.jewels));
    expect(new Set(bom.map((r) => r.entityId)).size).toBe(bom.length);
  });

  it("nests gears under their arbor and states the nominal specification", () => {
    const centre = bom.find((r) => r.name === "Centre wheel");
    const arbor = bom.find((r) => r.entityId === byName(teaching.gears, "Centre wheel").shaftId);
    expect(centre?.depth).toBe(1);
    expect(centre?.item.startsWith(`${arbor?.item ?? "?"}.`)).toBe(true);
    expect(centre?.specification).toContain("z = 80");
    expect(centre?.specification).toContain("pitch Ø 9.6000 mm"); // 0.12 × 80
  });

  it("never guesses a material", () => {
    expect(bom.every((r) => r.material.startsWith("not specified"))).toBe(true);
  });

  it("records the friction clutch as a note, not a part", () => {
    expect(bom.find((r) => r.name === "Cannon pinion")?.notes).toMatch(/friction clutch/);
  });

  it("writes RFC 4180 CSV", () => {
    expect(toCsv(["a", "b"], [["x,y", 'say "hi"']])).toBe('a,b\r\n"x,y","say ""hi"""\r\n');
    const csv = bomCsv(teaching);
    expect(csv.split("\r\n")[0]).toBe("Item,Name,Type,Qty,Specification (nominal),Location,Material,Tolerances,Notes");
    expect(csv.trimEnd().split("\r\n")).toHaveLength(bom.length + 1);
  });
});

describe("component reports", () => {
  const reports = componentReports(teaching, analysis);

  it("derives pitch diameter with its equation and basis", () => {
    const wheel = reports.find((r) => r.name === "Centre wheel");
    const d = wheel?.derived.find((v) => v.label === "Pitch diameter");
    expect(inMm(d?.si)).toBeCloseTo(9.6, 9);
    expect(d?.equation).toBe("d = m z");
    expect(d?.references).toEqual(["REF-ENG §5.1"]);
    expect(d?.level).toBe("L1_GEOMETRIC");
  });

  it("reports the minutes arbor at one revolution per hour, clockwise from the dial", () => {
    const minutes = Object.values(teaching.shafts).find((s) => s.hand === "MINUTES");
    const report = reports.find((r) => r.id === minutes?.id);
    const omega = report?.derived.find((v) => v.label === "Angular velocity")?.si ?? Number.NaN;
    expect(omega).toBeCloseTo((2 * Math.PI) / 3600, 12);
    expect(report?.derived.find((v) => v.label === "Direction seen from the dial")?.text).toBe("clockwise");
  });

  it("says unknown instead of inventing bearing clearances", () => {
    const report = reports.find((r) => r.kind === "Arbor" && r.derived.some((v) => v.label === "Endshake"));
    expect(report?.derived.find((v) => v.label === "Endshake")?.text).toMatch(/^unknown/);
  });

  it("adds tolerance stacks only where tolerances are declared", () => {
    const demo = createDemoMovement();
    const a = byName(demo.shafts, "Arbor A");
    let m: Movement = updateShaft(demo, a.id, { pivotDiameter: { LOWER: mm(0.1), UPPER: mm(0.1) }, shoulderSpan: mm(1.97) });
    m = updateJewel(m, byName(m.jewels, "Arbor A lower jewel").id, { boreDiameter: mm(0.11) });
    const before = componentReports(m, analyzeMovement(m)).find((r) => r.id === a.id);
    expect(before?.derived.some((v) => v.label.includes("(tolerances)"))).toBe(false);
    m = setTolerance(m, createTolerance({ entityId: a.id, dimension: "SHAFT_PIVOT_LOWER", lowerDeviation: mm(-0.002), upperDeviation: mm(0) }));
    const after = componentReports(m, analyzeMovement(m)).find((r) => r.id === a.id);
    const stack = after?.derived.find((v) => v.label === "Side shake, lower (tolerances)");
    expect(inMm(stack?.si)).toBeCloseTo(0.01, 12);
    expect(stack?.references).toContain("ASM-0017");
    expect(after?.tolerances).toHaveLength(1);
  });

  it("mesh reports: ratio −z1/z2 and ideal centre distance", () => {
    const mesh = meshReports(teaching, analysis).find((r) => r.driving === "Centre wheel");
    expect(mesh?.ratio).toBeCloseTo(-80 / 10, 12);
    expect(inMm(mesh?.idealCentreDistance)).toBeCloseTo(5.4, 12);
    expect(inMm(mesh?.actualCentreDistance)).toBeCloseTo(5.4, 9);
  });
});

describe("plan drawing", () => {
  const drawing = buildPlanDrawing(teaching, analysis);

  it("draws a pitch circle per placed gear and a centre mark per placed arbor", () => {
    const pitch = drawing.primitives.filter((p) => p.kind === "circle" && p.layer === "PITCH");
    expect(pitch).toHaveLength(Object.keys(teaching.gears).length);
    const centre = byName(teaching.gears, "Centre wheel");
    const axis = analysis.placement.shaftPositions.get(centre.shaftId);
    expect(pitch.some((p) => p.kind === "circle" && Math.abs(p.radius - 4.8) < 1e-9
      && Math.abs(p.centre.x - toMillimetres(axis?.x ?? mm(Number.NaN))) < 1e-9)).toBe(true);
  });

  it("gives coaxial arbors one centre mark and one label", () => {
    const labels = drawing.primitives.flatMap((p) => (p.kind === "text" ? [p.text] : []));
    expect(labels).toContain("Cannon pinion / Centre arbor / Hour wheel");
    expect(labels.filter((l) => l.includes("Centre arbor"))).toHaveLength(1);
  });

  it("dimensions each meshed pair of axes once, with the placed distance", () => {
    const texts = drawing.primitives.flatMap((p) => (p.kind === "dimension" ? [p.text] : []));
    expect(texts).toContain("5.4000");
    // Cannon pinion → minute wheel and minute pinion → hour wheel join the same two axis positions.
    expect(texts).toHaveLength(Object.keys(teaching.gearMeshes).length - 1);
  });

  it("adds the ideal distance when the placed distance differs from it", () => {
    const third = byName(teaching.gears, "Third pinion");
    const axis = analysis.placement.shaftPositions.get(third.shaftId);
    if (axis === undefined) throw new Error("third arbor unplaced");
    // Pin the third arbor 0.1 mm further along +X than its mesh constraint put it.
    const m = updateShaft(teaching, third.shaftId, { placement: { kind: "FIXED", position: { x: mm(toMillimetres(axis.x) + 0.1), y: axis.y } } });
    const texts = buildPlanDrawing(m, analyzeMovement(m)).primitives.flatMap((p) => (p.kind === "dimension" ? [p.text] : []));
    expect(texts.some((t) => t.includes("(ideal 5.4000)"))).toBe(true);
  });

  it("prints no NaN when meshed modules differ", () => {
    const third = byName(teaching.gears, "Third pinion");
    const m = updateGear(teaching, third.id, { module: mm(0.1) });
    const d2 = buildPlanDrawing(m, analyzeMovement(m));
    expect(renderPlanSvg(d2, { generatedAt: "x" })).not.toContain("NaN");
  });

  it("states that it is nominal and not a manufacturing drawing", () => {
    expect(drawing.notes.join(" ")).toMatch(/MFG-001/);
    expect(drawing.notes.join(" ")).toMatch(/MFG-002/);
    expect(drawing.notes.join(" ")).toMatch(/ASM-0009/);
    expect([20, 10, 5, 2, 1]).toContain(drawing.scale);
  });

  it("renders well-formed SVG and escapes names", () => {
    const m = { ...teaching, name: "A <b> & \"c\"" };
    const svg = renderPlanSvg(buildPlanDrawing(m, analyzeMovement(m)), { generatedAt: at.toISOString() });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.trimEnd().endsWith("</svg>")).toBe(true);
    expect(svg).toContain("A &lt;b&gt; &amp; &quot;c&quot;");
    expect(svg).not.toContain("NaN");
  });

  it("handles an empty movement", () => {
    const empty = createEmptyMovement();
    const d = buildPlanDrawing(empty, analyzeMovement(empty));
    expect(d.bounds).toBeNull();
    expect(renderPlanSvg(d, { generatedAt: "x" })).toContain("Nothing to draw");
  });

  it("writes DXF R12 with balanced sections, mm units and plain-ASCII text", () => {
    const dxf = renderPlanDxf(drawing);
    const lines = dxf.split("\r\n");
    expect(lines.filter((l) => l === "SECTION")).toHaveLength(3);
    expect(lines.filter((l) => l === "ENDSEC")).toHaveLength(3);
    expect(lines.at(-2)).toBe("EOF");
    expect(dxf).toContain("$INSUNITS\r\n70\r\n4");
    expect(lines.length % 2).toBe(1); // group-code/value pairs plus the trailing empty line
    expect(/[^\x20-\x7e\r\n]/.test(dxf)).toBe(false);
    expect(lines.filter((l) => l === "CIRCLE").length).toBeGreaterThanOrEqual(Object.keys(teaching.gears).length);
  });
});

describe("STL (visual, L0)", () => {
  it("writes one solid per complete frame and valid gear, in millimetres", () => {
    const stl = buildStl(teaching, analysis);
    expect(stl.solids).toBe(Object.keys(teaching.frames).length + Object.keys(teaching.gears).length);
    expect(stl.skipped).toEqual([]);
    expect(stl.triangles).toBeGreaterThan(100);
    expect(stl.text.match(/^solid /gm)).toHaveLength(stl.solids);
    // Mainplate radius 15 mm: some vertex lies ~15 mm from its centre, i.e. coordinates are in mm, not m.
    expect(stl.text).toMatch(/vertex 1\.\d+e\+1 /);
  });

  it("skips invalid gears and says why", () => {
    const g = byName(teaching.gears, "Centre wheel");
    const m = updateGear(teaching, g.id, { toothCount: Number.NaN });
    const stl = buildStl(m, analyzeMovement(m));
    expect(stl.skipped).toContain("Centre wheel: invalid gear parameters");
  });
});

describe("movement report", () => {
  const html = renderMovementReport(teaching, analysis, { generatedAt: at });

  it("is deterministic for a given design and time", () => {
    expect(renderMovementReport(teaching, analysis, { generatedAt: at })).toBe(html);
  });

  it("states the declared level, the manufacturing status and that tolerances are absent", () => {
    expect(html).toContain("L2 Kinematic");
    expect(html).toMatch(/Manufacturing readiness<\/b> not validated/);
    expect(html).toMatch(/none declared: every dimension in this report is nominal only \(MFG-001\)/);
    expect(html).toContain("Teaching demo");
  });

  it("contains the plan drawing, BOM, component reports and assumption register", () => {
    expect(html).toContain("<svg");
    expect(html).toContain("Bill of materials");
    expect(html).toContain("Centre wheel");
    expect(html).toContain("ASM-0017");
  });

  it("avoids claims the model cannot support", () => {
    expect(html).not.toMatch(/manufacturing[- ]ready|guaranteed|physically accurate/i);
  });

  it("reports a failing declared level honestly", () => {
    const g = byName(teaching.gears, "Centre wheel");
    const bad = updateGear(teaching, g.id, { toothCount: 0 });
    expect(renderMovementReport(bad, analyzeMovement(bad), { generatedAt: at })).toMatch(/not met/);
  });
});

describe("export registry", () => {
  it("produces every available format and refuses STEP with a reason", () => {
    for (const format of EXPORT_FORMATS) {
      if (format.availability.status === "AVAILABLE") {
        const file = produceExport(format.id, { movement: teaching, analysis, generatedAt: at });
        expect(file.filename.endsWith(`.${format.extension}`)).toBe(true);
        expect(file.content.length).toBeGreaterThan(0);
      } else {
        expect(() => produceExport(format.id, { movement: teaching, analysis, generatedAt: at })).toThrow(/tooth profiles/);
      }
    }
  });

  it("labels the STL as visual only", () => {
    expect(EXPORT_FORMATS.find((f) => f.id === "assembly-stl")?.level).toBe("L0_VISUAL");
  });

  it("makes safe file names", () => {
    expect(fileStem({ ...teaching, name: "  My/Watch: v2 " })).toBe("My-Watch-v2");
    expect(fileStem({ ...teaching, name: "///" })).toBe("movement");
  });
});
