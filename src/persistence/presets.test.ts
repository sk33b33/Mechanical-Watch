import { describe, expect, it } from "vitest";
import { millimetres, toMillimetres } from "@/units/length";
import type { KeyValueStore } from "./autosave";
import { deletePreset, listPresets, PRESETS_KEY, PRESETS_RECOVERY_KEY, savePreset } from "./presets";

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => { data[k] = v; },
    removeItem: (k) => { Reflect.deleteProperty(data, k); },
  };
}

const unwrap = <T>(result: { ok: true; value: T } | { ok: false; reason: string }): T => {
  if (!result.ok) throw new Error(result.reason);
  return result.value;
};

describe("part presets", () => {
  it("saves and lists presets of one kind, newest first", () => {
    const store = memoryStore();
    unwrap(savePreset(store, { kind: "Shaft", name: "Train pivot", values: { pivotDiameterLower: millimetres(0.09), pivotDiameterUpper: millimetres(0.09), shoulderSpan: millimetres(1.9) } }));
    unwrap(savePreset(store, { kind: "Shaft", name: "Escapement pivot", values: { pivotDiameterLower: millimetres(0.08), pivotDiameterUpper: millimetres(0.08), shoulderSpan: millimetres(1.5) } }));

    const shaftPresets = unwrap(listPresets(store, "Shaft"));
    expect(shaftPresets.map((p) => p.name)).toEqual(["Escapement pivot", "Train pivot"]);
    const trainPivot = shaftPresets[1];
    if (trainPivot?.values.pivotDiameterLower == null) throw new Error("expected a train pivot preset");
    expect(toMillimetres(trainPivot.values.pivotDiameterLower)).toBeCloseTo(0.09, 12);
  });

  it("keeps presets of different kinds separate", () => {
    const store = memoryStore();
    unwrap(savePreset(store, { kind: "Gear", name: "Train module", values: { module: millimetres(0.12), thickness: millimetres(0.2) } }));
    unwrap(savePreset(store, { kind: "Jewel", name: "Standard hole jewel", values: { boreDiameter: millimetres(0.1) } }));

    expect(unwrap(listPresets(store, "Gear"))).toHaveLength(1);
    expect(unwrap(listPresets(store, "Jewel"))).toHaveLength(1);
    expect(unwrap(listPresets(store, "Frame"))).toHaveLength(0);
  });

  it("deletes a preset by id", () => {
    const store = memoryStore();
    unwrap(savePreset(store, { kind: "Frame", name: "Standard bridge", values: { thickness: millimetres(0.8) } }));
    const [preset] = unwrap(listPresets(store, "Frame"));
    if (preset === undefined) throw new Error("expected a saved preset");
    unwrap(deletePreset(store, preset.id));
    expect(unwrap(listPresets(store, "Frame"))).toEqual([]);
  });

  it("a preset can leave fields unset (null), to be applied selectively", () => {
    const store = memoryStore();
    unwrap(savePreset(store, { kind: "Shaft", name: "Pivots only", values: { pivotDiameterLower: millimetres(0.09), pivotDiameterUpper: millimetres(0.09), shoulderSpan: null } }));
    const [preset] = unwrap(listPresets(store, "Shaft"));
    if (preset === undefined) throw new Error("expected a saved preset");
    expect(preset.values.shoulderSpan).toBeNull();
  });

  it("an unreadable store is set aside, not overwritten, and reported", () => {
    const store = memoryStore({ [PRESETS_KEY]: "not json" });
    const result = listPresets(store, "Shaft");
    expect(result.ok).toBe(false);
    expect(store.data[PRESETS_RECOVERY_KEY]).toBe("not json");
    expect(store.data[PRESETS_KEY]).toBeUndefined();
  });

  it("reports when browser storage is unavailable, without throwing", () => {
    expect(listPresets(null, "Shaft")).toEqual({ ok: false, reason: "Browser storage is not available." });
    expect(savePreset(null, { kind: "Gear", name: "x", values: { module: null, thickness: null } })).toEqual({
      ok: false,
      reason: "Browser storage is not available.",
    });
  });
});
