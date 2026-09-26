import type { AppStore } from "@/app/store";
import type { Movement } from "@/domain/movement";
import { decodeDesign, DesignFileError, encodeDesign } from "@/persistence/designFile";

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

  fileGroup.append(
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

  container.append(fileGroup, autosave, notice, spacer);

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
