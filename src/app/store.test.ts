import { describe, expect, it } from "vitest";
import { radiansPerSecond } from "@/units/angularVelocity";
import { NUMERICAL_PARAMETERS } from "@/reference/numericalParameters";
import { AppStore } from "./store";
import { addCoupling, addGearMesh, addJewel, drivenShaftId, setBalanceDrive, setNominalTimeDrive, updateCouplingSpring, updateEscapement, type Movement } from "@/domain/movement";
import { createEmptyMovement, newFrictionClutch, newGearMesh, newJewel } from "@/domain/editing";
import type { CouplingId } from "@/domain/coupling";
import { degrees, toDegrees } from "@/units/angle";
import { analyzeMovement } from "@/analysis/analyzeMovement";
import { summarizeEnergy } from "@/kinematics/energySummary";
import { createDemoMovement } from "./demoMovement";
import { createTeachingMovement } from "./teachingMovement";
import { TUTORIAL_STEPS } from "./tutorial/tutorialSteps";

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
    const { setNominalTimeDrive } = await import("@/domain/movement");
    const store = new AppStore(setNominalTimeDrive(createTeachingMovement()));
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

  it("tracks the exact point picked alongside each part, for the on-screen ruler", () => {
    const store = new AppStore(createDemoMovement());
    const [g1, g2, g3] = Object.values(store.movement.gears).map((g) => g.id);
    if (g1 === undefined || g2 === undefined || g3 === undefined) throw new Error("gears");
    store.setMeasuring(true);
    const pa = { x: 1e-3, y: 2e-3, z: 3e-3 };
    store.select(g1, pa);
    expect(store.measurePoints).toEqual([pa, null]);
    const pb = { x: 4e-3, y: 5e-3, z: 6e-3 };
    store.select(g2, pb);
    expect(store.measurePoints).toEqual([pa, pb]);
    // Starting over (A already has B) drops the stale point too.
    const pc = { x: 7e-3, y: 8e-3, z: 9e-3 };
    store.select(g3, pc);
    expect(store.measurePoints).toEqual([pc, null]);
  });

  it("has no point when a pick came from outside the viewport (e.g. the tree)", () => {
    const store = new AppStore(createDemoMovement());
    const gear = Object.values(store.movement.gears)[0];
    if (gear === undefined) throw new Error("gear");
    store.setMeasuring(true);
    store.select(gear.id); // no point argument, as a tree/inspector "Select" click would do
    expect(store.measurePoints).toEqual([null, null]);
  });

  it("forgets a measured point when its part is deleted", () => {
    const store = new AppStore(createDemoMovement());
    const gear = Object.values(store.movement.gears)[0];
    if (gear === undefined) throw new Error("gear");
    store.setMeasuring(true);
    store.select(gear.id, { x: 1e-3, y: 2e-3, z: 3e-3 });
    store.remove(gear.id);
    expect(store.measurePoints).toEqual([null, null]);
  });
});

