import type { Movement } from "@/domain/movement";
import { numberToHex } from "@/domain/appearance";
import type { HandFunction } from "@/domain/shaft";
import { DIAL_VISUALIZATION, dialMarkerPlacements, HAND_VISUALIZATION } from "@/geometry/assemblyGeometry3d";
import { solvePlacement } from "@/kinematics/solvePlacement";
import { NIGHT_MODE } from "@/viewport/nightMode";
import { COLORS } from "@/viewport/viewport";

/**
 * A picture of a saved movement for the carousel (follow-up 53, ASM-0097): its dial as drawn from the design's own data,
 * the dial's size, colour, hour markers and their top-layer colour or lume, the dial windows, and the hands in their own
 * colours. It is drawn from the saved design, not rendered by the 3D viewport, and shows nothing the design does not say.
 * Positions are in units of the dial's radius, on the dial as seen from the front: x to the right, y down (12 o'clock at
 * the top). Presentation only; nothing reads it back.
 */
export interface PortraitMarker {
  readonly x: number;
  readonly y: number;
  /** Radius of the marker's circle (the triangle at 12 is inscribed in it). */
  readonly radius: number;
  readonly shape: "CIRCLE" | "TRIANGLE_DOWN";
}

export interface PortraitWindow {
  readonly x: number;
  readonly y: number;
  readonly shape: "CIRCLE" | "RECTANGLE";
  /** Circle radius, or half the width and height of a rectangle. */
  readonly halfWidth: number;
  readonly halfHeight: number;
}

export interface PortraitHand {
  readonly kind: HandFunction;
  /** The hand's pivot. */
  readonly x: number;
  readonly y: number;
  /** Clockwise from 12 o'clock. */
  readonly angle: number;
  readonly length: number;
  readonly width: number;
  readonly colour: string;
}

export interface Portrait {
  readonly dialColour: string;
  readonly markerTop: string;
  readonly markerMetal: string;
  readonly lume: boolean;
  readonly textured: boolean;
  readonly markers: readonly PortraitMarker[];
  readonly windows: readonly PortraitWindow[];
  readonly hands: readonly PortraitHand[];
}

/** The time the hands are drawn at (the classic 10:10:35), so every portrait shows its hands the same way. */
export const PORTRAIT_TIME = { hours: 10, minutes: 10, seconds: 35 } as const;

const TURN = 2 * Math.PI;

/** Where each hand points for `PORTRAIT_TIME` (radians clockwise from 12). */
export function portraitHandAngle(kind: HandFunction): number {
  const { hours, minutes, seconds } = PORTRAIT_TIME;
  if (kind === "SECONDS") return (seconds / 60) * TURN;
  if (kind === "MINUTES") return ((minutes + seconds / 60) / 60) * TURN;
  return (((hours % 12) + minutes / 60 + seconds / 3600) / 12) * TURN;
}

/** The portrait of a movement's first dial, or null if it has none that can be drawn (no dial, or one with no place). */
export function movementPortrait(movement: Movement): Portrait | null {
  const dial = Object.values(movement.dials)[0];
  if (dial === undefined || !(dial.diameter > 0)) return null;
  const placement = solvePlacement(movement);
  const centre = placement.shaftPositions.get(dial.centreShaftId);
  if (centre === undefined) return null;
  const radius = dial.diameter / 2;
  const look = movement.appearance;
  // The dial is read from its -Z side, so world -X is the screen's right and world +Y is up the screen.
  const toScreen = (x: number, y: number): { x: number; y: number } => ({ x: -(x - centre.x) / radius, y: -(y - centre.y) / radius });

  const lume = look.hourMarkerLume;
  const markers = dialMarkerPlacements(radius).map((m): PortraitMarker => {
    const at = toScreen(centre.x + m.x, centre.y + m.y);
    return { x: at.x, y: at.y, radius: m.radiusMetres / radius, shape: m.shape };
  });

  const windows = Object.values(movement.dialWindows)
    .filter((w) => w.dialId === dial.id)
    .map((w): PortraitWindow => {
      const at = toScreen(w.centre.x, w.centre.y);
      return w.outline.kind === "CIRCLE"
        ? { ...at, shape: "CIRCLE", halfWidth: w.outline.radius / radius, halfHeight: w.outline.radius / radius }
        : { ...at, shape: "RECTANGLE", halfWidth: w.outline.width / 2 / radius, halfHeight: w.outline.height / 2 / radius };
    });

  const handColour = (kind: HandFunction): string => {
    const chosen = kind === "HOURS" ? look.hourHand : kind === "MINUTES" ? look.minuteHand : look.secondsHand;
    return chosen ?? numberToHex(COLORS.hand[kind]);
  };
  const hands: PortraitHand[] = [];
  for (const shaft of Object.values(movement.shafts)) {
    if (shaft.hand === null) continue;
    const pivot = placement.shaftPositions.get(shaft.id);
    if (pivot === undefined) continue;
    const at = toScreen(pivot.x, pivot.y);
    const spec = HAND_VISUALIZATION[shaft.hand];
    hands.push({ kind: shaft.hand, ...at, angle: portraitHandAngle(shaft.hand), length: spec.lengthMetres / radius, width: spec.widthMetres / radius, colour: handColour(shaft.hand) });
  }
  // Longest underneath, so the seconds hand (thin and short) is not hidden by the others.
  hands.sort((a, b) => b.length - a.length);

  return {
    dialColour: look.dial ?? numberToHex(COLORS.dial),
    markerTop: lume ? numberToHex(NIGHT_MODE.lumeDayColour) : (look.hourMarkers ?? numberToHex(COLORS.dialMarker)),
    markerMetal: numberToHex(DIAL_VISUALIZATION.indexMetalColor),
    lume,
    textured: look.dialTexture.kind !== "NONE",
    markers,
    windows,
    hands,
  };
}

