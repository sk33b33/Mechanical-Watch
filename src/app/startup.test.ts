import { describe, expect, it, vi } from "vitest";
import { createTeachingMovement } from "@/app/teachingMovement";
import { AppStore } from "@/app/store";
import { createMovement, type Movement } from "@/domain/movement";
import { decodeDesign, encodeDesign } from "@/persistence/designFile";
import { listProjects, saveProject } from "@/persistence/library";
import type { KeyValueStore } from "@/persistence/autosave";
import { readHand } from "@/kinematics/timeDisplay";
import { applyStartup, chooseStartupMovement, startupPlain } from "./startup";

function memoryStore(): KeyValueStore {
  const data: Record<string, string> = {};
  return {
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => { data[k] = v; },
    removeItem: (k) => { Reflect.deleteProperty(data, k); },
  };
}

describe("startup (follow-up 31, ASM-0085)", () => {
  it("?start=plain is the only way to the old startup", () => {
    expect(startupPlain("?start=plain")).toBe(true);
    expect(startupPlain("?splash=off&start=plain")).toBe(true);
    expect(startupPlain("")).toBe(false);
  });

  it("opens the teaching movement even when an autosave exists, and keeps that design in Projects under its own name", () => {
    const storage = memoryStore();
    const old = createMovement("My own design", false);
    const choice = chooseStartupMovement({ status: "LOADED", movement: old }, storage, createTeachingMovement, false);
    expect(choice.movement.isTeachingDemo).toBe(true);
    expect(choice.preserved?.movement.id).toBe(old.id);
    expect(choice.preserved?.kept).toBe("OWN_ENTRY");
    expect(choice.preserveProblem).toBeNull();
    const list = listProjects(storage);
    expect(list.ok && list.value.map((p) => p.name)).toEqual(["My own design"]);
    // Opening the project gives the same design back (it is a complete design file).
    expect(encodeDesign(old)).toContain("My own design");
  });

  it("with nothing autosaved it just opens the teaching movement and keeps nothing", () => {
    const choice = chooseStartupMovement({ status: "NONE" }, memoryStore(), createTeachingMovement, false);
    expect(choice.movement.isTeachingDemo).toBe(true);
    expect(choice.preserved).toBeNull();
  });

  it("plain startup restores the autosave as before and keeps nothing aside", () => {
    const old = createMovement("My own design", false);
    const choice = chooseStartupMovement({ status: "LOADED", movement: old }, memoryStore(), createTeachingMovement, true);
    expect(choice.movement).toBe(old);
    expect(choice.preserved).toBeNull();
  });

  it("reports when keeping the previous design failed", () => {
    const old = createMovement("My own design", false);
    const choice = chooseStartupMovement({ status: "LOADED", movement: old }, null, createTeachingMovement, false);
    expect(choice.preserveProblem).not.toBeNull();
  });

  it("applyStartup sets the browser time and turns to the dial view", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 20, 15, 5, 30));
    try {
      const store = new AppStore(createTeachingMovement());
      const setView = vi.fn();
      applyStartup(store, { setView });
      expect(setView).toHaveBeenCalledWith("DIAL");
      const minutes = Object.values(store.movement.shafts).find((s) => s.hand === "MINUTES");
      if (minutes === undefined) throw new Error("no minute hand");
      expect(readHand("MINUTES", store.simulation.shaftAngle[minutes.id] ?? 0)).toBeCloseTo(5.5, 0); // the set-by-hand clock lands within a fraction of a minute (the train's own rate)
    } finally {
      vi.useRealTimers();
    }
  });

  describe("the design the last session left behind (follow-up 36, kept in follow-up 54)", () => {
    const layout = (): Movement => ({ ...createTeachingMovement(), name: "My dial layout" });

    it("an autosave identical to its saved entry is not saved again, and one with unsaved edits goes to a separate copy, leaving the saved design untouched", () => {
      const storage = memoryStore();
      const mine = layout();
      saveProject(storage, mine);
      // Same as saved (the autosave is read back from storage, like a real one): nothing kept, nothing duplicated.
      const same = decodeDesign(encodeDesign(mine));
      expect(chooseStartupMovement({ status: "LOADED", movement: same }, storage, createTeachingMovement, false).preserved).toBeNull();
      // Edited since: a separate "(unsaved edits)" entry; the saved design is untouched, and the teaching movement is what is held.
      const edited: Movement = { ...same, drive: null };
      const choice = chooseStartupMovement({ status: "LOADED", movement: edited }, storage, createTeachingMovement, false);
      expect(choice.preserved?.kept).toBe("UNSAVED_COPY");
      expect(choice.movement.isTeachingDemo).toBe(true);
      const names = listProjects(storage);
      expect(names.ok && names.value.map((p) => p.name).sort()).toEqual(["My dial layout", "My dial layout (unsaved edits)"]);
      // A second session replaces that copy rather than piling them up.
      chooseStartupMovement({ status: "LOADED", movement: edited }, storage, createTeachingMovement, false);
      const again = listProjects(storage);
      expect(again.ok && again.value).toHaveLength(2);
    });

    it("there is no longer a project that opens at startup: a leftover setting from an older version is ignored", () => {
      const storage = memoryStore();
      const mine = layout();
      saveProject(storage, mine);
      storage.setItem("mw3d.startup.project", mine.id);
      const choice = chooseStartupMovement({ status: "NONE" }, storage, createTeachingMovement, false);
      expect(choice.movement.isTeachingDemo).toBe(true);
      expect(choice.movement.id).not.toBe(mine.id);
    });

    it("applyStartup still sets the browser time and dial view for whichever design is chosen", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 9, 20, 15, 5, 30));
      try {
        const store = new AppStore(layout());
        const setView = vi.fn();
        applyStartup(store, { setView });
        expect(setView).toHaveBeenCalledWith("DIAL");
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
