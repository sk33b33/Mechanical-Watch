import type { AppStore } from "@/app/store";
import { declaredLevelStatus } from "@/validation/validationIssue";
import { VALIDATION_LEVEL_LABELS } from "@/reference/validationLevels";

export function mountHeader(container: HTMLElement, store: AppStore): () => void {
  function render(): void {
    container.innerHTML = "";
    const title = document.createElement("span");
    title.className = "header-title";
    title.title = store.movement.name;
    title.textContent = `Mechanical Watchmaker 3D — ${store.movement.name}`;
    container.appendChild(title);

    if (store.movement.isTeachingDemo) {
      const demo = document.createElement("span");
      demo.className = "badge badge-demo";
      demo.textContent = "Teaching demo, not a production caliber";
      container.appendChild(demo);
    }

    const status = declaredLevelStatus(store.movement.declaredValidationLevel, store.issues);
    const level = document.createElement("span");
    level.className = `badge ${status.satisfied ? "badge-ok" : "badge-fail"}`;
    level.textContent = `Declared ${VALIDATION_LEVEL_LABELS[status.declared]}: ${
      status.satisfied ? "consistent" : "not satisfied"
    }`;
    container.appendChild(level);

    const physical = document.createElement("span");
    physical.className = "badge badge-muted";
    physical.textContent = "Physical validation pending";
    container.appendChild(physical);
  }

  render();
  return store.subscribe(render);
}
