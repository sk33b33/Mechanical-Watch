import { describe, expect, it } from "vitest";
import { createTeachingMovement } from "@/app/teachingMovement";
import { createDemoMovement } from "@/app/demoMovement";
import type { KeyValueStore } from "./autosave";
import { encodeDesign } from "./designFile";
import {
  deleteProject,
  LIBRARY_KEY,
  LIBRARY_RECOVERY_KEY,
  listProjects,
  openProject,
  saveProject,
} from "./library";

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

describe("project library", () => {
  it("saves, lists newest first, opens and deletes", () => {
    const store = memoryStore();
    const teaching = createTeachingMovement();
    const demo = createDemoMovement();
    unwrap(saveProject(store, teaching, new Date("2026-01-01T10:00:00Z")));
    unwrap(saveProject(store, demo, new Date("2026-01-02T10:00:00Z")));

    const list = unwrap(listProjects(store));
    expect(list.map((p) => p.name)).toEqual([demo.name, teaching.name]);
    expect(list.every((p) => p.problem === null)).toBe(true);

    expect(unwrap(openProject(store, teaching.id))).toEqual(teaching);

    unwrap(deleteProject(store, demo.id));
    expect(unwrap(listProjects(store)).map((p) => p.id)).toEqual([teaching.id]);
  });

  it("saving the same design again replaces its entry and name", () => {
    const store = memoryStore();
    const m = createDemoMovement();
    unwrap(saveProject(store, m));
    unwrap(saveProject(store, { ...m, name: "Renamed" }));
    const list = unwrap(listProjects(store));
    expect(list).toHaveLength(1);
    expect(list[0]?.name).toBe("Renamed");
  });

  it("lists an entry it cannot open with the reason, instead of dropping it", () => {
    const store = memoryStore();
    const m = createDemoMovement();
    const newer = JSON.stringify({ ...(JSON.parse(encodeDesign(m)) as object), schemaVersion: 99 });
    store.data[LIBRARY_KEY] = JSON.stringify({
      format: "mechanical-watchmaker-3d.library",
      entries: { x: { name: "From the future", savedAt: "2026-01-01T00:00:00Z", design: newer } },
    });
    const list = unwrap(listProjects(store));
    expect(list[0]?.problem).toMatch(/newer version/);
    const opened = openProject(store, "x");
    expect(opened.ok).toBe(false);
  });

  it("sets an unreadable library aside rather than overwriting it", () => {
    const store = memoryStore({ [LIBRARY_KEY]: "{not a library" });
    const result = saveProject(store, createDemoMovement());
    expect(result.ok).toBe(false);
    expect(store.data[LIBRARY_RECOVERY_KEY]).toBe("{not a library");
    // After it has been set aside, saving works on a fresh library.
    expect(saveProject(store, createDemoMovement()).ok).toBe(true);
  });

  it("reports missing storage and refused writes", () => {
    expect(listProjects(null).ok).toBe(false);
    const full: KeyValueStore = { getItem: () => null, setItem: () => { throw new Error("quota"); }, removeItem: () => undefined };
    expect(saveProject(full, createDemoMovement()).ok).toBe(false);
  });
});
