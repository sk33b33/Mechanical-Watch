import { describe, expect, it } from "vitest";
import { createTeachingMovement } from "@/app/teachingMovement";
import { createDemoMovement } from "@/app/demoMovement";
import type { KeyValueStore } from "./autosave";
import { encodeDesign } from "./designFile";
import {
  addToCarousel,
  CAROUSEL_KEY,
  CAROUSEL_SLOTS,
  carouselSlots,
  deleteProject,
  isOnCarousel,
  readCarouselIds,
  removeFromCarousel,
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

describe("the carousel's eight places (follow-up 54, ASM-0098)", () => {
  /** Saves `count` designs with distinct ids and returns their ids, oldest first. */
  function saveMany(store: ReturnType<typeof memoryStore>, count: number): string[] {
    const ids: string[] = [];
    for (let i = 0; i < count; i += 1) {
      const m = { ...createTeachingMovement(), name: `Design ${String(i)}` };
      unwrap(saveProject(store, m, new Date(2026, 0, 1, 10, i)));
      ids.push(m.id);
    }
    return ids;
  }

  it("starts with eight empty places, even with nothing saved or no storage at all", () => {
    expect(CAROUSEL_SLOTS).toBe(8);
    expect(readCarouselIds(memoryStore())).toEqual(Array.from({ length: 8 }, () => null));
    expect(readCarouselIds(null)).toEqual(Array.from({ length: 8 }, () => null));
  });

  it("adding fills the first empty place; adding the same one again changes nothing", () => {
    const store = memoryStore();
    const [a, b, c] = saveMany(store, 3);
    expect(unwrap(addToCarousel(store, a ?? ""))).toBe(0);
    expect(unwrap(addToCarousel(store, b ?? ""))).toBe(1);
    expect(unwrap(addToCarousel(store, a ?? ""))).toBe(0);
    expect(readCarouselIds(store).slice(0, 3)).toEqual([a, b, null]);
    // A removed place is the next one filled.
    unwrap(removeFromCarousel(store, a ?? ""));
    expect(readCarouselIds(store).slice(0, 2)).toEqual([null, b]);
    expect(unwrap(addToCarousel(store, c ?? ""))).toBe(0);
    expect(isOnCarousel(store, c ?? "")).toBe(true);
    expect(isOnCarousel(store, a ?? "")).toBe(false);
  });

  it("holds only eight: the ninth is refused with the reason, and nothing changes", () => {
    const store = memoryStore();
    const ids = saveMany(store, 9);
    for (const id of ids.slice(0, 8)) unwrap(addToCarousel(store, id));
    const before = readCarouselIds(store);
    const ninth = addToCarousel(store, ids[8] ?? "");
    expect(ninth.ok).toBe(false);
    if (!ninth.ok) expect(ninth.reason).toContain("full");
    expect(readCarouselIds(store)).toEqual(before);
    // Making room lets it in.
    unwrap(removeFromCarousel(store, ids[3] ?? ""));
    expect(unwrap(addToCarousel(store, ids[8] ?? ""))).toBe(3);
  });

  it("only a saved design can be added", () => {
    const store = memoryStore();
    const result = addToCarousel(store, "movement_nothing");
    expect(result.ok).toBe(false);
    expect(addToCarousel(null, "x").ok).toBe(false);
  });

  it("deleting a design empties its place, and a place naming something no longer saved reads as empty", () => {
    const store = memoryStore();
    const [a, b] = saveMany(store, 2);
    unwrap(addToCarousel(store, a ?? ""));
    unwrap(addToCarousel(store, b ?? ""));
    unwrap(deleteProject(store, a ?? ""));
    expect(readCarouselIds(store).slice(0, 2)).toEqual([null, b]);
    // A stale id left in the stored list (say, by another tab) reads as empty too.
    store.data[CAROUSEL_KEY] = JSON.stringify({ slots: ["movement_gone", b, b, 5, null, null, null, null] });
    expect(readCarouselIds(store)).toEqual([null, b, null, null, null, null, null, null]);
  });

  it("lists the places as summaries, empty ones as null, in place order", () => {
    const store = memoryStore();
    const [a, b] = saveMany(store, 2);
    unwrap(addToCarousel(store, b ?? ""));
    unwrap(addToCarousel(store, a ?? ""));
    const slots = unwrap(carouselSlots(store));
    expect(slots).toHaveLength(8);
    expect(slots[0]?.name).toBe("Design 1");
    expect(slots[1]?.name).toBe("Design 0");
    expect(slots.slice(2).every((slot) => slot === null)).toBe(true);
  });

  it("an unreadable stored list reads as empty rather than throwing", () => {
    const store = memoryStore({ [CAROUSEL_KEY]: "{not json" });
    expect(readCarouselIds(store)).toEqual(Array.from({ length: 8 }, () => null));
    const wrongShape = memoryStore({ [CAROUSEL_KEY]: JSON.stringify({ slots: "nope" }) });
    expect(readCarouselIds(wrongShape)).toEqual(Array.from({ length: 8 }, () => null));
  });
});
