import type { Movement } from "@/domain/movement";
import type { AppStore } from "./store";
import type { ViewSide } from "@/viewport/viewport";
import type { AutosaveLoad, KeyValueStore } from "@/persistence/autosave";
import { getStartupProjectId, keepPreviousSession, listProjects, openProject, type PreviousSessionKept } from "@/persistence/library";

/**
 * What the app shows on entry (follow-up 31): the teaching movement (or the saved project set to open at startup,
 * follow-up 36), set to the browser's date and time, in the dial view centred in the viewport. `?start=plain` skips all of it and restores the
 * autosaved design as before, with the simulation at t = 0 and the oblique bridge view (used by
 * the automated tests, which depend on that state).
 */
export function startupPlain(search: string): boolean {
  return new URLSearchParams(search).get("start") === "plain";
}

export interface StartupChoice {
  movement: Movement;
  /** The design the last session left behind and what was done with it, or null when there was none to keep. */
  preserved: { movement: Movement; kept: PreviousSessionKept } | null;
  /** Why keeping it failed, when it did. */
  preserveProblem: string | null;
  /** The name of the saved project that was opened because it is set to open at startup, or null. */
  startupProjectName: string | null;
  /** Why the startup project could not be opened (the teaching movement opened instead), or null. */
  startupProblem: string | null;
}

/**
 * Picks the design to open. If a saved project is set to open at startup (Projects…, follow-up 36) it is opened
 * exactly as saved; otherwise the current teaching movement is opened fresh, so the app never starts from an old
 * autosave of it. The design the last session left (the autosave) is never thrown away and never overwrites a
 * deliberate save: it is kept in Projects (`keepPreviousSession`), and the caller tells the user.
 */
export function chooseStartupMovement(
  saved: AutosaveLoad,
  storage: KeyValueStore | null,
  teaching: () => Movement,
  plain: boolean,
): StartupChoice {
  const none = { preserved: null, preserveProblem: null, startupProjectName: null, startupProblem: null } as const;
  if (plain) return { movement: saved.status === "LOADED" ? saved.movement : teaching(), ...none };

  let preserved: StartupChoice["preserved"] = null;
  let preserveProblem: string | null = null;
  if (saved.status === "LOADED") {
    const kept = keepPreviousSession(storage, saved.movement);
    if (kept.ok) {
      preserved = kept.value === "ALREADY_SAVED" ? null : { movement: saved.movement, kept: kept.value };
    } else {
      preserveProblem = kept.reason;
      preserved = { movement: saved.movement, kept: "OWN_ENTRY" };
    }
  }

  const startupId = getStartupProjectId(storage);
  if (startupId !== null) {
    const opened = openProject(storage, startupId);
    if (opened.ok) {
      const entry = listProjects(storage);
      const name = entry.ok ? entry.value.find((p) => p.id === startupId)?.name ?? opened.value.name : opened.value.name;
      return { movement: opened.value, preserved, preserveProblem, startupProjectName: name, startupProblem: null };
    }
    return { movement: teaching(), preserved, preserveProblem, startupProjectName: null, startupProblem: opened.reason };
  }
  return { movement: teaching(), preserved, preserveProblem, startupProjectName: null, startupProblem: null };
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
