import { describe, expect, it } from "vitest";
import { radiansPerSecond } from "@/units/angularVelocity";
import { NUMERICAL_PARAMETERS } from "@/reference/numericalParameters";
import { AppStore } from "./store";
import { drivenShaftId } from "@/domain/movement";
import { createDemoMovement } from "./demoMovement";

const dt = NUMERICAL_PARAMETERS.simulationTimestepSeconds;

describe("AppStore simulation playback", () => {
  it("does not advance while paused, but can single-step", () => {
    const store = new AppStore(createDemoMovement());
    store.setPlaying(false);
    store.tick(1);
    expect(store.simulation.stepCount).toBe(0);
    store.stepOnce();
    expect(store.simulation.stepCount).toBe(1);
  });

  it("scales simulated time by the playback rate, still in fixed steps", () => {
    const store = new AppStore(createDemoMovement());
    store.setPlaybackRate(10);
    store.tick(dt * 3.5);
    expect(store.simulation.stepCount).toBe(35);
  });

  it("reset returns to t = 0 without touching the design", () => {
    const store = new AppStore(createDemoMovement());
    const before = store.movement;
    store.tick(0.5);
    store.resetSimulation();
    expect(store.simulation.stepCount).toBe(0);
    expect(store.movement).toBe(before);
  });

  it("halts on a non-finite state with a SIM-001 blocker, until the design changes", () => {
    const store = new AppStore(createDemoMovement());
    const drive = drivenShaftId(store.movement);
    if (drive === null) throw new Error("no drive");
    // Force an infinite velocity past the solver's guard to exercise the halt path.
    store.analysis = {
      ...store.analysis,
      train: { ...store.analysis.train, shaftAngularVelocity: new Map([[drive, radiansPerSecond(Infinity)]]) },
    };
    store.tick(0.1);
    expect(store.simulationHalted).toBe(true);
    expect(store.issues.some((i) => i.id === "SIM-001:halted" && i.severity === "blocker")).toBe(true);
    store.tick(0.1);
    expect(store.simulation.stepCount).toBe(0);
    store.edit((m) => ({ ...m }));
    expect(store.simulationHalted).toBe(false);
    expect(store.issues.some((i) => i.id === "SIM-001:halted")).toBe(false);
  });

  it("loading a design restarts the simulation and clears selection", () => {
    const store = new AppStore(createDemoMovement());
    store.tick(0.5);
    store.select(Object.values(store.movement.gears)[0]?.id ?? null);
    store.load(createDemoMovement());
    expect(store.simulation.stepCount).toBe(0);
    expect(store.selectedId).toBeNull();
  });
});

describe("AppStore undo/redo", () => {
  const wheelOf = (store: AppStore): number | undefined =>
    Object.values(store.movement.gears).find((g) => g.name === "Wheel C")?.toothCount;
  const editWheel = (store: AppStore, toothCount: number): void => {
    store.edit((m) => ({
      ...m,
      gears: Object.fromEntries(
        Object.entries(m.gears).map(([id, g]) => [id, g.name === "Wheel C" ? { ...g, toothCount } : g]),
      ),
    }));
  };

  it("undoes and redoes edits in order", () => {
    const store = new AppStore(createDemoMovement());
    editWheel(store, 30);
    editWheel(store, 20);
    store.undo();
    expect(wheelOf(store)).toBe(30);
    store.undo();
    expect(wheelOf(store)).toBe(40);
    expect(store.canUndo).toBe(false);
    store.redo();
    expect(wheelOf(store)).toBe(30);
  });

  it("a new edit clears the redo history", () => {
    const store = new AppStore(createDemoMovement());
    editWheel(store, 30);
    store.undo();
    editWheel(store, 25);
    expect(store.canRedo).toBe(false);
  });

  it("an edit that returns the same design records nothing", () => {
    const store = new AppStore(createDemoMovement());
    store.edit((m) => m);
    expect(store.canUndo).toBe(false);
  });

  it("loading a new design can be undone", () => {
    const demo = createDemoMovement();
    const store = new AppStore(demo);
    store.load({ ...demo, name: "Other" });
    store.undo();
    expect(store.movement).toBe(demo);
  });

  it("removing the selected part clears the selection; undo restores the part", () => {
    const store = new AppStore(createDemoMovement());
    const arbor = Object.values(store.movement.shafts)[0];
    if (arbor === undefined) throw new Error("no shaft");
    store.select(arbor.id);
    store.remove(arbor.id);
    expect(store.selectedId).toBeNull();
    expect(store.movement.shafts[arbor.id]).toBeUndefined();
    store.undo();
    expect(store.movement.shafts[arbor.id]).toBeDefined();
  });
});
