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
    store.simulationTrain = { ...store.simulationTrain, shaftAngularVelocity: new Map([[drive, radiansPerSecond(Infinity)]]) };
    store.tick(0.1);
    expect(store.simulationHalted).toBe(true);
    expect(store.issues.some((i) => i.id === "SIM-001:halted" && i.severity === "blocker")).toBe(true);
    store.tick(0.1);
    expect(store.simulation.stepCount).toBe(0);
    store.edit((m) => ({ ...m, name: `${m.name} (edited)` }));
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

describe("AppStore history", () => {
  it("an edit that changes nothing is not an undo step", () => {
    const store = new AppStore(createDemoMovement());
    store.edit((m) => ({ ...m, name: "Renamed" }));
    store.edit((m) => ({ ...m, name: "Renamed" })); // e.g. the field fires change again on blur
    store.undo();
    expect(store.movement.name).not.toBe("Renamed");
    expect(store.canUndo).toBe(false);
  });
});

describe("AppStore hand setting", () => {
  it("setting through the crown moves the hands fast while the going train keeps time", async () => {
    const { createTeachingMovement } = await import("./teachingMovement");
    const store = new AppStore(createTeachingMovement());
    const id = (name: string): keyof typeof store.movement.shafts => {
      const s = Object.values(store.movement.shafts).find((x) => x.name === name);
      if (s === undefined) throw new Error(name);
      return s.id;
    };
    store.setCrownAction("SET_FORWARD");
    store.tick(0.125);
    // Crown at 1 rev/s; the teaching setting train turns the minutes hand 2 rev per crown rev: a quarter turn in 0.125 s.
    expect(store.simulation.shaftAngle[id("Cannon pinion")]).toBeCloseTo(Math.PI / 2, 9);
    expect(store.simulation.shaftAngle[id("Centre arbor")]).toBeCloseTo((2 * Math.PI * 0.125) / 3600, 12);
    store.setCrownAction("RUNNING");
    expect(store.simulationTrain).toBe(store.analysis.train);
  });

  it("winding turns the barrel arbor the winding way; reversed, the ratchet teeth slip", async () => {
    const { createTeachingMovement } = await import("./teachingMovement");
    const store = new AppStore(createTeachingMovement());
    const arbor = Object.values(store.movement.shafts).find((s) => s.name === "Barrel arbor");
    const drum = Object.values(store.movement.shafts).find((s) => s.name === "Barrel");
    if (arbor === undefined || drum === undefined) throw new Error("barrel");
    store.setCrownAction("WIND");
    expect(store.simulationTrain.winding.status).toBe("WINDING");
    expect(Math.sign(store.simulationTrain.shaftAngularVelocity.get(arbor.id) ?? 0))
      .toBe(Math.sign(store.analysis.train.shaftAngularVelocity.get(drum.id) ?? Number.NaN));
    store.setCrownAction("WIND_REVERSE");
    expect(store.simulationTrain.winding.status).toBe("SLIPPING");
  });

  it("without keyless works, setting turns the minutes hand directly", () => {
    const store = new AppStore(createDemoMovement());
    store.setCrownAction("SET_FORWARD");
    expect(store.simulationTrain.mode).toBe("HAND_SETTING");
  });
});

describe("AppStore measure mode", () => {
  it("takes the next two picks as A and B, then starts over", () => {
    const store = new AppStore(createDemoMovement());
    const [g1, g2, g3] = Object.values(store.movement.gears).map((g) => g.id);
    if (g1 === undefined || g2 === undefined || g3 === undefined) throw new Error("gears");
    store.setMeasuring(true);
    store.select(g1);
    expect(store.measureIds).toEqual([g1, null]);
    store.select(g2);
    expect(store.measureIds).toEqual([g1, g2]);
    store.select(g3);
    expect(store.measureIds).toEqual([g3, null]);
    store.setMeasuring(false);
    expect(store.measureIds).toEqual([null, null]);
  });

  it("forgets a measured part that is deleted", () => {
    const store = new AppStore(createDemoMovement());
    const gear = Object.values(store.movement.gears)[0];
    if (gear === undefined) throw new Error("gear");
    store.setMeasuring(true);
    store.select(gear.id);
    store.remove(gear.id);
    expect(store.measureIds).toEqual([null, null]);
  });
});
