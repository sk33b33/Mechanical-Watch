import type { AppStore } from "@/app/store";

export function mountValidationConsole(container: HTMLElement, store: AppStore): () => void {
  function render(): void {
    container.innerHTML = "";
    const header = document.createElement("div");
    header.className = "panel-header";
    header.textContent = `Validation (${String(store.issues.length)})`;
    container.appendChild(header);

    if (store.issues.length === 0) {
      const ok = document.createElement("div");
      ok.className = "issue-ok";
      ok.textContent = "No issues at the current validation level.";
      container.appendChild(ok);
      return;
    }

    for (const issue of store.issues) {
      const row = document.createElement("div");
      row.className = "issue";
      const icon = document.createElement("span");
      icon.className = issue.severity === "error" ? "issue-error" : "issue-warning";
      icon.textContent = issue.severity === "error" ? "✖" : "▲";
      const text = document.createElement("span");
      text.textContent = `[${issue.validationLevel}] ${issue.message}`;
      row.append(icon, text);
      container.appendChild(row);
    }
  }

  render();
  return store.subscribe(render);
}