describe("mainspring wind and run-down (ASM-0026)", () => {
  // Choose Q so the amplitude fully wound is 30°, just above half the 50° lift angle: A ∝ √Q.
  const withStop = (): Movement => {
    const teaching = createTeachingMovement();
    const esc = Object.values(teaching.escapements)[0];
    if (esc === undefined) throw new Error("no escapement");
    const withLosses = (q: number): Movement =>
      updateEscapement(teaching, esc.id, { escapementEfficiency: 0.35, balance: { ...esc.balance, qualityFactor: q } });
    const probe = withLosses(1);
    const a1 = summarizeEnergy(probe, analyzeMovement(probe).train)?.amplitudeFull ?? Number.NaN;
    return withLosses((degrees(30) / a1) ** 2);
  };
  const springId = (store: AppStore): CouplingId => {
    const id = store.energy?.spring.id;
    if (id === undefined) throw new Error("no mainspring");
    return id;
  };
  // 60× playback in ticks of 1/15 s is 960 steps per tick, the per-advance cap, so no time is dropped.
  const runFor = (store: AppStore, simulatedSeconds: number, ticksPerSecond = 15): void => {
    store.setPlaybackRate(60);
    const ticks = Math.round((simulatedSeconds / 60) * ticksPerSecond);
    for (let i = 0; i < ticks; i += 1) store.tick(1 / ticksPerSecond);
  };
  const setWind = (store: AppStore, turns: number): void => {
    store.simulation = { ...store.simulation, mainspringWind: { ...store.simulation.mainspringWind, [springId(store)]: turns } };
  };

  it("starts fully wound and unwinds at the drum's running speed", () => {
    const store = new AppStore(createTeachingMovement());
    expect(store.mainspringWindTurns).toBe(6.5);
    // The balance-governed train runs 7.02 s/day slow, so the drum is a hair under 1/6 rev/h.
    expect((store.reserveRemainingSeconds ?? 0) / 3600).toBeCloseTo(39 * (86400 / (86400 - 7.02)), 3);
    runFor(store, 60);
    expect(6.5 - (store.mainspringWindTurns ?? 0)).toBeCloseTo(60 / 21600, 6);
    expect(store.goingTrainStopped).toBe(false);
  });

  it("stops the balance-governed going train where the balance can no longer unlock, at the same step however time is split", () => {
    const run = (splits: number): AppStore => {
      const store = new AppStore(withStop());
      const stop = store.runDownWindTurns ?? Number.NaN;
      setWind(store, stop + 60 / 21600 / 2); // about 30 s of running left
      runFor(store, 60, splits);
      return store;
    };
    const whole = run(15);
    const split = run(60);
    expect(whole.goingTrainStopped).toBe(true);
    // Ids differ between the two designs; the states must match value for value.
    expect(Object.values(whole.simulation.mainspringWind)).toEqual(Object.values(split.simulation.mainspringWind));
    expect(Object.values(whole.simulation.shaftAngle)).toEqual(Object.values(split.simulation.shaftAngle));
    expect([...whole.effectiveTrain.shaftAngularVelocity.values()].every((w) => w === 0)).toBe(true);
    expect(whole.displayAmplitude).toBe(0);
    expect(whole.reserveRemainingSeconds).toBe(0);
    // Validation still judges the running train; stopping is simulation state, not a design change.
    expect(whole.analysis.train.shaftAngularVelocity.size).toBeGreaterThan(0);
  });

  it("winding at the crown while stopped turns only the arbor, and restarts the train once above the stop", () => {
    const store = new AppStore(withStop());
    const stop = store.runDownWindTurns ?? Number.NaN;
    setWind(store, stop);
    expect(store.goingTrainStopped).toBe(true);
    store.setCrownAction("WIND");
    store.tick(0.25); // a quarter turn of the crown at 1×
    expect(store.mainspringWindTurns ?? 0).toBeGreaterThan(stop);
    expect(store.goingTrainStopped).toBe(false);
    const amplitude = store.displayAmplitude ?? degrees(0);
    expect(toDegrees(amplitude)).toBeGreaterThan(25);
  });

  it("a movement with an imposed drive keeps turning when let down, and its wind stays at zero", () => {
    const store = new AppStore(setNominalTimeDrive(createTeachingMovement()));
    expect(store.runDownWindTurns).toBeNull();
    setWind(store, 0);
    store.tick(0.1);
    expect(store.goingTrainStopped).toBe(false);
    expect(store.mainspringWindTurns).toBe(0);
    expect(store.reserveRemainingSeconds).toBe(0);
  });

  it("giving a spring data during a session starts it fully wound; removing it drops the wind", () => {
    const store = new AppStore(createTeachingMovement());
    const id = springId(store);
    store.edit((m) => updateCouplingSpring(m, id, null));
    expect(store.mainspringWindTurns).toBeNull();
    expect(store.simulation.mainspringWind[id]).toBeUndefined();
    store.undo();
    expect(store.mainspringWindTurns).toBe(6.5);
  });
});

