import { PLAYBACK_RATES, type AppStore, type PlaybackRate } from "@/app/store";
import type { Movement } from "@/domain/movement";
import { decodeDesign, DesignFileError, encodeDesign } from "@/persistence/designFile";
import { createEmptyMovement } from "@/domain/editing";
import { createDemoMovement } from "@/app/demoMovement";

export interface Toolbar {
  element: HTMLElement;
  /** Shows a message that stays until dismissed or replaced. */
  notify(message: string, kind: "error" | "info"): void;
  setAutosaveStatus(text: string): void;
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
  newSelect.title = "Start a new design. The current one can be brought back with Undo.";
  for (const [value, label] of [["", "New…"], ["empty", "Empty movement"], ["demo", "Demo template"]] as const) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    newSelect.appendChild(option);
  }
  newSelect.addEventListener("change", () => {
    const choice = newSelect.value;
    newSelect.value = "";
    if (choice === "") return;
    store.load(choice === "empty" ? createEmptyMovement() : createDemoMovement());
    toolbar.notify(
      `Started ${choice === "empty" ? "an empty movement" : "from the demo template"}. Undo (Ctrl+Z) brings back the previous design.`,
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
  clock.title = "Simulated time. Fixed-step kinematic simulation (SIM-002).";
  simGroup.append(
    playButton,
    button("Step", "Advance one fixed simulation step", () => {
      store.stepOnce();
    }),
    button("Reset", "Return every shaft to its starting angle at t = 0", () => {
      store.resetSimulation();
    }),
    rateSelect,
    clock,
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
  };
  const refreshClock = (): void => {
    const state = store.simulationHalted ? "halted" : store.playing ? "" : "paused";
    clock.textContent = `t = ${store.simulation.time.toFixed(3)} s${state === "" ? "" : ` (${state})`}`;
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
    setAutosaveStatus(text) {
      autosave.textContent = text;
    },
  };
  return toolbar;
}
