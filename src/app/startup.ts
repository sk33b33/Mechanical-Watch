import type { Movement } from "@/domain/movement";
import type { AppStore } from "./store";
import type { ViewSide } from "@/viewport/viewport";
import type { AutosaveLoad, KeyValueStore } from "@/persistence/autosave";
import { saveProject } from "@/persistence/library";

/**
 * What the app shows on entry (follow-up 31): the teaching movement, set to the browser's date and
 * time, in the dial view centred in the viewport. `?start=plain` skips all of it and restores the
 * autosaved design as before, with the simulation at t = 0 and the oblique bridge view (used by
 * the automated tests, which depend on that state).
 */
export function startupPlain(search: string): boolean {
  return new URLSearchParams(search).get("start") === "plain";
}

export interface StartupChoice {
  movement: Movement;
  /** The design that was autosaved by the last session and has been kept in Projects instead, or null. */
  preserved: Movement | null;
  /** Why keeping it failed, when it did. */
  preserveProblem: string | null;
}

/**
 * Picks the design to open. The teaching movement is always opened fresh, so the app always starts
 * from the current teaching movement rather than an old autosave of it. An autosaved design from the
 * last session is not thrown away: it is saved in Projects under its own name (saving again
 * updates the same entry), and the caller tells the user.
 */
export function chooseStartupMovement(
  saved: AutosaveLoad,
  storage: KeyValueStore | null,
  teaching: () => Movement,
  plain: boolean,
): StartupChoice {
  if (plain) return { movement: saved.status === "LOADED" ? saved.movement : teaching(), preserved: null, preserveProblem: null };
  if (saved.status !== "LOADED") return { movement: teaching(), preserved: null, preserveProblem: null };
  const result = saveProject(storage, saved.movement);
  return { movement: teaching(), preserved: saved.movement, preserveProblem: result.ok ? null : result.reason };
}

/** The camera control the startup needs; the viewport satisfies it. */
export interface StartupViewport {
  setView(view: ViewSide): void;
}

/** Sets the calendar and time of day from the browser's clock and turns to the dial view, centred. */
export function applyStartup(store: AppStore, viewport: StartupViewport): void {
  store.setToBrowserTime();
  viewport.setView("DIAL");
}
