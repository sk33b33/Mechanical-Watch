import { describe, expect, it } from "vitest";
import { createTeachingMovement } from "@/app/teachingMovement";
import { createMovement, setDialColour, setDialTexture, setWheelColour, resetAppearance } from "./movement";
import { DIAL_TEXTURE, encodeHeights, type DialTexture } from "@/geometry/dialTexture";
import { appearanceKeyFor, colourableWheels, hexToNumber, isHexColour, numberToHex, wheelAppearance } from "./appearance";
import { decodeDesign, encodeDesign, DESIGN_SCHEMA_VERSION } from "@/persistence/designFile";

const teaching = createTeachingMovement();

describe("appearance (ASM-0090)", () => {
  it("accepts only #rrggbb colours and converts them to and from numbers", () => {
    expect(isHexColour("#1a2B3c")).toBe(true);
    for (const bad of ["1a2b3c", "#12345", "#1234567", "red", "#gg0000", "", null, 5]) expect(isHexColour(bad)).toBe(false);
    expect(hexToNumber("#ff8000")).toBe(0xff8000);
    expect(numberToHex(0x0080ff)).toBe("#0080ff");
    expect(numberToHex(hexToNumber("#abcdef"))).toBe("#abcdef");
  });

  it("a new movement has nothing chosen", () => {
    const m = createMovement("x", false);
    expect(m.appearance.dial).toBeNull();
    expect(m.appearance.wheels).toEqual({});
  });

  it("sets and clears a dial colour, rejects a bad one, and leaves the input design untouched", () => {
    const set = setDialColour(teaching, "dial", "#102030");
    expect(set.appearance.dial).toBe("#102030");
    expect(teaching.appearance.dial).toBeNull();
    expect(setDialColour(set, "dial", null).appearance.dial).toBeNull();
    expect(() => setDialColour(teaching, "dial", "blue")).toThrow();
    for (const key of ["hourMarkers", "hourMarkerDigits", "dialPrint", "secondsHand", "minuteHand", "hourHand"] as const) {
      expect(setDialColour(teaching, key, "#aabbcc").appearance[key]).toBe("#aabbcc");
    }
  });

  it("offers each wheel a dial window shows, once, with the four year digits as one", () => {
    const wheels = colourableWheels(teaching);
    expect(wheels.map((w) => w.name)).toEqual(expect.arrayContaining(["Moon wheel", "Date", "Day of week", "Month", "Leap year", "Season", "Year digits"]));
    expect(wheels).toHaveLength(7);
    // The moon wheel's text colour is the colour of its printed moon phases; every other wheel's is its text.
    expect(wheels.filter((w) => w.textLabel === "Moon phases").map((w) => w.name)).toEqual(["Moon wheel"]);
    expect(wheels.filter((w) => w.textLabel === "Text")).toHaveLength(6);
    expect(new Set(wheels.map((w) => w.key)).size).toBe(7);
  });

  it("stores a wheel's body and text separately, and drops its entry when both are cleared", () => {
    const date = Object.values(teaching.dateComplications).find((d) => d.name === "Date");
    if (date === undefined) throw new Error("no date");
    const a = setWheelColour(teaching, date.id, "body", "#112233");
    const b = setWheelColour(a, date.id, "text", "#445566");
    expect(wheelAppearance(b, date.id)).toEqual({ body: "#112233", text: "#445566" });
    const c = setWheelColour(setWheelColour(b, date.id, "body", null), date.id, "text", null);
    expect(c.appearance.wheels).toEqual({});
    expect(() => setWheelColour(teaching, date.id, "body", "nope")).toThrow();
  });

  it("the four year-digit barrels share one set of colours", () => {
    const digits = Object.values(teaching.yearDigitComplications);
    expect(digits).toHaveLength(4);
    const key = appearanceKeyFor(teaching, digits[0]?.id ?? "");
    for (const d of digits) expect(appearanceKeyFor(teaching, d.id)).toBe(key);
    const painted = setWheelColour(teaching, digits[2]?.id ?? "", "body", "#0a0b0c");
    for (const d of digits) expect(wheelAppearance(painted, d.id).body).toBe("#0a0b0c");
  });

  it("reset puts everything back", () => {
    const painted = setDialColour(setWheelColour(teaching, Object.keys(teaching.moonPhases)[0] ?? "", "text", "#010203"), "minuteHand", "#040506");
    const reset = resetAppearance(painted);
    expect(reset.appearance.minuteHand).toBeNull();
    expect(reset.appearance.wheels).toEqual({});
  });
});

