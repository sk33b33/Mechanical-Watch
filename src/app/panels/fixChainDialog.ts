import type { AppStore } from "@/app/store";
import { planChainFix, CHAIN_FIX, type ChainFixPlan } from "@/assembly/fixChain";

export interface FixChainDialog {
  open(): void;
}

/**
 * "Fix chain" (follow-up 35, ASM-0087): shows what tidying the dial after edits would move, and applies it
 * only when confirmed, as one undoable edit. Nothing moves until then.
 */
export function mountFixChainDialog(root: HTMLElement, store: AppStore, notify: (message: string, kind: "error" | "info") => void): FixChainDialog {
  const dialog = document.createElement("dialog");
  dialog.className = "projects-dialog fix-chain-dialog";
  root.appendChild(dialog);

  const render = (plan: ChainFixPlan): void => {
    dialog.innerHTML = "";
    const header = document.createElement("div");
    header.className = "projects-header";
    const title = document.createElement("strong");
    title.textContent = "Fix chain: tidy the dial after your edits";
    header.appendChild(title);
    dialog.appendChild(header);

    const intro = document.createElement("div");
    intro.className = "projects-note muted";
    intro.textContent = `Nothing has been moved yet. This lists what would change: windows re-centred on their wheels, wheels pushed apart to at least ${(CHAIN_FIX.clearanceGapMetres * 1000).toFixed(1)} mm clear, and wheels kept inside the dial. No tooth count or dimension is touched. Applying it is one step you can undo.`;
    dialog.appendChild(intro);

    if (plan.changes.length === 0 && plan.unresolved.length === 0) {
      const ok = document.createElement("div");
      ok.className = "projects-note";
      ok.dataset.testid = "fix-chain-empty";
      ok.textContent = "Nothing to fix: every window is centred on its wheel, no wheels overlap, and all are inside the dial.";
      dialog.appendChild(ok);
    }

    if (plan.changes.length > 0) {
      const list = document.createElement("ul");
      list.className = "fix-chain-list";
      list.dataset.testid = "fix-chain-changes";
      for (const change of plan.changes) {
        const item = document.createElement("li");
        item.textContent = `${change.reason} (${change.distanceMillimetres.toFixed(2)} mm)`;
        list.appendChild(item);
      }
      dialog.appendChild(list);
    }

    if (plan.unresolved.length > 0) {
      const problems = document.createElement("div");
      problems.className = "projects-note issue-error";
      problems.dataset.testid = "fix-chain-unresolved";
      problems.textContent = `Could not be settled automatically: ${plan.unresolved.join("; ")}.`;
      dialog.appendChild(problems);
    }

    const actions = document.createElement("div");
    actions.className = "projects-header";
    const apply = document.createElement("button");
    apply.type = "button";
    apply.textContent = "Apply";
    apply.dataset.testid = "fix-chain-apply";
    apply.disabled = plan.changes.length === 0;
    apply.addEventListener("click", () => {
      store.edit(() => plan.movement);
      notify(`Fixed the chain: ${String(plan.changes.length)} change(s). Undo takes it back.`, "info");
      dialog.close();
    });
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = plan.changes.length === 0 ? "Close" : "Cancel";
    cancel.addEventListener("click", () => { dialog.close(); });
    actions.append(apply, cancel);
    dialog.appendChild(actions);
  };

  return {
    open() {
      render(planChainFix(store.movement, store.lastMovedWheelId));
      dialog.showModal();
    },
  };
}
