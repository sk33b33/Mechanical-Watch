import type { AppStore } from "@/app/store";
import { TUTORIAL_STEPS } from "@/app/tutorial/tutorialSteps";

const HIGHLIGHT_CLASS = "tutorial-target";

/**
 * The guided walkthrough's always-on-top banner: current step, instructions,
 * and a pulsing highlight on whatever control the step points at. An
 * intentional exception to CLAUDE.md's "avoid decorative UI" (confirmed
 * with the user): everywhere else in this app avoids animation, but a
 * first-time build walkthrough is exactly the case decorative motion earns
 * its place — drawing the eye to the one control that matters right now.
 */
export function mountTutorialBanner(root: HTMLElement, store: AppStore): () => void {
  const banner = document.createElement("div");
  banner.className = "tutorial-banner";
  root.appendChild(banner);

  let highlighted: HTMLElement | null = null;

  function clearHighlight(): void {
    highlighted?.classList.remove(HIGHLIGHT_CLASS);
    highlighted = null;
  }

  function applyHighlight(selector: string | null): void {
    if (highlighted !== null) clearHighlight();
    if (selector === null) return;
    const target = document.querySelector<HTMLElement>(selector);
    if (target === null) return;
    target.classList.add(HIGHLIGHT_CLASS);
    highlighted = target;
    target.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  function render(): void {
    banner.innerHTML = "";
    if (!store.tutorialActive) {
      banner.hidden = true;
      clearHighlight();
      return;
    }
    const step = store.tutorialStep;
    if (step === null) {
      banner.hidden = true;
      clearHighlight();
      return;
    }
    banner.hidden = false;

    const progress = document.createElement("div");
    progress.className = "tutorial-progress";
    progress.textContent = `Step ${String(store.tutorialStepIndex + 1)} of ${String(TUTORIAL_STEPS.length)}`;

    const title = document.createElement("div");
    title.className = "tutorial-title";
    title.textContent = step.title;

    const body = document.createElement("div");
    body.className = "tutorial-instructions";
    body.textContent = step.instructions;

    const actions = document.createElement("div");
    actions.className = "tutorial-actions";
    const nextButton = document.createElement("button");
    nextButton.type = "button";
    nextButton.textContent = step.isComplete === null ? "Done" : "Skip this step";
    nextButton.addEventListener("click", () => { store.advanceTutorial(); });
    const exitButton = document.createElement("button");
    exitButton.type = "button";
    exitButton.className = "tutorial-exit";
    exitButton.textContent = "Exit tutorial";
    exitButton.addEventListener("click", () => { store.stopTutorial(); });
    actions.append(nextButton, exitButton);

    banner.append(progress, title, body, actions);
    applyHighlight(step.targetSelector);
  }

  render();
  return store.subscribe(render);
}
