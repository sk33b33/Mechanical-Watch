import type { AppStore } from "@/app/store";
import type { ValidationSeverity } from "@/validation/validationIssue";
import { VALIDATION_LEVEL_LABELS } from "@/reference/validationLevels";
import { findEntity } from "@/domain/lookup";

const SEVERITY_ORDER: ValidationSeverity[] = ["blocker", "error", "warning", "info"];
const SEVERITY_GLYPH: Record<ValidationSeverity, string> = {
  blocker: "■",
  error: "✖",
  warning: "▲",
  info: "i",
};

export function mountValidationConsole(container: HTMLElement, store: AppStore): () => void {
  function render(): void {
    container.innerHTML = "";
    const header = document.createElement("div");
    header.className = "panel-header";
    const counts = SEVERITY_ORDER.map((severity) => ({
      severity,
      count: store.issues.filter((i) => i.severity === severity).length,
    })).filter((c) => c.count > 0);
    header.textContent =
      counts.length === 0
        ? "Validation"
        : `Validation: ${counts.map((c) => `${String(c.count)} ${c.severity}`).join(" · ")}`;
    container.appendChild(header);

    const issues = [...store.issues].sort(
      (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
    );
    if (!issues.some((i) => i.severity === "error" || i.severity === "blocker")) {
      const ok = document.createElement("div");
      ok.className = "issue-ok";
      ok.textContent = `No errors against the declared level (${VALIDATION_LEVEL_LABELS[store.movement.declaredValidationLevel]}).`;
      container.appendChild(ok);
    }

    for (const issue of issues) {
      const row = document.createElement("div");
      row.className = "issue";
      const icon = document.createElement("span");
      icon.className = `issue-icon issue-${issue.severity}`;
      icon.textContent = SEVERITY_GLYPH[issue.severity];
      icon.title = issue.severity;
      const body = document.createElement("div");
      const meta = document.createElement("span");
      meta.className = "issue-meta";
      meta.textContent = `${issue.rule} · ${VALIDATION_LEVEL_LABELS[issue.validationLevel]}`;
      const text = document.createElement("span");
      text.textContent = ` ${issue.message}`;
      body.append(meta, text);
      if (issue.references.length > 0) {
        const refs = document.createElement("div");
        refs.className = "issue-refs";
        refs.textContent = `Basis: ${issue.references.join(", ")}`;
        body.appendChild(refs);
      }
      row.append(icon, body);
      const target = issue.entityIds.find((id) => findEntity(store.movement, id) !== undefined);
      if (target !== undefined) {
        row.classList.add("clickable");
        row.title = "Select the affected part";
        row.addEventListener("click", () => {
          store.select(target);
        });
      }
      container.appendChild(row);
    }
  }

  render();
  return store.subscribe(render);
}
