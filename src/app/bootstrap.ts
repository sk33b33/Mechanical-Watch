import { AppStore } from "./store";
import { createTeachingMovement } from "./teachingMovement";
import { Viewport } from "@/viewport/viewport";
import { mountViewportControls } from "@/viewport/viewportControls";
import { mountMeasurementPanel } from "./panels/measurementPanel";
import { mountProjectsDialog } from "./panels/projectsDialog";
import { mountOutputsDialog } from "./panels/outputsDialog";
import { mountChainDiagramDialog } from "./panels/chainDiagramDialog";
import { browserStore, loadAutosave, writeAutosave } from "@/persistence/autosave";
import { mountHeader } from "./panels/header";
import { mountToolbar } from "./panels/toolbar";
import { mountComponentTree } from "./panels/componentTree";
import { mountInspector } from "./panels/inspector/index";
import { mountValidationConsole } from "./panels/validationConsole";
import { mountTutorialBanner } from "./panels/tutorialBanner";
import { mountTickSound } from "./audio/tickSound";
import { unlockAudioOnFirstGesture } from "./audio/audioContext";
import { chooseStartupMovement } from "./startup";
import { PanelLayout } from "./layout/panelWindows";
import { mountLayoutControls } from "./layout/layoutControls";

function panel(parent: HTMLElement, className: string): HTMLDivElement {
  const el = document.createElement("div");
  el.className = className;
  parent.appendChild(el);
  return el;
}

export interface BootstrappedApp {
  store: AppStore;
  viewport: Viewport;
}

export function bootstrapApp(root: HTMLElement, plainStart = false): BootstrappedApp {
  root.innerHTML = "";
  const workspace = panel(root, "workspace");
  const header = panel(workspace, "header");
  const headerInfo = panel(header, "header-info");
  const layoutControlsEl = panel(header, "layout-controls");
  const toolbarEl = panel(workspace, "toolbar");
  const viewportEl = panel(workspace, "viewport");
  const readouts = panel(viewportEl, "sim-readouts");

  const storage = browserStore();
  const saved = loadAutosave(storage);
  const choice = chooseStartupMovement(saved, storage, createTeachingMovement, plainStart);
  const store = new AppStore(choice.movement);

  mountHeader(headerInfo, store);
  const toolbar = mountToolbar(toolbarEl, store, readouts);
  // Side panels live in windows that can dock, float over the movement, open separately or close.
  const layout = new PanelLayout(workspace, storage, (message, kind) => { toolbar.notify(message, kind); });
  mountComponentTree(layout.add("tree", "panel tree").body, store);
  mountInspector(layout.add("inspector", "panel inspector").body, store, storage, (message, kind) => { toolbar.notify(message, kind); });
  const consoleWindow = layout.add("console", "panel console");
  mountValidationConsole(consoleWindow.body, store, consoleWindow.setTitle);
  mountLayoutControls(layoutControlsEl, layout);
  const viewport = new Viewport(viewportEl, store);
  mountViewportControls(viewportEl, viewport, store);
  mountMeasurementPanel(viewportEl, store);

  const projects = mountProjectsDialog(root, store, storage, (message, kind) => { toolbar.notify(message, kind); });
  toolbar.addFileAction("Projects…", "Designs saved in this browser", () => { projects.open(); });
  const outputs = mountOutputsDialog(root, store, (message, kind) => { toolbar.notify(message, kind); });
  const chain = mountChainDiagramDialog(root, store);
  toolbar.addFileAction("Chain…", "Diagram of how every part is connected, from the mainspring to the escapement and the calendar", () => { chain.open(); });
  toolbar.addFileAction("Outputs…", "Engineering report, BOM, drawings and exports", () => { outputs.open(); });
  mountTutorialBanner(store, storage);
  toolbar.addSimControl(mountTickSound(store, storage));
  unlockAudioOnFirstGesture();
  // The tutorial points at buttons in the Components and Inspector panels, so starting it slides those flyouts out.
  let tutorialWasActive = false;
  store.subscribe(() => {
    if (store.tutorialActive && !tutorialWasActive) layout.openFlyouts(["tree", "inspector"]);
    tutorialWasActive = store.tutorialActive;
  });
  toolbar.addFileAction("Tutorial…", "Guided walkthrough: build a movement from scratch", () => { store.startTutorial(); });

  if (choice.preserved !== null) {
    toolbar.notify(
      choice.preserveProblem === null
        ? `Opened the teaching movement. Your last session's design “${choice.preserved.name}” is kept in Projects…`
        : `Opened the teaching movement. Your last session's design “${choice.preserved.name}” could not be kept in Projects: ${choice.preserveProblem}`,
      choice.preserveProblem === null ? "info" : "error",
    );
  }
  if (saved.status === "UNREADABLE") {
    toolbar.notify(
      `Your autosaved design could not be read and was set aside, not deleted. Showing the teaching movement instead. (${saved.reason})`,
      "error",
    );
  }
  toolbar.setAutosaveStatus(storage === null ? "Autosave unavailable" : "Autosave on");
  store.onDesignChange((movement) => {
    toolbar.setAutosaveStatus(writeAutosave(storage, movement) ? "Autosaved" : "Autosave failed");
  });
  return { store, viewport };
}
