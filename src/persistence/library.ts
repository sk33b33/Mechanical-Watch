import type { Movement } from "@/domain/movement";
import { decodeDesign, DesignFileError, designsEqual, encodeDesign } from "./designFile";
import type { KeyValueStore } from "./autosave";

export const LIBRARY_KEY = "mw3d.library";
/** Where an unreadable library is moved, so saving never destroys it. */
export const LIBRARY_RECOVERY_KEY = "mw3d.library.unreadable";
const LIBRARY_FORMAT = "mechanical-watchmaker-3d.library";

interface StoredEntry {
  name: string;
  savedAt: string;
  /** A complete design file (see designFile.ts), so each entry migrates on its own. */
  design: string;
}

interface StoredLibrary {
  format: typeof LIBRARY_FORMAT;
  entries: Record<string, StoredEntry>;
}

export interface ProjectSummary {
  id: string;
  name: string;
  savedAt: string;
  /** Null if the entry opens; otherwise why it can't (e.g. saved by a newer version). */
  problem: string | null;
}

export type LibraryResult<T> = { ok: true; value: T } | { ok: false; reason: string };

function isStoredLibrary(value: unknown): value is StoredLibrary {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.format !== LIBRARY_FORMAT || typeof v.entries !== "object" || v.entries === null) return false;
  return Object.values(v.entries as Record<string, unknown>).every((e) => {
    if (typeof e !== "object" || e === null) return false;
    const entry = e as Record<string, unknown>;
    return typeof entry.name === "string" && typeof entry.savedAt === "string" && typeof entry.design === "string";
  });
}

/** Reads the library. An unreadable library is moved aside (not overwritten) and reported. */
function readLibrary(store: KeyValueStore): LibraryResult<StoredLibrary> {
  let text: string | null;
  try {
    text = store.getItem(LIBRARY_KEY);
  } catch {
    return { ok: false, reason: "Browser storage is not available." };
  }
  if (text === null) return { ok: true, value: { format: LIBRARY_FORMAT, entries: {} } };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = undefined;
  }
  if (!isStoredLibrary(parsed)) {
    try {
      store.setItem(LIBRARY_RECOVERY_KEY, text);
      store.removeItem(LIBRARY_KEY);
    } catch {
      // The reason below is still reported.
    }
    return { ok: false, reason: "The saved-project library could not be read and was set aside, not deleted." };
  }
  return { ok: true, value: parsed };
}

function writeLibrary(store: KeyValueStore, library: StoredLibrary): LibraryResult<null> {
  try {
    store.setItem(LIBRARY_KEY, JSON.stringify(library));
    return { ok: true, value: null };
  } catch {
    return { ok: false, reason: "Browser storage refused the write (it may be full or blocked)." };
  }
}

function problemOf(design: string): string | null {
  try {
    decodeDesign(design);
    return null;
  } catch (error) {
    return error instanceof DesignFileError ? error.message : String(error);
  }
}

/** Newest first. */
export function listProjects(store: KeyValueStore | null): LibraryResult<ProjectSummary[]> {
  if (store === null) return { ok: false, reason: "Browser storage is not available." };
  const library = readLibrary(store);
  if (!library.ok) return library;
  const summaries = Object.entries(library.value.entries).map(([id, e]) => ({
    id,
    name: e.name,
    savedAt: e.savedAt,
    problem: problemOf(e.design),
  }));
  summaries.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  return { ok: true, value: summaries };
}

/** Saves the design under its own id, replacing an earlier save of the same design. */
export function saveProject(store: KeyValueStore | null, movement: Movement, now: Date = new Date()): LibraryResult<null> {
  if (store === null) return { ok: false, reason: "Browser storage is not available." };
  const library = readLibrary(store);
  if (!library.ok) return library;
  const entries = {
    ...library.value.entries,
    [movement.id]: { name: movement.name, savedAt: now.toISOString(), design: encodeDesign(movement, now) },
  };
  return writeLibrary(store, { ...library.value, entries });
}

export function openProject(store: KeyValueStore | null, id: string): LibraryResult<Movement> {
  if (store === null) return { ok: false, reason: "Browser storage is not available." };
  const library = readLibrary(store);
  if (!library.ok) return library;
  const entry = library.value.entries[id];
  if (entry === undefined) return { ok: false, reason: "That project is no longer in the library." };
  try {
    return { ok: true, value: decodeDesign(entry.design) };
  } catch (error) {
    return { ok: false, reason: error instanceof DesignFileError ? error.message : String(error) };
  }
}

/**
 * The carousel (follow-up 54, ASM-0098): the designs saved in this browser that stand on the carousel, in eight fixed
 * places. A place holds the id of a saved design or is empty; "Add to carousel" fills the first empty place, "Remove" empties
 * one, and deleting a design empties its place. Which designs are in the library is separate from which are on the carousel.
 */
export const CAROUSEL_KEY = "mw3d.carousel";
export const CAROUSEL_SLOTS = 8;