describe("appearance in a saved design (schema v37, ASM-0090, ASM-0094)", () => {
  it("round-trips every chosen colour", () => {
    const date = Object.values(teaching.dateComplications)[0];
    let m = setDialColour(teaching, "dial", "#101010");
    m = setDialColour(m, "hourHand", "#202020");
    m = setWheelColour(m, date?.id ?? "", "body", "#303030");
    m = setWheelColour(m, date?.id ?? "", "text", "#404040");
    const loaded = decodeDesign(encodeDesign(m));
    expect(loaded.appearance).toEqual(m.appearance);
  });

  it("an older (v34) file opens with nothing chosen", () => {
    expect(DESIGN_SCHEMA_VERSION).toBe(37);
    const doc = JSON.parse(encodeDesign(teaching)) as { schemaVersion: number; movement: Record<string, unknown> };
    Reflect.deleteProperty(doc.movement, "appearance");
    const loaded = decodeDesign(JSON.stringify({ ...doc, schemaVersion: 34 }));
    expect(loaded.appearance.dial).toBeNull();
    expect(loaded.appearance.wheels).toEqual({});
  });

  it("a v35 file (no seconds-hand colour yet) opens with the seconds hand unchosen, other colours kept", () => {
    const doc = JSON.parse(encodeDesign(setDialColour(teaching, "hourHand", "#202020"))) as { schemaVersion: number; movement: { appearance: Record<string, unknown> } };
    Reflect.deleteProperty(doc.movement.appearance, "secondsHand");
    const loaded = decodeDesign(JSON.stringify({ ...doc, schemaVersion: 35 }));
    expect(loaded.appearance.secondsHand).toBeNull();
    expect(loaded.appearance.hourHand).toBe("#202020");
  });

  it("rejects a file with a malformed colour", () => {
    const doc = JSON.parse(encodeDesign(setDialColour(teaching, "dial", "#101010"))) as { movement: { appearance: { dial: string } } };
    doc.movement.appearance.dial = "not-a-colour";
    expect(() => decodeDesign(JSON.stringify(doc))).toThrow(/colour/);
  });
});

describe("dial texture (follow-up 50, ASM-0094)", () => {
  const size = DIAL_TEXTURE.importedSizePx;
  const imported: DialTexture = { kind: "IMPORTED", name: "leather.png", size, data: encodeHeights(new Uint8Array(size * size).map((_, i) => (i * 13) % 256)) };

  it("starts smooth, and is set and cleared as an undoable change that leaves the input design alone", () => {
    expect(createMovement("m", false).appearance.dialTexture).toEqual({ kind: "NONE" });
    const textured = setDialTexture(teaching, { kind: "BUILT_IN", id: "CLOUS_DE_PARIS" });
    expect(textured.appearance.dialTexture).toEqual({ kind: "BUILT_IN", id: "CLOUS_DE_PARIS" });
    expect(teaching.appearance.dialTexture).toEqual({ kind: "NONE" });
    expect(setDialTexture(textured, { kind: "NONE" }).appearance.dialTexture).toEqual({ kind: "NONE" });
  });

  it("the dial's colour and its texture are independent: changing the colour leaves the texture, and the texture carries no colour", () => {
    const m = setDialColour(setDialTexture(teaching, { kind: "BUILT_IN", id: "SUNBURST" }), "dial", "#204060");
    expect(m.appearance.dialTexture).toEqual({ kind: "BUILT_IN", id: "SUNBURST" });
    expect(m.appearance.dial).toBe("#204060");
    expect(JSON.stringify(m.appearance.dialTexture)).not.toMatch(/#[0-9a-f]{6}/i);
  });

  it("'reset all colours' puts the colours back and keeps the chosen texture", () => {
    const painted = setDialColour(setDialTexture(teaching, { kind: "BUILT_IN", id: "LINEN" }), "dial", "#101010");
    const reset = resetAppearance(painted);
    expect(reset.appearance.dial).toBeNull();
    expect(reset.appearance.dialTexture).toEqual({ kind: "BUILT_IN", id: "LINEN" });
  });

  it("rejects an unknown built-in texture, bad height data, and an empty or over-long name", () => {
    expect(() => setDialTexture(teaching, { kind: "BUILT_IN", id: "NOPE" as never })).toThrow();
    expect(() => setDialTexture(teaching, { ...imported, data: "AAAA" })).toThrow(/height map/);
    expect(() => setDialTexture(teaching, { ...imported, name: "  " })).toThrow(/name/);
    expect(() => setDialTexture(teaching, { ...imported, name: "x".repeat(61) })).toThrow(/name/);
    expect(setDialTexture(teaching, imported).appearance.dialTexture).toEqual(imported);
  });

  it("round-trips a built-in and an imported texture through the saved design", () => {
    for (const texture of [{ kind: "BUILT_IN", id: "HONEYCOMB" } as DialTexture, imported]) {
      const m = setDialTexture(teaching, texture);
      expect(decodeDesign(encodeDesign(m)).appearance.dialTexture).toEqual(texture);
    }
  });

  it("a v36 file (no texture yet) opens smooth with its colours kept; a malformed texture is refused", () => {
    const doc = JSON.parse(encodeDesign(setDialColour(teaching, "dial", "#336699"))) as { schemaVersion: number; movement: { appearance: Record<string, unknown> } };
    Reflect.deleteProperty(doc.movement.appearance, "dialTexture");
    const loaded = decodeDesign(JSON.stringify({ ...doc, schemaVersion: 36 }));
    expect(loaded.appearance.dialTexture).toEqual({ kind: "NONE" });
    expect(loaded.appearance.dial).toBe("#336699");
    const bad = JSON.parse(encodeDesign(setDialTexture(teaching, imported))) as { movement: { appearance: { dialTexture: { data: string } } } };
    bad.movement.appearance.dialTexture.data = "AAAA";
    expect(() => decodeDesign(JSON.stringify(bad))).toThrow(/height bytes/);
    const unknown = JSON.parse(encodeDesign(setDialTexture(teaching, { kind: "BUILT_IN", id: "LINEN" }))) as { movement: { appearance: { dialTexture: { id: string } } } };
    unknown.movement.appearance.dialTexture.id = "MARBLE";
    expect(() => decodeDesign(JSON.stringify(unknown))).toThrow(/one of/);
  });
});
