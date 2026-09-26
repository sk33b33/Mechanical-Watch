import { describe, expect, it } from "vitest";
import { radiansPerSecond } from "@/units/angularVelocity";
import { NUMERICAL_PARAMETERS } from "@/reference/numericalParameters";
import { AppStore } from "./store";
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
    const drive = store.movement.drivingShaftId;
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
