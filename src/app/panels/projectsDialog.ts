import type { AppStore } from "@/app/store";
import type { KeyValueStore } from "@/persistence/autosave";
import { deleteProject, getStartupProjectId, listProjects, openProject, saveProject, setStartupProjectId } from "@/persistence/library";

export interface ProjectsDialog {
  open(): void;
}

function button(label: string, title: string, onClick: () => void, danger = false): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.textContent = label;
  el.title = title;
  if (danger) el.classList.add("danger");
  el.addEventListener("click", onClick);
  return el;
}

/** Designs saved in this browser (separate from files you download). */
export function mountProjectsDialog(
  root: HTMLElement,
  store: AppStore,
  storage: KeyValueStore | null,
  notify: (message: string, kind: "error" | "info") => void,
): ProjectsDialog {
  const dialog = document.createElement("dialog");
  dialog.className = "projects-dialog";
  root.appendChild(dialog);

  const render = (): void => {
    dialog.innerHTML = "";
    const header = document.createElement("div");
    header.className = "projects-header";
    const title = document.createElement("strong");
    title.textContent = "Projects saved in this browser";
    header.append(
      title,
      button("Save current design", "Saves this design here under its name. Saving it again updates the same entry.", () => {
        const result = saveProject(storage, store.movement);
        if (result.ok) notify(`Saved “${store.movement.name}” in this browser.`, "info");
        else notify(result.reason, "error");
        render();
      }),
      button("Close", "Close this list", () => { dialog.close(); }),
    );
    dialog.appendChild(header);

    const note = document.createElement("div");
    note.className = "muted projects-note";
    note.textContent = "Browser storage can be cleared by the browser. Use Save in the toolbar to keep a file. ★ marks the design that opens when the app starts; with none marked, the app opens the teaching movement.";
    dialog.appendChild(note);

    const list = listProjects(storage);
    if (!list.ok) {
      const problem = document.createElement("div");
      problem.className = "issue-error projects-note";
      problem.textContent = list.reason;
      dialog.appendChild(problem);
      return;
    }
    if (list.value.length === 0) {
      const empty = document.createElement("div");
      empty.className = "muted projects-note";
      empty.textContent = "No projects saved yet.";
      dialog.appendChild(empty);
      return;
    }

    const table = document.createElement("table");
    table.className = "projects-table";
    const startupId = getStartupProjectId(storage);
    for (const project of list.value) {
      const tr = document.createElement("tr");
      const name = document.createElement("td");
      name.textContent = project.name;
      if (project.id === store.movement.id) name.textContent += " (open now)";
      if (project.id === startupId) name.textContent = `★ ${name.textContent}`;
      const saved = document.createElement("td");
      saved.className = "muted";
      saved.textContent = new Date(project.savedAt).toLocaleString();
      const status = document.createElement("td");
      status.className = project.problem === null ? "muted" : "issue-error";
      status.textContent = project.problem ?? "";
      const actions = document.createElement("td");
      const openButton = button("Open", "Open this design. Undo brings back the current one.", () => {
        const opened = openProject(storage, project.id);
        if (!opened.ok) {
          notify(`Could not open “${project.name}”: ${opened.reason}`, "error");
          return;
        }
        store.load(opened.value);
        notify(`Opened “${project.name}”. Undo (Ctrl+Z) brings back the previous design.`, "info");
        dialog.close();
      });
      openButton.disabled = project.problem !== null;
      const isStartup = project.id === startupId;
      const startupButton = button(
        isStartup ? "Stop opening at startup" : "Open at startup",
        isStartup
          ? "The app will open the teaching movement again when it starts."
          : "Open this design, exactly as saved, every time the app starts (at the browser's date and time, in the dial view).",
        () => {
          const result = setStartupProjectId(storage, isStartup ? null : project.id);
          if (!result.ok) notify(result.reason, "error");
          else notify(isStartup ? "The app will open the teaching movement at startup." : `“${project.name}” will open every time the app starts.`, "info");
          render();
        },
      );
      startupButton.dataset.testid = isStartup ? "startup-off" : "startup-on";
      startupButton.disabled = project.problem !== null && !isStartup;
      actions.append(
        openButton,
        startupButton,
        button("Delete", "Remove this entry from the browser library. Files you downloaded are not affected.", () => {
          const result = deleteProject(storage, project.id);
          if (!result.ok) notify(result.reason, "error");
          render();
        }, true),
      );
      tr.append(name, saved, status, actions);
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
