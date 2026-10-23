import { describe, expect, it, vi } from "vitest";
import { createTeachingMovement } from "@/app/teachingMovement";
import { AppStore } from "@/app/store";
import { createMovement } from "@/domain/movement";
import { encodeDesign } from "@/persistence/designFile";
import { listProjects } from "@/persistence/library";
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
    expect(choice.preserved?.id).toBe(old.id);
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
});
