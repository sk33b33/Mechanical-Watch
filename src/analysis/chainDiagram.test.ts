import { describe, expect, it } from "vitest";
import { createTeachingMovement } from "@/app/teachingMovement";
import { AppStore } from "@/app/store";
import { createMovement, addShaft } from "@/domain/movement";
import { createShaft, fixedAt } from "@/domain/shaft";
import { millimetres } from "@/units/length";
import { solveGearTrain } from "@/kinematics/solveGearTrain";
import { buildChainDiagram, CHAIN_LAYOUT, chainNodeHeight, type ChainDiagram } from "./chainDiagram";

const store = new AppStore(createTeachingMovement());
const diagram = buildChainDiagram(store.movement, store.analysis.train);
const node = (title: string): ChainDiagram["nodes"][number] => {
  const n = diagram.nodes.find((x) => x.title === title);
  if (n === undefined) throw new Error(`no node ${title}`);
  return n;
};
const edge = (from: string, to: string): ChainDiagram["edges"][number] | undefined =>
  diagram.edges.find((e) => e.from === node(from).id && e.to === node(to).id);

describe("chain diagram (ASM-0086), generated from the model", () => {
  it("connects every part of the teaching movement to the mainspring", () => {
    expect(diagram.disconnected).toEqual([]);
    expect(diagram.nodes.some((n) => n.kind === "ISOLATED")).toBe(false);
  });

  it("shows the going train with its real tooth ratios, driving : driven", () => {
    expect(edge("Barrel", "Centre arbor")?.label).toBe("72 : 12");
    expect(edge("Centre arbor", "Third arbor")?.label).toBe("80 : 10");
    expect(edge("Third arbor", "Fourth arbor")?.label).toBe("75 : 10");
    expect(edge("Fourth arbor", "Escape arbor")?.label).toBe("80 : 8");
  });

  it("shows the motion works: cannon pinion by friction clutch, then minute wheel, then hour wheel", () => {
    expect((edge("Centre arbor", "Cannon pinion") ?? edge("Cannon pinion", "Centre arbor"))?.kind).toBe("CLUTCH");
    expect(edge("Cannon pinion", "Minute wheel")?.label).toBe("10 : 30");
    expect(edge("Minute wheel", "Hour wheel")?.label).toBe("8 : 32");
  });

  it("labels the hands and gives each arbor's solved speed", () => {
    expect(node("Cannon pinion").badges).toContain("Minute hand");
    expect(node("Fourth arbor").badges).toContain("Seconds hand");
    expect(node("Hour wheel").badges).toContain("Hour hand");
    expect(node("Fourth arbor").speed).toMatch(/^1 rev per 60\.0\d* s$/);
    expect(node("Hour wheel").speed).toContain("12.00");
  });

  it("feeds the escapement from the escape arbor and reports the model's beat rate", () => {
    const escapement = diagram.nodes.find((n) => n.kind === "ESCAPEMENT");
    expect(escapement?.speed).toBe("5.00 beats per second");
    expect(diagram.edges.find((e) => e.to === escapement?.id)?.kind).toBe("ESCAPE");
    // The pallet arbor and balance staff are inside it, not separate parts.
    expect(diagram.nodes.some((n) => n.title === "Pallet arbor" || n.title === "Balance staff")).toBe(false);
  });

  it("links the calendar by jumps: 24-hour arbor to the date and day stars, date to month, month to leap year, season and year digits", () => {
    expect(edge("24-hour arbor", "Date")?.kind).toBe("JUMP");
    expect(edge("24-hour arbor", "Day of week")?.kind).toBe("JUMP");
    expect(edge("Date", "Month")?.label).toBe("at month end");
    expect(edge("Month", "Leap year")?.kind).toBe("JUMP");
    expect(edge("Month", "Season")?.kind).toBe("JUMP");
    expect(edge("Month", "Year digits")?.label).toContain("carry");
  });

  it("puts the mainspring first and lays columns out left to right without overlap", () => {
    const spring = diagram.nodes.find((n) => n.kind === "SPRING");
    expect(spring?.column).toBe(0);
    for (const a of diagram.nodes) {
      for (const b of diagram.nodes) {
        if (a === b || a.column !== b.column) continue;
        const separated = a.y + chainNodeHeight(a) <= b.y || b.y + chainNodeHeight(b) <= a.y;
        expect(separated, `${a.title} / ${b.title}`).toBe(true);
      }
    }
    expect(diagram.width).toBeGreaterThan(CHAIN_LAYOUT.nodeWidth);
  });

  it("reports a part nothing connects to, instead of hiding it", () => {
    const base = createMovement("Loose", false);
    const loose = addShaft(addShaft(base, createShaft("Alone A", fixedAt(millimetres(0), millimetres(0)))), createShaft("Alone B", fixedAt(millimetres(5), millimetres(0))));
    const d = buildChainDiagram(loose, solveGearTrain(loose));
    expect(d.disconnected).toEqual(["Alone B"]);
    expect(d.nodes.find((n) => n.title === "Alone B")?.kind).toBe("ISOLATED");
  });
});

describe("top-down layout for printing", () => {
  const down = buildChainDiagram(store.movement, store.analysis.train, "TOP_DOWN");

  it("has the same parts and connections as the left-to-right layout, as rows read downward", () => {
    expect(down.orientation).toBe("TOP_DOWN");
    expect(down.nodes.map((n) => n.id).sort()).toEqual(diagram.nodes.map((n) => n.id).sort());
    expect(down.edges).toEqual(diagram.edges);
    const spring = down.nodes.find((n) => n.kind === "SPRING");
    expect(spring?.y).toBe(CHAIN_LAYOUT.margin);
    for (const n of down.nodes) {
      const lr = diagram.nodes.find((m) => m.id === n.id);
      expect(n.column).toBe(lr?.column);
    }
  });

  it("is narrow enough for a portrait page: far taller than wide, unlike the on-screen layout", () => {
    expect(down.width / down.height).toBeLessThan(1);
    expect(diagram.width / diagram.height).toBeGreaterThan(down.width / down.height);
  });

  it("does not overlap parts on a level or between levels", () => {
    for (const a of down.nodes) {
      for (const b of down.nodes) {
        if (a === b) continue;
        const apartX = a.x + CHAIN_LAYOUT.nodeWidth <= b.x || b.x + CHAIN_LAYOUT.nodeWidth <= a.x;
        const apartY = a.y + chainNodeHeight(a) <= b.y || b.y + chainNodeHeight(b) <= a.y;
        expect(apartX || apartY, `${a.title} / ${b.title}`).toBe(true);
      }
    }
  });
});
