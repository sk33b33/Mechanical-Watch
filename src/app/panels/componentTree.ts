import type { AppStore } from "@/app/store";
import type { EntityId } from "@/domain/ids";
import { addDateComplication, addDial, addEscapement, addFrame, addKeylessWorks, addMonthComplication, addMoonPhase, addShaft, drivenShaftId, type Movement } from "@/domain/movement";
import { newDateComplication, newDial, newEscapement, newFrame, newKeylessWorks, newMonthComplication, newMoonPhase, newShaft } from "@/domain/editing";
import { listAssumptions } from "@/reference/assumptions";

export function mountComponentTree(container: HTMLElement, store: AppStore): () => void {
  function item(label: string, id: EntityId, depth: number, detail?: string): HTMLDivElement {
    const el = document.createElement("div");
    el.className = "tree-item" + (id === store.selectedId ? " selected" : "");
    el.style.paddingLeft = `${String(10 + depth * 14)}px`;
    el.textContent = label;
    if (detail !== undefined) {
      const muted = document.createElement("span");
      muted.className = "muted";
      muted.textContent = ` ${detail}`;
      el.appendChild(muted);
    }
    el.addEventListener("click", () => {
      store.select(id);
    });
    return el;
  }

  function header(text: string): HTMLDivElement {
    const el = document.createElement("div");
    el.className = "panel-header";
    el.textContent = text;
    return el;
  }

  function addButton(
    label: string,
    title: string,
    create: (m: Movement) => { movement: Movement; id: EntityId },
    tutorialId?: string,
  ): HTMLButtonElement {
    const el = document.createElement("button");
    el.type = "button";
    el.textContent = label;
    el.title = title;
    if (tutorialId !== undefined) el.dataset.tutorial = tutorialId;
    el.addEventListener("click", () => {
      // A guided-tutorial step targeting this exact button preloads the part instead of leaving it empty.
      const step = store.tutorialActive && tutorialId !== undefined && store.tutorialStep?.targetSelector === `[data-tutorial="${tutorialId}"]` ? store.tutorialStep : null;
      if (step?.createOverride !== undefined) {
        store.runTutorialCreation(step.id, step.createOverride);
        return;
      }
      const { movement, id } = create(store.movement);
      store.edit(() => movement);
      store.select(id);
    });
    return el;
  }

  function empty(text: string): HTMLDivElement {
    const el = document.createElement("div");
    el.className = "tree-empty muted";
    el.textContent = text;
    return el;
  }

  function render(): void {
    container.innerHTML = "";
    const { movement } = store;

    const actions = document.createElement("div");
    actions.className = "tree-actions";
    actions.append(
      addButton("+ Mainplate", "Add a mainplate with every dimension empty", (m) => {
        const frame = newFrame(m, "MAINPLATE");
        return { movement: addFrame(m, frame), id: frame.id };
      }, "add-mainplate"),
      addButton("+ Bridge", "Add a bridge with every dimension empty", (m) => {
        const frame = newFrame(m, "BRIDGE");
        return { movement: addFrame(m, frame), id: frame.id };
      }, "add-bridge"),
      addButton("+ Arbor", "Add an arbor with an empty position", (m) => {
        const shaft = newShaft(m);
        return { movement: addShaft(m, shaft), id: shaft.id };
      }, "add-arbor"),
      addButton("+ Keyless works", "Add a crown and stem with every dimension empty; then choose its wheels", (m) => {
        const keyless = newKeylessWorks(m);
        return { movement: addKeylessWorks(m, keyless), id: keyless.id };
      }, "add-keyless-works"),
      addButton("+ Dial", "Add a dial with every dimension empty", (m) => {
        const dial = newDial(m);
        return { movement: addDial(m, dial), id: dial.id };
      }, "add-dial"),
      addButton("+ Escapement", "Add a simplified Swiss lever escapement with every value empty; then choose its arbors", (m) => {
        const escapement = newEscapement(m);
        return { movement: addEscapement(m, escapement), id: escapement.id };
      }, "add-escapement"),
      addButton("+ Moon phase", "Add a moonphase disc with every dimension empty; then choose its arbor", (m) => {
        const moonPhase = newMoonPhase(m);
        return { movement: addMoonPhase(m, moonPhase), id: moonPhase.id };
      }, "add-moon-phase"),
      addButton("+ Date", "Add a simple instantaneous date mechanism with every value empty; then choose its arbors", (m) => {
        const date = newDateComplication(m);
        return { movement: addDateComplication(m, date), id: date.id };
      }, "add-date"),
      addButton("+ Month", "Add a month indicator with every value empty; then choose its date complication and arbor", (m) => {
        const month = newMonthComplication(m);
        return { movement: addMonthComplication(m, month), id: month.id };
      }, "add-month"),
    );
    container.appendChild(actions);

    container.appendChild(header("Frames"));
    if (Object.keys(movement.frames).length === 0) container.appendChild(empty("No frames yet."));
    for (const frame of Object.values(movement.frames)) {
      container.appendChild(item(frame.name, frame.id, 0));
    }

    container.appendChild(header("Arbors"));
    if (Object.keys(movement.shafts).length === 0) container.appendChild(empty("No arbors yet."));
    const driven = drivenShaftId(movement);
    for (const shaft of Object.values(movement.shafts)) {
      const tags = [
        ...(shaft.hand === null ? [] : [`${shaft.hand.toLowerCase()} hand`]),
        ...(shaft.id === driven ? [movement.drive?.kind === "NOMINAL_TIME" ? "nominal time" : movement.drive?.kind === "BALANCE" ? "balance-governed" : "drive"] : []),
      ];
      const driving = tags.length === 0 ? undefined : `(${tags.join(", ")})`;
      container.appendChild(item(shaft.name, shaft.id, 0, driving));
      for (const gear of Object.values(movement.gears).filter((g) => g.shaftId === shaft.id)) {
        container.appendChild(item(gear.name, gear.id, 1, Number.isNaN(gear.toothCount) ? "no tooth count" : `${String(gear.toothCount)} teeth`));
      }
      for (const jewel of Object.values(movement.jewels).filter((j) => j.shaftId === shaft.id)) {
        container.appendChild(item(jewel.name.replace(`${shaft.name} `, ""), jewel.id, 1));
      }
    }

    if (Object.keys(movement.escapements).length > 0) {
      container.appendChild(header("Escapement"));
      for (const escapement of Object.values(movement.escapements)) {
        container.appendChild(item(escapement.name, escapement.id, 0, "(simplified model)"));
      }
    }

    if (Object.keys(movement.keylessWorks).length > 0 || Object.keys(movement.dials).length > 0) {
      container.appendChild(header("Keyless works and dial"));
      for (const keyless of Object.values(movement.keylessWorks)) container.appendChild(item(keyless.name, keyless.id, 0, "(crown and stem)"));
      for (const dial of Object.values(movement.dials)) container.appendChild(item(dial.name, dial.id, 0));
    }

    if (Object.keys(movement.moonPhases).length > 0) {
      container.appendChild(header("Moon phase"));
      for (const moon of Object.values(movement.moonPhases)) container.appendChild(item(moon.name, moon.id, 0));
    }

    if (Object.keys(movement.dateComplications).length > 0) {
      container.appendChild(header("Date"));
      for (const date of Object.values(movement.dateComplications)) container.appendChild(item(date.name, date.id, 0, "(jump mechanism)"));
    }

    if (Object.keys(movement.monthComplications).length > 0) {
      container.appendChild(header("Month"));
      for (const month of Object.values(movement.monthComplications)) container.appendChild(item(month.name, month.id, 0, "(driven by date jumps)"));
    }

    container.appendChild(header("Assumptions"));
    for (const assumption of listAssumptions()) {
      const el = document.createElement("div");
      el.className = `assumption assumption-${assumption.status.toLowerCase()}`;
      el.title = `Scope: ${assumption.scope}`;
      const id = document.createElement("span");
      id.className = "assumption-id";
      id.textContent = `${assumption.id} · ${assumption.status}`;
      const text = document.createElement("div");
      text.textContent = assumption.summary;
      el.append(id, text);
      container.appendChild(el);
    }
  }

  render();
  return store.subscribe(render);
}
