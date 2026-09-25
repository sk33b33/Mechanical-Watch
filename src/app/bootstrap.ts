import { AppStore } from "./store";
import { createDemoMovement } from "./demoMovement";
import { Viewport } from "@/viewport/viewport";
import { mountHeader } from "./panels/header";
import { mountComponentTree } from "./panels/componentTree";
import { mountInspector } from "./panels/inspector";
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
  const tree = panel(workspace, "panel tree");
  const viewportEl = panel(workspace, "viewport");
  const inspector = panel(workspace, "panel inspector");
  const consoleEl = panel(workspace, "panel console");

  const store = new AppStore(createDemoMovement());

  mountHeader(header, store);
  mountComponentTree(tree, store);
  mountInspector(inspector, store);
  mountValidationConsole(consoleEl, store);
  new Viewport(viewportEl, store);
}
