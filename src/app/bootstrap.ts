import { AppStore } from "./store";
import { createTwoGearDemoMovement } from "./demoMovement";
import { Viewport } from "@/viewport/viewport";
import { mountComponentTree } from "./panels/componentTree";
import { mountInspector } from "./panels/inspector";
import { mountValidationConsole } from "./panels/validationConsole";

export function bootstrapApp(root: HTMLElement): void {
  root.innerHTML = "";

  const workspace = document.createElement("div");
  workspace.className = "workspace";
  root.appendChild(workspace);

  const header = document.createElement("div");
  header.className = "header";
  header.textContent = "Mechanical Watchmaker 3D — teaching sandbox";
  workspace.appendChild(header);

  const tree = document.createElement("div");
  tree.className = "panel tree";
  workspace.appendChild(tree);

  const viewportEl = document.createElement("div");
  viewportEl.className = "viewport";
  workspace.appendChild(viewportEl);

  const inspector = document.createElement("div");
  inspector.className = "panel inspector";
  workspace.appendChild(inspector);

  const consoleEl = document.createElement("div");
  consoleEl.className = "panel console";
  workspace.appendChild(consoleEl);

  const movement = createTwoGearDemoMovement();
  const store = new AppStore(movement);

  mountComponentTree(tree, store);
  mountInspector(inspector, store);
  mountValidationConsole(consoleEl, store);
  new Viewport(viewportEl, store);
}
