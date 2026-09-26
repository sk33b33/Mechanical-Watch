import { setNominalTimeDrive } from "@/domain/movement";
import { describe, expect, it } from "vitest";
import { metres, millimetres as mm, toMillimetres } from "@/units/length";
import { setTolerance, updateGear, updateJewel, updateShaft, type Movement } from "@/domain/movement";
import { createTolerance } from "@/domain/tolerance";
import { createTeachingMovement } from "@/app/teachingMovement";
import { createDemoMovement } from "@/app/demoMovement";
import { createEmptyMovement } from "@/domain/editing";
import { analyzeMovement } from "@/analysis/analyzeMovement";
import { buildBom, bomCsv, toCsv } from "./bom";
import { componentReports, meshReports, type ReportValue } from "./componentReport";
import { buildPlanDrawing } from "./drawing/planDrawing";
import { buildElevationDrawing } from "./drawing/elevationDrawing";
import { renderPlanSvg } from "./drawing/svg";
import { renderPlanDxf } from "./drawing/dxf";
import { buildStl } from "./stl";
import { renderMovementReport } from "./movementReport";
import { EXPORT_FORMATS, fileStem, produceExport } from "./exporters";

// Nominal-time drive: these tests check exact nominal speeds; the default balance drive is tested separately.
const teaching = setNominalTimeDrive(createTeachingMovement());
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

  it("lists every frame, arbor, gear, bearing and dial exactly once, and the keyless works with its parts", () => {
    const count = (r: object): number => Object.keys(r).length;
    const keylessRows = bom.filter((r) => r.entityId in teaching.keylessWorks);
    const escapementRows = bom.filter((r) => r.entityId in teaching.escapements);
    const others = bom.filter((r) => !(r.entityId in teaching.keylessWorks) && !(r.entityId in teaching.escapements));
    expect(escapementRows.map((r) => r.name)).toEqual(
      ["Escapement", "Escape wheel", "Pallet fork", "Pallet stones", "Balance", "Hairspring", "Roller and impulse pin"],
    );
    expect(escapementRows.find((r) => r.name === "Hairspring")?.specification).toBe("stiffness 246.70 µN·mm/rad (entered)");
    expect(escapementRows.find((r) => r.name === "Roller and impulse pin")?.specification).toBe("not modeled");
    expect(others).toHaveLength(count(teaching.frames) + count(teaching.shafts) + count(teaching.gears) + count(teaching.jewels) + count(teaching.dials));
    expect(new Set(others.map((r) => r.entityId)).size).toBe(others.length);
    expect(new Set(bom.map((r) => r.item)).size).toBe(bom.length);
    expect(keylessRows.map((r) => r.name)).toEqual(
      ["Keyless works", "Stem", "Crown", "Winding pinion", "Sliding pinion", "Setting lever and yoke", "Click and click spring"],
    );
    expect(keylessRows.find((r) => r.name === "Winding pinion")?.specification).toContain("z = 14");
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
    expect(mesh?.centreDistanceTolerance).toBeNull(); // nothing toleranced yet
  });

  it("mesh reports: a module tolerance gives a worst-case centre distance (ASM-0027)", () => {
    const wheel = byName(teaching.gears, "Centre wheel");
    const m = setTolerance(teaching, createTolerance({ entityId: wheel.id, dimension: "GEAR_MODULE", lowerDeviation: mm(-0.005), upperDeviation: mm(0.005) }));
    const mesh = meshReports(m, analyzeMovement(m)).find((r) => r.driving === "Centre wheel");
    expect(mesh?.centreDistanceTolerance).toMatch(/^5\.17\d* mm … 5\.62\d* mm \(/); // ±0.005 mm × (80+10)/2 = ±0.225 mm about 5.4
    const report = componentReports(m, analyzeMovement(m)).find((r) => r.id === wheel.id);
    expect(report?.tolerances).toHaveLength(1);
    expect(report?.tolerances[0]?.dimension).toBe("Module");
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

  it("draws the dial as a hidden outline and the stem with its pinions edge-on", () => {
    const dialCircle = drawing.primitives.find((p) => p.kind === "circle" && p.layer === "DIAL");
    expect(dialCircle?.kind === "circle" ? dialCircle.radius : Number.NaN).toBeCloseTo(14, 9);
    const keylessLines = drawing.primitives.filter((p) => p.kind === "line" && p.layer === "KEYLESS");
    expect(keylessLines).toHaveLength(3); // two pinions and the stem centre line
    const pinionLengths = keylessLines.map((p) => (p.kind === "line" ? Math.hypot(p.b.x - p.a.x, p.b.y - p.a.y) : 0)).sort((a, b) => a - b);
    expect(pinionLengths[0]).toBeCloseTo(1.4, 9); // winding pinion pitch Ø 0.1 × 14
    expect(pinionLengths[1]).toBeCloseTo(2.0, 9); // sliding pinion pitch Ø 0.1 × 20
    expect(drawing.notes.some((n) => n.includes("3 o'clock"))).toBe(true);
  });

  it("draws the escape wheel tip circle, the balance and the pallet arbor's centre lines", () => {
    const esc = drawing.primitives.filter((p) => p.layer === "ESCAPEMENT");
    expect(esc.flatMap((p) => (p.kind === "circle" ? [p.radius] : [])).sort()).toEqual([2.3, 3]);
    expect(esc.filter((p) => p.kind === "line")).toHaveLength(2);
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

  it("adds the worst case only for a mesh with a declared module or position tolerance (ASM-0027)", () => {
    const before = buildPlanDrawing(teaching, analysis).primitives.flatMap((p) => (p.kind === "dimension" ? [p.text] : []));
    expect(before.some((t) => t.includes("· tol"))).toBe(false);
    const wheel = byName(teaching.gears, "Centre wheel");
    const m = setTolerance(teaching, createTolerance({ entityId: wheel.id, dimension: "GEAR_MODULE", lowerDeviation: mm(-0.005), upperDeviation: mm(0.005) }));
    const after = buildPlanDrawing(m, analyzeMovement(m)).primitives.flatMap((p) => (p.kind === "dimension" ? [p.text] : []));
    expect(after.some((t) => /· tol 5\.17\d*…5\.62\d*/.test(t))).toBe(true);
    expect(after.filter((t) => t.includes("· tol"))).toHaveLength(1); // only the toleranced mesh gets the annotation
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

describe("elevation drawing", () => {
  const elevation = buildElevationDrawing(teaching, analysis);
  const polys = (layer: string): { x: number; y: number }[][] =>
    elevation.primitives.flatMap((p) => (p.kind === "polygon" && p.layer === layer ? [p.points] : []));
  const xExtent = (points: { x: number }[]): [number, number] => [Math.min(...points.map((p) => p.x)), Math.max(...points.map((p) => p.x))];
  const yExtent = (points: { y: number }[]): [number, number] => [Math.min(...points.map((p) => p.y)), Math.max(...points.map((p) => p.y))];

  it("lists every complete frame's axial position in the table, sorted bottom to top", () => {
    expect(elevation.gearTable.rows).toHaveLength(Object.keys(teaching.frames).length);
    expect(elevation.gearTable.rows[0]?.cells).toEqual(["Mainplate", "0.000", "1.000", "1.000"]);
    expect(elevation.gearTable.rows.slice(1).every((r) => r.cells[1] === "4.000" && r.cells[2] === "0.800" && r.cells[3] === "4.800")).toBe(true);
  });

  it("draws each frame as a body across its outline's X-extent at its Z-range", () => {
    const bodies = polys("FRAME");
    expect(bodies).toHaveLength(Object.keys(teaching.frames).length);
    const mainplate = bodies.find((pts) => { const [lo, hi] = yExtent(pts); return Math.abs(lo) < 1e-9 && Math.abs(hi - 1) < 1e-9; });
    if (mainplate === undefined) throw new Error("mainplate body not found");
    // Mainplate: circle centred (2.5, 0), radius 15 mm.
    expect(xExtent(mainplate)).toEqual([-12.5, 17.5]);
    const bridge = bodies.find((pts) => { const [lo, hi] = yExtent(pts); return Math.abs(lo - 4) < 1e-9 && Math.abs(hi - 4.8) < 1e-9; });
    if (bridge === undefined) throw new Error("a bridge-height body not found");
    // Train bridge polygon spans x ∈ [-8, 13].
    expect(xExtent(bridge)).toEqual([-8, 13]);
  });

  it("draws a body per gear at pitch diameter and thickness, and the escapement at tip/balance diameter", () => {
    expect(polys("GEAR")).toHaveLength(Object.keys(teaching.gears).length);
    const centreWheel = byName(teaching.gears, "Centre wheel");
    const body = polys("GEAR").find((pts) => Math.abs((xExtent(pts)[1] - xExtent(pts)[0]) / 2 - 4.8) < 1e-9);
    if (body === undefined) throw new Error("centre wheel body not found");
    expect(yExtent(body)).toEqual([toMillimetres(centreWheel.zCentre) - 0.1, toMillimetres(centreWheel.zCentre) + 0.1]);

    const esc = polys("ESCAPEMENT").map((pts) => (xExtent(pts)[1] - xExtent(pts)[0]) / 2).sort((a, b) => a - b);
    expect(esc[0]).toBeCloseTo(2.3, 9); // escape wheel tip radius
    expect(esc[1]).toBeCloseTo(3, 9); // balance radius — as on the plan
  });

  it("marks each bearing flush with its frame's inner face", () => {
    const lines = elevation.primitives.filter((p) => p.kind === "line" && p.layer === "JEWEL");
    expect(lines).toHaveLength(Object.keys(teaching.jewels).length);
    const axisX = (shaftName: string): number => {
      const shaft = byName(teaching.shafts, shaftName);
      const p = analysis.placement.shaftPositions.get(shaft.id);
      if (p === undefined) throw new Error(`${shaftName}: unplaced`);
      return toMillimetres(p.x);
    };
    const jewelZs = (shaftName: string): number[] => {
      const x = axisX(shaftName);
      return elevation.primitives
        .filter((p): p is Extract<typeof p, { kind: "line" }> => p.kind === "line" && p.layer === "JEWEL" && Math.abs((p.a.x + p.b.x) / 2 - x) < 1e-6)
        .map((p) => p.a.y)
        .sort((a, b) => a - b);
    };
    // Lower jewel at the mainplate's top face (1.0 mm), upper jewel at the train bridge's underside (4.0 mm).
    expect(jewelZs("Centre arbor")).toEqual([1, 4]);
  });

  it("dimensions the overall height, from the lowest frame face to the highest", () => {
    const dim = elevation.primitives.find((p) => p.kind === "dimension");
    expect(dim?.kind === "dimension" ? dim.text : "").toBe("4.800 overall");
  });

  it("adds an endshake dimension beside an arbor's centreline only where its endshake is toleranced (ASM-0017)", () => {
    expect(elevation.primitives.some((p) => p.kind === "dimension" && p.text.startsWith("endshake"))).toBe(false);
    // The teaching movement leaves shoulder span unknown, so use the demo movement, which has it entered.
    const demoM = createDemoMovement();
    const arborA = byName(demoM.shafts, "Arbor A");
    const bridge = byName(demoM.frames, "Train bridge");
    let m: Movement = updateShaft(demoM, arborA.id, { shoulderSpan: mm(1.97) });
    m = setTolerance(m, createTolerance({ entityId: bridge.id, dimension: "FRAME_Z_BOTTOM", lowerDeviation: mm(-0.01), upperDeviation: mm(0.01) }));
    const withTol = buildElevationDrawing(m, analyzeMovement(m));
    const axis = analyzeMovement(m).placement.shaftPositions.get(arborA.id);
    if (axis === undefined) throw new Error("arbor A unplaced");
    const x = toMillimetres(axis.x);
    const dim = withTol.primitives.find((p) => p.kind === "dimension" && p.text.startsWith("endshake") && Math.abs(p.a.x - x) < 1e-6);
    if (dim?.kind !== "dimension") throw new Error("no endshake dimension for arbor A");
    // Mainplate top face (1.0 mm) to train bridge underside (3.0 mm); nominal endshake (2 − 1.97) mm ± 0.01 mm.
    expect(dim.a.y).toBeCloseTo(1, 9);
    expect(dim.b.y).toBeCloseTo(3, 9);
    expect(dim.text).toBe("endshake 0.020…0.040");
  });

  it("draws the dial as a hidden band and omits the keyless works and stem", () => {
    const dial = polys("DIAL")[0];
    if (dial === undefined) throw new Error("no dial body");
    expect((xExtent(dial)[1] - xExtent(dial)[0]) / 2).toBeCloseTo(14, 9);
    expect(yExtent(dial)).toEqual([-1.8, -1.4]);
    expect(elevation.primitives.some((p) => p.layer === "KEYLESS")).toBe(false);
    expect(elevation.notes.join(" ")).toMatch(/keyless works, stem/);
  });

  it("states that it is nominal and not a manufacturing drawing", () => {
    expect(elevation.notes.join(" ")).toMatch(/MFG-001/);
    expect(elevation.notes.join(" ")).toMatch(/MFG-002/);
    expect(elevation.notes.join(" ")).toMatch(/ASM-0009/);
    expect(elevation.viewLabel).toBe("elevation (X-Z)");
  });

  it("renders as well-formed SVG and DXF with no NaN", () => {
    const svg = renderPlanSvg(elevation, { generatedAt: at.toISOString() });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).not.toContain("NaN");
    expect(svg).toContain("elevation (X-Z)");
    const dxf = renderPlanDxf(elevation);
    expect(dxf).not.toContain("NaN");
  });

  it("handles an empty movement", () => {
    const empty = createEmptyMovement();
    const d = buildElevationDrawing(empty, analyzeMovement(empty));
    expect(d.bounds).toBeNull();
    expect(renderPlanSvg(d, { generatedAt: "x" })).toContain("Nothing to draw");
  });
});

describe("STL (visual, L0)", () => {
  it("writes one solid per complete frame and valid gear, in millimetres", () => {
    const stl = buildStl(teaching, analysis);
    expect(stl.solids).toBe(Object.keys(teaching.frames).length + Object.keys(teaching.gears).length + Object.keys(teaching.dials).length);
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

  it("reports the balance's free frequency and predicted rate at L3", () => {
    const esc = componentReports(teaching, analysis).find((c) => c.kind === "Escapement");
    const free = esc?.derived.find((d) => d.label === "Free balance frequency");
    expect(free?.level).toBe("L3_SIMPLIFIED_DYNAMIC");
    expect(free?.references).toContain("ASM-0024");
    // Under the nominal-time variant used here, the rate is what it would be if the balance governed.
    expect(esc?.derived.find((d) => d.label === "Daily rate if the balance governed")?.text).toBe("-7.02 s/day");
  });

  it("reports the escapement as a simplified model with its derived beat rate", () => {
    expect(html).toContain("Escapement: SIMPLIFIED ESCAPEMENT MODEL");
    expect(html).toContain("18000 beats/h");
    expect(html).toContain("rate accuracy is not modeled");
    const esc = componentReports(teaching, analysis).find((c) => c.kind === "Escapement");
    expect(esc?.derived.find((d) => d.label === "Beat rate")?.si).toBeCloseTo(5, 12); // 18 000 / 3600 Hz
  });

  it("reports pallet geometry at L1 and the energy chain at L3, naming what the amplitude still needs", () => {
    const esc = componentReports(teaching, analysis).find((c) => c.kind === "Escapement");
    const value = (label: string): ReportValue | undefined => esc?.derived.find((d) => d.label === label);
    // 2.3 mm tip radius, 3.5 of 15 teeth = 84°: 2.3 / cos 42°.
    expect(value("Pallet arbor distance for tangential locking")?.si).toBeCloseTo(2.3e-3 / Math.cos((42 * Math.PI) / 180), 12);
    expect(value("Pallet span angle")?.level).toBe("L1_GEOMETRIC");
    expect((value("Power reserve")?.si ?? 0) / 3600).toBeCloseTo(39, 9);
    expect(value("Escape wheel torque, fully wound")?.text).toContain("lossless upper bound");
    expect(value("Predicted amplitude, fully wound → let down")?.text).toBe("needs escapement efficiency, balance quality factor Q");
    expect(value("Predicted amplitude, fully wound → let down")?.level).toBe("L3_SIMPLIFIED_DYNAMIC");
    expect(html).toContain("simplified tangential locking (L1, ASM-0025)");
    const bom = buildBom(teaching);
    expect(bom.find((r) => r.name === "Pallet stones")?.specification).toBe("span 3.5 teeth, lock 2.0°, draw 12.0°, run 0.5° (entered)");
    expect(bom.some((r) => r.notes.includes("6.5 turns, 10.00 → 6.00 N·mm (entered, ASM-0026)"))).toBe(true);
  });

  it("reports the crown: winding direction and ratios", () => {
    expect(html).toContain("Keyless works: crown");
    expect(html).toContain("Ratchet per crown revolution (winding)");
    expect(html).toContain("0.350000 rev");
    expect(html).toContain("<td>Winding direction</td><td>clockwise seen from the crown; the other way the ratchet teeth slip");
    expect(html).toContain("2.000000 rev");
  });

  it("contains the plan drawing, elevation drawing, BOM, component reports and assumption register", () => {
    expect(html).toContain("<svg");
    expect(html).toContain("Elevation drawing");
    expect(html).toContain("Bill of materials");
    expect(html).toContain("Centre wheel");
    expect(html).toContain("ASM-0017");
  });

  it("adds a mesh centre-distance tolerance column only once something is toleranced", () => {
    expect(html).not.toContain("Worst case (tol., ASM-0027)");
    const wheel = byName(teaching.gears, "Centre wheel");
    const m = setTolerance(teaching, createTolerance({ entityId: wheel.id, dimension: "GEAR_MODULE", lowerDeviation: mm(-0.005), upperDeviation: mm(0.005) }));
    const withTol = renderMovementReport(m, analyzeMovement(m), { generatedAt: at });
    expect(withTol).toContain("Worst case (tol., ASM-0027)");
    expect(withTol).toMatch(/5\.17\d* mm … 5\.62\d* mm/);
    expect(withTol).toContain("nominal only"); // the other mesh has no tolerance declared
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
