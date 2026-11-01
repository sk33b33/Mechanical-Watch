import type { AppStore } from "@/app/store";
import type { KeyValueStore } from "@/persistence/autosave";
import { addToCarousel, CAROUSEL_SLOTS, deleteProject, listProjects, openProject, readCarouselIds, removeFromCarousel, saveProject } from "@/persistence/library";

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
    const saveButton = button("Save current design", "Saves this design here under its name. Saving it again updates the same entry.", () => {
      const result = saveProject(storage, store.movement);
      if (result.ok) notify(`Saved “${store.movement.name}” in this browser.`, "info");
      else notify(result.reason, "error");
      render();
    });
    saveButton.dataset.testid = "projects-save";
    const saveToCarousel = button(
      "Save and add to carousel",
      `Saves this design and puts it on the carousel, in the first empty place (the carousel holds ${String(CAROUSEL_SLOTS)}).`,
      () => {
        const saved = saveProject(storage, store.movement);
        if (!saved.ok) { notify(saved.reason, "error"); render(); return; }
        const added = addToCarousel(storage, store.movement.id);
        if (added.ok) notify(`Saved “${store.movement.name}” and added it to the carousel (place ${String(added.value + 1)} of ${String(CAROUSEL_SLOTS)}).`, "info");
        else notify(`Saved “${store.movement.name}”, but it is not on the carousel: ${added.reason}`, "error");
        render();
      },
    );
    saveToCarousel.dataset.testid = "projects-save-carousel";
    header.append(title, saveButton, saveToCarousel, button("Close", "Close this list", () => { dialog.close(); }));
    dialog.appendChild(header);

    const note = document.createElement("div");
    note.className = "muted projects-note";
    const onCarousel = readCarouselIds(storage);
    note.textContent = `Browser storage can be cleared by the browser. Use Save in the toolbar to keep a file. The carousel (the screen you meet when you tap to enter) holds up to ${String(CAROUSEL_SLOTS)} of these designs: ${String(onCarousel.filter((id) => id !== null).length)} of ${String(CAROUSEL_SLOTS)} places used.`;
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
    for (const project of list.value) {
      const tr = document.createElement("tr");
      const name = document.createElement("td");
      name.textContent = project.name;
      if (project.id === store.movement.id) name.textContent += " (open now)";
      const place = onCarousel.indexOf(project.id);
      if (place >= 0) name.textContent += ` · on the carousel, place ${String(place + 1)}`;
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
      const isOnCarousel = place >= 0;
      const carouselButton = button(
        isOnCarousel ? "Remove from carousel" : "Add to carousel",
        isOnCarousel
          ? "Takes this design off the carousel, leaving its place empty. It stays saved in this browser."
          : `Puts this design on the carousel, in the first empty place (the carousel holds ${String(CAROUSEL_SLOTS)}).`,
        () => {
          const result = isOnCarousel ? removeFromCarousel(storage, project.id) : addToCarousel(storage, project.id);
          if (!result.ok) notify(result.reason, "error");
          else notify(isOnCarousel ? `“${project.name}” is off the carousel.` : `“${project.name}” is on the carousel.`, "info");
            render();
        },
      );
      carouselButton.dataset.testid = isOnCarousel ? "carousel-remove" : "carousel-add";
      actions.append(
        openButton,
        carouselButton,
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
