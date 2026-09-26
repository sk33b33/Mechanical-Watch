import { PLAYBACK_RATES, type AppStore, type CrownAction, type PlaybackRate } from "@/app/store";
import { SETTING_UNAVAILABLE_TEXT, WINDING_UNAVAILABLE_TEXT } from "@/kinematics/keylessSummary";
import type { Movement } from "@/domain/movement";
import { decodeDesign, DesignFileError, encodeDesign } from "@/persistence/designFile";
import { createEmptyMovement } from "@/domain/editing";
import { createDemoMovement } from "@/app/demoMovement";
import { createTeachingMovement } from "@/app/teachingMovement";
import { readHand } from "@/kinematics/timeDisplay";
import type { HandFunction } from "@/domain/shaft";

export interface Toolbar {
  element: HTMLElement;
  /** Shows a message that stays until dismissed or replaced. */
  notify(message: string, kind: "error" | "info"): void;
  setAutosaveStatus(text: string): void;
  /** Adds a button to the file group (after Save). */
  addFileAction(label: string, title: string, onClick: () => void): void;
}

function fileName(movement: Movement): string {
  const slug = movement.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${slug === "" ? "movement" : slug}.mw3d.json`;
}

function button(label: string, title: string, onClick: () => void): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.textContent = label;
  el.title = title;
  el.addEventListener("click", onClick);
  return el;
}

export function mountToolbar(container: HTMLElement, store: AppStore): Toolbar {
  container.innerHTML = "";

  const fileGroup = document.createElement("div");
  fileGroup.className = "toolbar-group";

  const picker = document.createElement("input");
  picker.type = "file";
  picker.accept = ".json,application/json";
  picker.hidden = true;
  picker.addEventListener("change", () => {
    const file = picker.files?.[0];
    picker.value = "";
    if (file === undefined) return;
    file
      .text()
      .then((text) => {
        store.load(decodeDesign(text));
        toolbar.notify(`Opened ${file.name}.`, "info");
      })
      .catch((error: unknown) => {
        toolbar.notify(
          `Could not open ${file.name}: ${error instanceof DesignFileError ? error.message : String(error)}`,
          "error",
        );
      });
  });

  const newSelect = document.createElement("select");
  newSelect.dataset.testid = "new-design";
  newSelect.title = "Start a new design. The current one can be brought back with Undo.";
  for (const [value, label] of [
    ["", "New…"],
    ["empty", "Empty movement"],
    ["teaching", "Teaching movement (going train + motion works)"],
    ["demo", "Gear-train demo (three arbors)"],
  ] as const) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    newSelect.appendChild(option);
  }
  newSelect.addEventListener("change", () => {
    const choice = newSelect.value;
    newSelect.value = "";
    if (choice === "") return;
    store.load(choice === "empty" ? createEmptyMovement() : choice === "teaching" ? createTeachingMovement() : createDemoMovement());
    toolbar.notify(
      `Started ${choice === "empty" ? "an empty movement" : "from a template"}. Undo (Ctrl+Z) brings back the previous design.`,
      "info",
    );
  });

  const undoButton = button("Undo", "Undo (Ctrl+Z)", () => { store.undo(); });
  const redoButton = button("Redo", "Redo (Ctrl+Shift+Z or Ctrl+Y)", () => { store.redo(); });

  fileGroup.append(
    newSelect,
    button("Open…", "Open a saved design (.mw3d.json)", () => {
      picker.click();
    }),
    button("Save", "Download this design as a file", () => {
      const blob = new Blob([encodeDesign(store.movement)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName(store.movement);
      link.click();
      URL.revokeObjectURL(url);
    }),
    picker,
  );

  const autosave = document.createElement("span");
  autosave.className = "toolbar-status";

  const notice = document.createElement("div");
  notice.className = "toolbar-notice";
  notice.dataset.testid = "toolbar-notice";
  notice.hidden = true;
  const noticeText = document.createElement("span");
  const dismiss = button("×", "Dismiss", () => {
    notice.hidden = true;
  });
  dismiss.className = "notice-dismiss";
  notice.append(noticeText, dismiss);

  const spacer = document.createElement("div");
  spacer.className = "toolbar-spacer";

  const simGroup = document.createElement("div");
  simGroup.className = "toolbar-group";
  const playButton = button("", "Play or pause the kinematic simulation", () => {
    store.setPlaying(!store.playing);
  });
  playButton.classList.add("play-button");
  const rateSelect = document.createElement("select");
  rateSelect.title = "Playback speed (simulated seconds per real second)";
  for (const rate of PLAYBACK_RATES) {
    const option = document.createElement("option");
    option.value = String(rate);
    option.textContent = `${String(rate)}×`;
    rateSelect.appendChild(option);
  }
  rateSelect.addEventListener("change", () => {
    store.setPlaybackRate(Number(rateSelect.value) as PlaybackRate);
  });
  const clock = document.createElement("span");
  clock.className = "toolbar-clock";
  clock.dataset.testid = "sim-clock";
  clock.title = "Simulated time. Fixed-step kinematic simulation (SIM-002).";
  const dial = document.createElement("span");
  dial.className = "toolbar-clock";
  dial.dataset.testid = "dial-reading";
  dial.title = "Time shown by the simulated hand angles, each hand read on its own (ASM-0014). Starts at 12:00:00.";
  const reserve = document.createElement("span");
  reserve.className = "toolbar-clock";
  reserve.dataset.testid = "reserve";
  reserve.title =
    "State of wind of the mainspring and running time left (SIMPLIFIED ENERGY MODEL, L3, ASM-0026). Starts fully wound. A balance-governed movement stops where the balance can no longer unlock, or when let down; an imposed drive keeps turning.";
  const modeSelect = document.createElement("select");
  modeSelect.dataset.testid = "crown-action";
  let modeOptionsKey = "";
  const renderModeOptions = (): void => {
    const keyless = Object.keys(store.movement.keylessWorks).length > 0;
    const key = keyless ? "crown" : "direct";
    if (key === modeOptionsKey) return;
    modeOptionsKey = key;
    modeSelect.innerHTML = "";
    const options: [CrownAction, string][] = keyless
      ? [
          ["RUNNING", "Running (crown in)"],
          ["SET_FORWARD", "Crown out: set hands forward"],
          ["SET_BACKWARD", "Crown out: set hands backward"],
          ["WIND", "Crown in: wind"],
          ["WIND_REVERSE", "Crown in: turn backward"],
        ]
      : [["RUNNING", "Running"], ["SET_FORWARD", "Set hands forward"], ["SET_BACKWARD", "Set hands backward"]];
    for (const [value, label] of options) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      modeSelect.appendChild(option);
    }
    modeSelect.title = keyless
      ? "Turn the crown (1 rev/s). Out: the sliding pinion drives the setting train and the friction clutch slips. In: the ratchet teeth wind in one direction and slip in the other. The going train keeps running (ASM-0015, ASM-0019)."
      : "Running: clutches engaged. Setting: friction clutches slip and the hands are turned directly (1 h per second) while the going train keeps running (ASM-0015). Add keyless works to set through a crown.";
  };
  renderModeOptions();
  modeSelect.addEventListener("change", () => {
    store.setCrownAction(modeSelect.value as CrownAction);
    const train = store.simulationTrain;
    if (train.setting.status === "UNAVAILABLE") {
      toolbar.notify(`The hands can't be set: ${SETTING_UNAVAILABLE_TEXT[train.setting.reason]} (see SET-001 / KEY-004).`, "error");
    } else if (train.winding.status === "UNAVAILABLE") {
      toolbar.notify(`Winding can't be shown: ${WINDING_UNAVAILABLE_TEXT[train.winding.reason]} (see KEY-003).`, "error");
    } else if (train.winding.status === "SLIPPING") {
      toolbar.notify("Turned backward, the stem's ratchet teeth slip over the winding pinion: nothing is wound.", "info");
    }
  });
  simGroup.append(
    modeSelect,
    playButton,
    button("Step", "Advance one fixed simulation step", () => {
      store.stepOnce();
    }),
    button("Reset", "Return every shaft to its starting angle at t = 0", () => {
      store.resetSimulation();
    }),
    rateSelect,
    clock,
    dial,
    reserve,
  );

  const editGroup = document.createElement("div");
  editGroup.className = "toolbar-group";
  editGroup.append(undoButton, redoButton);

  container.append(fileGroup, editGroup, autosave, notice, spacer, simGroup);

  // Undo/redo shortcuts, except while typing, where the field's own text undo applies.
  window.addEventListener("keydown", (event) => {
    const target = event.target as HTMLElement | null;
    if (target !== null && ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) return;
    if (!(event.ctrlKey || event.metaKey)) return;
    const key = event.key.toLowerCase();
    if (key === "z" && !event.shiftKey) {
      event.preventDefault();
      store.undo();
    } else if ((key === "z" && event.shiftKey) || key === "y") {
      event.preventDefault();
      store.redo();
    }
  });

  const refreshControls = (): void => {
    undoButton.disabled = !store.canUndo;
    redoButton.disabled = !store.canRedo;
    playButton.textContent = store.playing ? "Pause" : "Play";
    rateSelect.value = String(store.playbackRate);
    renderModeOptions();
    modeSelect.value = store.crownAction;
  };
  const handReading = (hand: HandFunction): number | null => {
    const shafts = Object.values(store.movement.shafts).filter((sh) => sh.hand === hand);
    const only = shafts.length === 1 ? shafts[0] : undefined;
    return only === undefined ? null : readHand(hand, store.simulation.shaftAngle[only.id] ?? 0);
  };
  const refreshClock = (): void => {
    const state = store.simulationHalted ? "halted" : store.playing ? "" : "paused";
    clock.textContent = `t = ${store.simulation.time.toFixed(3)} s${state === "" ? "" : ` (${state})`}`;
    const [h, m, sec] = (["HOURS", "MINUTES", "SECONDS"] as const).map(handReading);
    const two = (v: number | null | undefined): string => (v === null || v === undefined ? "--" : String(Math.floor(v)).padStart(2, "0"));
    const hours = h === null || h === undefined ? "--" : String(Math.floor(h) === 0 ? 12 : Math.floor(h));
    dial.textContent = `Dial ${hours}:${two(m)}:${two(sec)}`;
    const wind = store.mainspringWindTurns;
    const left = store.reserveRemainingSeconds;
    reserve.hidden = wind === null;
    reserve.classList.toggle("run-down", store.goingTrainStopped);
    if (wind !== null) {
      const turns = `Spring ${wind.toFixed(2)} turns`;
      reserve.textContent = store.goingTrainStopped
        ? `${turns} · stopped: wind the crown`
        : `${turns}${left === null ? "" : ` · ${(left / 3600).toFixed(1)} h left`}`;
    }
  };
  refreshControls();
  refreshClock();
  store.subscribe(() => {
    refreshControls();
    refreshClock();
  });
  // The simulation advances every frame without notifying; poll the clock at a readable rate.
  window.setInterval(refreshClock, 100);

  const toolbar: Toolbar = {
    element: container,
    notify(message, kind) {
      noticeText.textContent = message;
      notice.className = `toolbar-notice notice-${kind}`;
      notice.hidden = false;
    },
    addFileAction(label, title, onClick) {
      fileGroup.insertBefore(button(label, title, onClick), picker);
    },
    setAutosaveStatus(text) {
      autosave.textContent = text;
    },
  };
  return toolbar;
}
