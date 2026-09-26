import { AppStore } from "./store";
import { createTeachingMovement } from "./teachingMovement";
import { Viewport } from "@/viewport/viewport";
import { mountViewportControls } from "@/viewport/viewportControls";
import { mountMeasurementPanel } from "./panels/measurementPanel";
import { mountProjectsDialog } from "./panels/projectsDialog";
import { browserStore, loadAutosave, writeAutosave } from "@/persistence/autosave";
import { mountHeader } from "./panels/header";
import { mountToolbar } from "./panels/toolbar";
import { mountComponentTree } from "./panels/componentTree";
import { mountInspector } from "./panels/inspector/index";
import { mountValidationConsole } from "./panels/validationConsole";

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
  const toolbarEl = panel(workspace, "toolbar");
  const tree = panel(workspace, "panel tree");
  const viewportEl = panel(workspace, "viewport");
  const inspector = panel(workspace, "panel inspector");
  const consoleEl = panel(workspace, "panel console");

  const storage = browserStore();
  const saved = loadAutosave(storage);
  const store = new AppStore(saved.status === "LOADED" ? saved.movement : createTeachingMovement());

  mountHeader(header, store);
  const toolbar = mountToolbar(toolbarEl, store);
  mountComponentTree(tree, store);
  mountInspector(inspector, store);
  mountValidationConsole(consoleEl, store);
  const viewport = new Viewport(viewportEl, store);
  mountViewportControls(viewportEl, viewport, store);
  mountMeasurementPanel(viewportEl, store);

  const projects = mountProjectsDialog(root, store, storage, (message, kind) => { toolbar.notify(message, kind); });
  toolbar.addFileAction("Projects…", "Designs saved in this browser", () => { projects.open(); });

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
