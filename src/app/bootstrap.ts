import { AppStore } from "./store";
import { createTeachingMovement } from "./teachingMovement";
import { Viewport } from "@/viewport/viewport";
import { mountViewportControls } from "@/viewport/viewportControls";
import { mountMeasurementPanel } from "./panels/measurementPanel";
import { mountProjectsDialog } from "./panels/projectsDialog";
import { mountOutputsDialog } from "./panels/outputsDialog";
import { browserStore, loadAutosave, writeAutosave } from "@/persistence/autosave";
import { mountHeader } from "./panels/header";
import { mountToolbar } from "./panels/toolbar";
import { mountComponentTree } from "./panels/componentTree";
import { mountInspector } from "./panels/inspector/index";
import { mountValidationConsole } from "./panels/validationConsole";
import { mountTutorialBanner } from "./panels/tutorialBanner";
import { PanelLayout } from "./layout/panelWindows";
import { mountLayoutControls } from "./layout/layoutControls";

function panel(parent: HTMLElement, className: string): HTMLDivElement {
  const el = document.createElement("div");
  el.className = className;
  parent.appendChild(el);
  return el;
}

export function bootstrapApp(root: HTMLElement): void {
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
  const store = new AppStore(saved.status === "LOADED" ? saved.movement : createTeachingMovement());

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
  toolbar.addFileAction("Outputs…", "Engineering report, BOM, drawings and exports", () => { outputs.open(); });
  mountTutorialBanner(root, store);
  toolbar.addFileAction("Tutorial…", "Guided walkthrough: build a movement from scratch", () => { store.startTutorial(); });

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
}
