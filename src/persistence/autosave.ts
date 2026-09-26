import type { Movement } from "@/domain/movement";
import { decodeDesign, DesignFileError, encodeDesign } from "./designFile";

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const AUTOSAVE_KEY = "mw3d.autosave";
/** Where an autosave that failed to load is moved, so the next save doesn't destroy it. */
export const RECOVERY_KEY = "mw3d.autosave.unreadable";

export type AutosaveLoad =
  | { status: "NONE" }
  | { status: "LOADED"; movement: Movement }
  | { status: "UNREADABLE"; reason: string };

/** Browser storage can be missing, blocked or full; every access is guarded. */
export function browserStore(): KeyValueStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadAutosave(store: KeyValueStore | null): AutosaveLoad {
  if (store === null) return { status: "NONE" };
  let text: string | null;
  try {
    text = store.getItem(AUTOSAVE_KEY);
  } catch {
    return { status: "NONE" };
  }
  if (text === null) return { status: "NONE" };
  try {
    return { status: "LOADED", movement: decodeDesign(text) };
  } catch (error) {
    try {
      store.setItem(RECOVERY_KEY, text);
      store.removeItem(AUTOSAVE_KEY);
    } catch {
      // Nothing more we can do; the reason is still reported.
    }
    return { status: "UNREADABLE", reason: error instanceof DesignFileError ? error.message : String(error) };
  }
}

/** Returns false if the design could not be stored (e.g. storage full or blocked). */
export function writeAutosave(store: KeyValueStore | null, movement: Movement): boolean {
  if (store === null) return false;
  try {
    store.setItem(AUTOSAVE_KEY, encodeDesign(movement));
    return true;
  } catch {
    return false;
  }
}