describe("AppStore guided tutorial", () => {
  const stepId = (store: AppStore): string | undefined => store.tutorialStep?.id;

  it("starts on the first step, asking for an empty movement, when the current design isn't one", () => {
    const store = new AppStore(createTeachingMovement());
    store.startTutorial();
    expect(store.tutorialActive).toBe(true);
    expect(stepId(store)).toBe("start-empty");
  });

  it("skips the first step immediately if the design is already empty when the tutorial starts", () => {
    const store = new AppStore(createEmptyMovement());
    store.startTutorial();
    expect(stepId(store)).toBe("add-mainplate");
  });

  /** Finds an entity by its (unique-within-collection) name, the same way a user would recognise it in the tree. */
  function byName<T extends { name: string; id: string }>(record: Record<string, T>, name: string): T {
    const found = Object.values(record).find((e) => e.name === name);
    if (found === undefined) throw new Error(`no entity named "${name}"`);
    return found;
  }

  /** Runs one tutorial step exactly as its UI control would, whether or not it has a preload override. */
  function runStep(store: AppStore): void {
    const step = store.tutorialStep;
    if (step === null) throw new Error("no active tutorial step");
    if (step.createOverride !== undefined) {
      store.runTutorialCreation(step.id, step.createOverride);
      return;
    }
    const m = store.movement;
    switch (step.id) {
      case "mesh-barrel-centre":
        store.edit((mv) => addGearMesh(mv, newGearMesh(byName(m.gears, "Barrel drum").id, byName(m.gears, "Centre pinion").id)));
        return;
      case "mesh-centre-third":
        store.edit((mv) => addGearMesh(mv, newGearMesh(byName(m.gears, "Centre wheel").id, byName(m.gears, "Third pinion").id)));
        return;
      case "mesh-third-fourth":
        store.edit((mv) => addGearMesh(mv, newGearMesh(byName(m.gears, "Third wheel").id, byName(m.gears, "Fourth pinion").id)));
        return;
      case "mesh-fourth-escape":
        store.edit((mv) => addGearMesh(mv, newGearMesh(byName(m.gears, "Fourth wheel").id, byName(m.gears, "Escape pinion").id)));
        return;
      case "mesh-cannon-minute": {
        const cannonGear = Object.values(m.gears).find((g) => g.name === "Cannon pinion" && g.shaftId === byName(m.shafts, "Cannon pinion").id);
        const minuteGear = Object.values(m.gears).find((g) => g.name === "Minute wheel" && g.toothCount === 30);
        if (cannonGear === undefined || minuteGear === undefined) throw new Error("mesh-cannon-minute: gears missing");
        store.edit((mv) => addGearMesh(mv, newGearMesh(cannonGear.id, minuteGear.id)));
        return;
      }
      case "mesh-minute-hour": {
        const hourGear = Object.values(m.gears).find((g) => g.name === "Hour wheel" && g.shaftId === byName(m.shafts, "Hour wheel").id);
        if (hourGear === undefined) throw new Error("mesh-minute-hour: hour wheel gear missing");
        store.edit((mv) => addGearMesh(mv, newGearMesh(byName(m.gears, "Minute pinion").id, hourGear.id)));
        return;
      }
      case "mesh-crown-ratchet": {
        const crownGear = Object.values(m.gears).find((g) => g.name === "Crown wheel" && g.shaftId === byName(m.shafts, "Crown wheel").id);
        if (crownGear === undefined) throw new Error("mesh-crown-ratchet: crown wheel gear missing");
        store.edit((mv) => addGearMesh(mv, newGearMesh(crownGear.id, byName(m.gears, "Ratchet wheel").id)));
        return;
      }
      case "mesh-setting-minute": {
        const settingGear = Object.values(m.gears).find((g) => g.name === "Setting wheel" && g.shaftId === byName(m.shafts, "Setting wheel").id);
        const minuteGear = Object.values(m.gears).find((g) => g.name === "Minute wheel" && g.toothCount === 30);
        if (settingGear === undefined || minuteGear === undefined) throw new Error("mesh-setting-minute: gears missing");
        store.edit((mv) => addGearMesh(mv, newGearMesh(settingGear.id, minuteGear.id)));
        return;
      }
      case "mesh-hour-moon1":
        store.edit((mv) => addGearMesh(mv, newGearMesh(byName(m.gears, "Moon pinion").id, byName(m.gears, "Moon wheel 1").id)));
        return;
      case "mesh-moon1-moon2":
        store.edit((mv) => addGearMesh(mv, newGearMesh(byName(m.gears, "Moon pinion 2").id, byName(m.gears, "Moon wheel 2").id)));
        return;
      case "mesh-hour-twenty-four-hour":
        store.edit((mv) => addGearMesh(mv, newGearMesh(byName(m.gears, "24-hour pinion").id, byName(m.gears, "24-hour wheel").id)));
        return;
      case "add-bearings": {
        const mainplate = byName(m.frames, "Mainplate");
        const trainBridge = byName(m.frames, "Train bridge");
        const balanceCock = byName(m.frames, "Balance cock");
        for (const name of ["Barrel", "Centre arbor", "Third arbor", "Fourth arbor", "Escape arbor"]) {
          const shaft = byName(m.shafts, name);
          store.edit((mv) => addJewel(mv, newJewel(mv, shaft.id, "LOWER", mainplate.id)));
          store.edit((mv) => addJewel(mv, newJewel(mv, shaft.id, "UPPER", trainBridge.id)));
        }
        for (const name of ["Pallet arbor", "Balance staff"]) {
          const shaft = byName(m.shafts, name);
          store.edit((mv) => addJewel(mv, newJewel(mv, shaft.id, "LOWER", mainplate.id)));
          store.edit((mv) => addJewel(mv, newJewel(mv, shaft.id, "UPPER", balanceCock.id)));
        }
        return;
      }
      case "add-clutch": {
        const cannonShaft = byName(m.shafts, "Cannon pinion");
        const centreShaft = byName(m.shafts, "Centre arbor");
        store.edit((mv) => addCoupling(mv, newFrictionClutch(mv, cannonShaft.id, centreShaft.id)));
        return;
      }
      case "set-balance-drive":
        store.edit((mv) => setBalanceDrive(mv));
        return;
      default:
        throw new Error(`runStep: no handler for step "${step.id}"`);
    }
  }

  it("the full teaching-movement walkthrough reaches validation, matching the real design structurally", () => {
    const store = new AppStore(createEmptyMovement());
    store.startTutorial();
    expect(stepId(store)).toBe("add-mainplate"); // "start-empty" completes immediately (see the skip test above)

    while (stepId(store) !== "check-validation") {
      const before = stepId(store);
      runStep(store);
      expect(stepId(store), `step "${String(before)}" should have advanced`).not.toBe(before);
    }
    expect(store.tutorialActive).toBe(true);

    // The last step has no completion check: only "Done" (advanceTutorial) ends it.
    store.advanceTutorial();
    expect(store.tutorialActive).toBe(false);

    const reference = createTeachingMovement();
    const built = store.movement;
    expect(Object.keys(built.frames)).toHaveLength(Object.keys(reference.frames).length);
    expect(Object.keys(built.shafts)).toHaveLength(Object.keys(reference.shafts).length);
    expect(Object.keys(built.gears)).toHaveLength(Object.keys(reference.gears).length);
    expect(Object.keys(built.gearMeshes)).toHaveLength(Object.keys(reference.gearMeshes).length);
    expect(Object.keys(built.jewels)).toHaveLength(Object.keys(reference.jewels).length);
    expect(Object.keys(built.couplings)).toHaveLength(Object.keys(reference.couplings).length);
    expect(Object.keys(built.keylessWorks)).toHaveLength(1);
    expect(Object.keys(built.dials)).toHaveLength(1);
    expect(Object.keys(built.escapements)).toHaveLength(1);

    // Same open questions as the real design (unset bore/pivot/etc.), nothing silently filled in.
    // Compared by rule/severity/message, not raw issue id: meshes, jewels and the clutch get fresh
    // ids from the normal (non-preloaded) creation path, so their issue ids differ even though the
    // messages (which name parts, not ids) are the same.
    const summarize = (issues: ReturnType<typeof analyzeMovement>["issues"]): string[] =>
      issues.map((i) => `${i.rule}:${i.severity}:${i.message}`).sort();
    expect(summarize(analyzeMovement(built).issues)).toEqual(summarize(analyzeMovement(reference).issues));
  });

  it("advanceTutorial skips the current step regardless of whether the design satisfies it", () => {
    const store = new AppStore(createTeachingMovement());
    store.startTutorial();
    const before = stepId(store);
    store.advanceTutorial();
    expect(stepId(store)).not.toBe(before);
  });

  it("stopTutorial exits without changing the design", () => {
    const store = new AppStore(createEmptyMovement());
    const before = store.movement;
    store.startTutorial();
    store.stopTutorial();
    expect(store.tutorialActive).toBe(false);
    expect(store.tutorialStep).toBeNull();
    expect(store.movement).toBe(before);
  });

  it("every step's id is unique and only the last has no completion check", () => {
    const ids = TUTORIAL_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(TUTORIAL_STEPS.slice(0, -1).every((s) => s.isComplete !== null)).toBe(true);
    expect(TUTORIAL_STEPS.at(-1)?.isComplete).toBeNull();
  });
});
