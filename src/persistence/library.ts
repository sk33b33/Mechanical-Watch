import type { Movement } from "@/domain/movement";
import { decodeDesign, DesignFileError, encodeDesign } from "./designFile";
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

export function deleteProject(store: KeyValueStore | null, id: string): LibraryResult<null> {
  if (store === null) return { ok: false, reason: "Browser storage is not available." };
  const library = readLibrary(store);
  if (!library.ok) return library;
  const entries = Object.fromEntries(Object.entries(library.value.entries).filter(([key]) => key !== id));
  return writeLibrary(store, { ...library.value, entries });
}
