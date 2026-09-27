import type { Length } from "@/units/length";
import type { KeyValueStore } from "./autosave";

/**
 * Reusable part presets, entered by the user and applied to other parts of
 * the same kind (never invented defaults — every value here traces back to
 * something the user typed once, per CLAUDE.md "never invent an
 * engineering constant"). Stored in the browser, independent of any one
 * design, like the project library (persistence/library.ts).
 */
export const PRESETS_KEY = "mw3d.presets";
/** Where an unreadable preset store is moved, so saving never destroys it. */
export const PRESETS_RECOVERY_KEY = "mw3d.presets.unreadable";
const PRESETS_FORMAT = "mechanical-watchmaker-3d.presets";

export type PresetKind = "Shaft" | "Gear" | "Jewel" | "Frame";

export interface ShaftPresetValues {
  pivotDiameterLower: Length | null;
  pivotDiameterUpper: Length | null;
  shoulderSpan: Length | null;
}
export interface GearPresetValues {
  module: Length | null;
  thickness: Length | null;
}
export interface JewelPresetValues {
  boreDiameter: Length | null;
}
export interface FramePresetValues {
  thickness: Length | null;
}

interface PresetValuesByKind {
  Shaft: ShaftPresetValues;
  Gear: GearPresetValues;
  Jewel: JewelPresetValues;
  Frame: FramePresetValues;
}

export type PartPreset = {
  [K in PresetKind]: { id: string; kind: K; name: string; values: PresetValuesByKind[K] };
}[PresetKind];

/** Every field a preset of this kind can carry, in a fixed display order. */
export const PRESET_FIELDS: { [K in PresetKind]: { key: keyof PresetValuesByKind[K] & string; label: string }[] } = {
  Shaft: [
    { key: "pivotDiameterLower", label: "Lower pivot Ø (mm)" },
    { key: "pivotDiameterUpper", label: "Upper pivot Ø (mm)" },
    { key: "shoulderSpan", label: "Shoulder span (mm)" },
  ],
  Gear: [
    { key: "module", label: "Module (mm)" },
    { key: "thickness", label: "Thickness (mm)" },
  ],
  Jewel: [{ key: "boreDiameter", label: "Bore Ø (mm)" }],
  Frame: [{ key: "thickness", label: "Thickness (mm)" }],
};

interface StoredStore {
  format: typeof PRESETS_FORMAT;
  presets: PartPreset[];
}

const PRESET_KINDS: PresetKind[] = ["Shaft", "Gear", "Jewel", "Frame"];

function isLengthOrNull(value: unknown): value is Length | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isPartPreset(value: unknown): value is PartPreset {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== "string" || typeof v.name !== "string" || typeof v.kind !== "string") return false;
  if (!PRESET_KINDS.includes(v.kind as PresetKind)) return false;
  if (typeof v.values !== "object" || v.values === null) return false;
  const values = v.values as Record<string, unknown>;
  return PRESET_FIELDS[v.kind as PresetKind].every((f) => isLengthOrNull(values[f.key]));
}

function isStoredStore(value: unknown): value is StoredStore {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return v.format === PRESETS_FORMAT && Array.isArray(v.presets) && v.presets.every(isPartPreset);
}

export type PresetsResult<T> = { ok: true; value: T } | { ok: false; reason: string };

function readStore(store: KeyValueStore): PresetsResult<StoredStore> {
  let text: string | null;
  try {
    text = store.getItem(PRESETS_KEY);
  } catch {
    return { ok: false, reason: "Browser storage is not available." };
  }
  if (text === null) return { ok: true, value: { format: PRESETS_FORMAT, presets: [] } };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = undefined;
  }
  if (!isStoredStore(parsed)) {
    try {
      store.setItem(PRESETS_RECOVERY_KEY, text);
      store.removeItem(PRESETS_KEY);
    } catch {
      // The reason below is still reported.
    }
    return { ok: false, reason: "The saved presets could not be read and were set aside, not deleted." };
  }
  return { ok: true, value: parsed };
}

function writeStore(store: KeyValueStore, value: StoredStore): PresetsResult<null> {
  try {
    store.setItem(PRESETS_KEY, JSON.stringify(value));
    return { ok: true, value: null };
  } catch {
    return { ok: false, reason: "Browser storage refused the write (it may be full or blocked)." };
  }
}

/** Presets of one kind, newest first. */
export function listPresets<K extends PresetKind>(store: KeyValueStore | null, kind: K): PresetsResult<Extract<PartPreset, { kind: K }>[]> {
  if (store === null) return { ok: false, reason: "Browser storage is not available." };
  const result = readStore(store);
  if (!result.ok) return result;
  const matching = result.value.presets.filter((p): p is Extract<PartPreset, { kind: K }> => p.kind === kind);
  return { ok: true, value: [...matching].reverse() };
}

/** Adds a new preset (each save is a new entry; presets are never edited in place). */
export function savePreset(store: KeyValueStore | null, preset: Omit<PartPreset, "id">): PresetsResult<null> {
  if (store === null) return { ok: false, reason: "Browser storage is not available." };
  const result = readStore(store);
  if (!result.ok) return result;
  const withId = { ...preset, id: crypto.randomUUID() } as PartPreset;
  return writeStore(store, { ...result.value, presets: [...result.value.presets, withId] });
}

export function deletePreset(store: KeyValueStore | null, id: string): PresetsResult<null> {
  if (store === null) return { ok: false, reason: "Browser storage is not available." };
  const result = readStore(store);
  if (!result.ok) return result;
  return writeStore(store, { ...result.value, presets: result.value.presets.filter((p) => p.id !== id) });
}