/** The eight places, each a saved design's id or null. Places naming a design that is no longer in the library read as empty. */
export function readCarouselIds(store: KeyValueStore | null): (string | null)[] {
  const empty = (): (string | null)[] => Array.from({ length: CAROUSEL_SLOTS }, () => null);
  if (store === null) return empty();
  let parsed: unknown;
  try {
    const text = store.getItem(CAROUSEL_KEY);
    parsed = text === null ? null : JSON.parse(text);
  } catch {
    return empty();
  }
  const stored = typeof parsed === "object" && parsed !== null ? (parsed as { slots?: unknown }).slots : null;
  const slots = empty();
  if (!Array.isArray(stored)) return slots;
  const library = readLibrary(store);
  const known = library.ok ? library.value.entries : {};
  const seen = new Set<string>();
  for (let i = 0; i < CAROUSEL_SLOTS; i += 1) {
    const id: unknown = stored[i];
    if (typeof id === "string" && Object.hasOwn(known, id) && !seen.has(id)) {
      slots[i] = id;
      seen.add(id);
    }
  }
  return slots;
}

function writeCarouselIds(store: KeyValueStore, slots: readonly (string | null)[]): LibraryResult<null> {
  try {
    store.setItem(CAROUSEL_KEY, JSON.stringify({ slots }));
    return { ok: true, value: null };
  } catch {
    return { ok: false, reason: "Browser storage refused the write (it may be full or blocked)." };
  }
}

/** The eight places as saved-design summaries, or null for an empty place. */
export function carouselSlots(store: KeyValueStore | null): LibraryResult<(ProjectSummary | null)[]> {
  const list = listProjects(store);
  if (!list.ok) return list;
  const byId = new Map(list.value.map((p) => [p.id, p]));
  return { ok: true, value: readCarouselIds(store).map((id) => (id === null ? null : byId.get(id) ?? null)) };
}

export function isOnCarousel(store: KeyValueStore | null, id: string): boolean {
  return readCarouselIds(store).includes(id);
}

/** Puts a saved design in the first empty place. Already there is fine; a full carousel is refused with the reason. */
export function addToCarousel(store: KeyValueStore | null, id: string): LibraryResult<number> {
  if (store === null) return { ok: false, reason: "Browser storage is not available." };
  const library = readLibrary(store);
  if (!library.ok) return library;
  if (!Object.hasOwn(library.value.entries, id)) return { ok: false, reason: "That project is no longer in the library." };
  const slots = readCarouselIds(store);
  const already = slots.indexOf(id);
  if (already >= 0) return { ok: true, value: already };
  const free = slots.indexOf(null);
  if (free < 0) return { ok: false, reason: `The carousel is full (${String(CAROUSEL_SLOTS)} movements). Remove one first.` };
  slots[free] = id;
  const written = writeCarouselIds(store, slots);
  return written.ok ? { ok: true, value: free } : written;
}

export function removeFromCarousel(store: KeyValueStore | null, id: string): LibraryResult<null> {
  if (store === null) return { ok: false, reason: "Browser storage is not available." };
  const slots = readCarouselIds(store).map((slot) => (slot === id ? null : slot));
  return writeCarouselIds(store, slots);
}

export type PreviousSessionKept = "OWN_ENTRY" | "UNSAVED_COPY" | "ALREADY_SAVED";

/**
 * Keeps the design the last session left behind (the autosave) without ever overwriting a deliberate save:
 * with no entry of its own it is saved under its own name; when it is identical to its entry nothing is
 * written; when it differs from its entry (edits that were never saved) it goes into a separate
 * "(unsaved edits)" entry, which the next such session replaces, so the saved design itself is untouched.
 */
export function keepPreviousSession(store: KeyValueStore | null, movement: Movement, now: Date = new Date()): LibraryResult<PreviousSessionKept> {
  if (store === null) return { ok: false, reason: "Browser storage is not available." };
  const library = readLibrary(store);
  if (!library.ok) return library;
  const existing = library.value.entries[movement.id];
  if (existing === undefined) {
    const saved = saveProject(store, movement, now);
    return saved.ok ? { ok: true, value: "OWN_ENTRY" } : saved;
  }
  try {
    if (designsEqual(decodeDesign(existing.design), movement)) return { ok: true, value: "ALREADY_SAVED" };
  } catch {
    // An unreadable earlier entry is not worth protecting over the newer design: keep both, as a copy.
  }
  const copy = { ...movement, id: `${movement.id}:unsaved` as Movement["id"], name: `${movement.name} (unsaved edits)` };
  const saved = saveProject(store, copy, now);
  return saved.ok ? { ok: true, value: "UNSAVED_COPY" } : saved;
}

export function deleteProject(store: KeyValueStore | null, id: string): LibraryResult<null> {
  if (store === null) return { ok: false, reason: "Browser storage is not available." };
  const library = readLibrary(store);
  if (!library.ok) return library;
  const entries = Object.fromEntries(Object.entries(library.value.entries).filter(([key]) => key !== id));
  const written = writeLibrary(store, { ...library.value, entries });
  // A deleted design leaves its carousel place empty.
  if (written.ok) removeFromCarousel(store, id);
  return written;
}