const SVG = "http://www.w3.org/2000/svg";

function node<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string | number>): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
  return element;
}

/** Draws a portrait as an SVG (one canvas stays the only canvas on the page), 100 units across with the dial centred. */
export function portraitSvg(portrait: Portrait): SVGSVGElement {
  const unit = 46; // the dial's radius in SVG units, leaving room for its rim
  const svg = node("svg", { viewBox: "-50 -50 100 100", role: "img", "aria-hidden": "true", class: "carousel-portrait" });
  const at = (v: number): number => Math.round(v * unit * 1000) / 1000;
  const f = (v: number): string => String(Math.round(v * 1000) / 1000);
  svg.append(node("circle", { r: unit + 2, fill: "#10151b", stroke: "#3a4652", "stroke-width": 0.8 }));
  svg.append(node("circle", { r: unit, fill: portrait.dialColour }));
  // A soft sheen so the dial reads as a lit surface; a textured dial also gets fine concentric rings.
  const sheen = node("radialGradient", { id: "carousel-sheen", cx: "35%", cy: "30%", r: "80%" });
  sheen.append(node("stop", { offset: "0", "stop-color": "#ffffff", "stop-opacity": 0.28 }), node("stop", { offset: "1", "stop-color": "#000000", "stop-opacity": 0.22 }));
  const defs = node("defs", {});
  defs.append(sheen);
  svg.append(defs, node("circle", { r: unit, fill: "url(#carousel-sheen)" }));
  if (portrait.textured) {
    for (let r = 4; r < unit; r += 4) svg.append(node("circle", { r, fill: "none", stroke: "#000000", "stroke-opacity": 0.07, "stroke-width": 0.5 }));
  }
  for (const w of portrait.windows) {
    if (w.shape === "CIRCLE") svg.append(node("circle", { cx: at(w.x), cy: at(w.y), r: at(w.halfWidth), fill: "#1a2530", stroke: "#0b0f14", "stroke-width": 0.6 }));
    else svg.append(node("rect", { x: at(w.x - w.halfWidth), y: at(w.y - w.halfHeight), width: at(w.halfWidth * 2), height: at(w.halfHeight * 2), fill: "#1a2530", stroke: "#0b0f14", "stroke-width": 0.6 }));
  }
  for (const m of portrait.markers) {
    const cx = at(m.x);
    const cy = at(m.y);
    const r = at(m.radius);
    if (m.shape === "CIRCLE") {
      svg.append(node("circle", { cx, cy, r, fill: portrait.markerMetal }), node("circle", { cx, cy, r: r * DIAL_VISUALIZATION.indexTopLayerFraction, fill: portrait.markerTop }));
    } else {
      const points = (k: number): string => {
        const half = (r * k * Math.sqrt(3)) / 2;
        return `${f(cx - half)},${f(cy - (r * k) / 2)} ${f(cx + half)},${f(cy - (r * k) / 2)} ${f(cx)},${f(cy + r * k)}`;
      };
      svg.append(node("polygon", { points: points(1), fill: portrait.markerMetal }), node("polygon", { points: points(DIAL_VISUALIZATION.indexTopLayerFraction), fill: portrait.markerTop }));
    }
  }
  for (const h of portrait.hands) {
    const length = at(h.length);
    const width = Math.max(0.9, at(h.width) * (h.kind === "SECONDS" ? 1 : 1.6));
    const group = node("g", { transform: `translate(${f(at(h.x))} ${f(at(h.y))}) rotate(${f((h.angle * 180) / Math.PI)})` });
    group.append(node("polygon", { points: `${f(-width / 2)},${f(length * 0.18)} ${f(width / 2)},${f(length * 0.18)} ${f(width * 0.3)},${f(-length * 0.9)} 0,${f(-length)}`, fill: h.colour, stroke: "#00000055", "stroke-width": 0.3 }));
    svg.append(group);
  }
  const hub = portrait.hands[0];
  if (hub !== undefined) svg.append(node("circle", { cx: at(hub.x), cy: at(hub.y), r: 1.4, fill: "#10151b" }));
  return svg;
}
