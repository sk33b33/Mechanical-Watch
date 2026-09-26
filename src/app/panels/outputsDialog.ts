import type { AppStore } from "@/app/store";
import { VALIDATION_LEVEL_LABELS } from "@/reference/validationLevels";
import { declaredLevelStatus } from "@/validation/validationIssue";
import { EXPORT_FORMATS, produceExport, type ExportFile, type ExportFormat } from "@/outputs/exporters";

export interface OutputsDialog {
  open(): void;
}

function download(file: ExportFile): void {
  const url = URL.createObjectURL(new Blob([file.content], { type: file.mimeType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = file.filename;
  link.click();
  // Revoke later: some browsers start the download asynchronously.
  setTimeout(() => { URL.revokeObjectURL(url); }, 10_000);
}

function openInTab(file: ExportFile): boolean {
  const url = URL.createObjectURL(new Blob([file.content], { type: file.mimeType }));
  // Not "noopener": with it, window.open returns null and a blocked tab can't be detected.
  const opened = window.open(url, "_blank");
  setTimeout(() => { URL.revokeObjectURL(url); }, 60_000);
  return opened !== null;
}

function button(label: string, title: string, onClick: () => void): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.textContent = label;
  el.title = title;
  el.addEventListener("click", onClick);
  return el;
}

/** Engineering outputs generated from the current design model (Phase 6). */
export function mountOutputsDialog(
  root: HTMLElement,
  store: AppStore,
  notify: (message: string, kind: "error" | "info") => void,
): OutputsDialog {
  const dialog = document.createElement("dialog");
  dialog.className = "projects-dialog outputs-dialog";
  root.appendChild(dialog);

  const describe = (format: ExportFormat): string => `${format.label} (.${format.extension})`;
  const produce = (format: ExportFormat): ExportFile | null => {
    try {
      return produceExport(format.id, { movement: store.movement, analysis: store.analysis, generatedAt: new Date() });
    } catch (error) {
      notify(`${describe(format)} could not be produced: ${error instanceof Error ? error.message : String(error)}`, "error");
      return null;
    }
  };

  const render = (): void => {
    dialog.innerHTML = "";
    const header = document.createElement("div");
    header.className = "projects-header";
    const title = document.createElement("strong");
    title.textContent = "Engineering outputs";
    header.append(title, button("Close", "Close", () => { dialog.close(); }));
    dialog.appendChild(header);

    const status = declaredLevelStatus(store.movement.declaredValidationLevel, store.issues);
    const note = document.createElement("div");
    note.className = `projects-note ${status.satisfied ? "muted" : "issue-error"}`;
    note.textContent = status.satisfied
      ? `Generated from the design model. Declared level ${VALIDATION_LEVEL_LABELS[status.declared]} is currently met. Nothing here is manufacturing-validated (MFG-002).`
      : `The declared level ${VALIDATION_LEVEL_LABELS[status.declared]} is not met (${String(status.blockingIssues.length)} blocking issues). Outputs still generate and say so. Nothing here is manufacturing-validated (MFG-002).`;
    dialog.appendChild(note);

    const table = document.createElement("table");
    table.className = "projects-table outputs-table";
    for (const format of EXPORT_FORMATS) {
      const tr = document.createElement("tr");
      const name = document.createElement("td");
      const label = document.createElement("div");
      label.textContent = describe(format);
      const description = document.createElement("div");
      description.className = "muted outputs-description";
      description.textContent =
        format.availability.status === "AVAILABLE" ? format.description : `Not available: ${format.availability.reason}`;
      name.append(label, description);
      name.title = format.caveats.length > 0 ? `Basis and caveats: ${format.caveats.join(", ")}` : "";

      const level = document.createElement("td");
      level.className = `measurement-level${format.level === "L0_VISUAL" ? " visual" : ""}`;
      const available = format.availability.status === "AVAILABLE";
      level.textContent = available ? VALIDATION_LEVEL_LABELS[format.level] : "—";
      level.title = available ? "The highest model level this output represents." : "";

      const actions = document.createElement("td");
      if (format.availability.status === "AVAILABLE") {
        if (format.id === "report-html" || format.id === "plan-svg" || format.id === "elevation-svg") {
          actions.appendChild(button("Open", "Open in a new tab (print from there)", () => {
            const file = produce(format);
            if (file !== null && !openInTab(file)) notify("The browser blocked the new tab. Use Download instead.", "error");
          }));
        }
        actions.appendChild(button("Download", `Download ${describe(format)}`, () => {
          const file = produce(format);
          if (file !== null) download(file);
        }));
      } else {
        const unavailable = button("Download", format.availability.reason, () => undefined);
        unavailable.disabled = true;
        actions.appendChild(unavailable);
      }
      tr.append(name, level, actions);
      table.appendChild(tr);
    }
    dialog.appendChild(table);
  };

  return {
    open() {
      render();
      dialog.showModal();
    },
  };
}
