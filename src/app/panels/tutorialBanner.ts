import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import type { AppStore } from "@/app/store";
import { TUTORIAL_STEPS } from "@/app/tutorial/tutorialSteps";
import { createTutorialNarrator } from "@/app/tutorial/tutorialNarration";
import type { KeyValueStore } from "@/persistence/autosave";

const POPOVER_CLASS = "mw-tutorial-popover";

/**
 * The guided walkthrough's own spotlight-and-popover (driver.js) plus
 * step-by-step narration (the browser's own speech synthesis — see
 * `tutorialNarration.ts` for why not Microsoft's edge-tts service). An
 * intentional exception to CLAUDE.md's "avoid decorative UI" (confirmed
 * with the user): everywhere else in this app avoids animation and audio,
 * but a first-time build walkthrough is exactly the case a dimmed overlay,
 * a spotlight and a spoken description earn their place — drawing the eye
 * (and the ear) to the one control that matters right now.
 */
export function mountTutorialBanner(store: AppStore, storage: KeyValueStore | null): () => void {
  const narrator = createTutorialNarrator(storage);

  const narrationToggle = document.createElement("button");
  narrationToggle.type = "button";
  narrationToggle.className = "tutorial-narration-toggle";
  narrationToggle.hidden = true;
  narrationToggle.addEventListener("click", () => {
    narrator.setEnabled(!narrator.isEnabled());
    renderNarrationToggle();
  });
  // Appended to <body>, not the app's own root (#app): a child element's z-index only competes
  // against other elements *within its own nearest stacking-context ancestor*. #app never
  // establishes one of its own, so a toggle nested inside it would always lose to driver.js's
  // overlay/popover (both appended to <body> directly, each creating its own stacking context
  // there) no matter how high its own z-index — a real, confirmed click-blocking bug, not just a
  // cosmetic one.
  document.body.appendChild(narrationToggle);

  function renderNarrationToggle(): void {
    if (!narrator.supported) {
      narrationToggle.hidden = true;
      return;
    }
    narrationToggle.hidden = !store.tutorialActive;
    const on = narrator.isEnabled();
    narrationToggle.textContent = on ? "🔊 Narration on" : "🔇 Narration off";
    narrationToggle.title = on ? "Stop reading each step aloud" : "Read each step aloud as it appears";
    narrationToggle.classList.toggle("active", on);
  }

  let tourDriver: Driver | null = null;
  let lastRenderedKey: string | null = null;

  function destroyTour(): void {
    tourDriver?.destroy();
    tourDriver = null;
  }

  function render(): void {
    if (!store.tutorialActive || store.tutorialStep === null) {
      if (lastRenderedKey !== null) {
        destroyTour();
        narrator.stop();
        lastRenderedKey = null;
      }
      renderNarrationToggle();
      return;
    }

    const step = store.tutorialStep;
    const key = `${String(store.tutorialStepIndex)}:${step.id}`;
    renderNarrationToggle();
    if (key === lastRenderedKey) return; // Only re-highlight/re-speak on an actual step change.
    lastRenderedKey = key;

    tourDriver ??= driver({
      animate: false,
      allowClose: true,
      overlayOpacity: 0.65,
      stagePadding: 6,
      popoverClass: POPOVER_CLASS,
      onCloseClick: () => { store.stopTutorial(); },
    });

    highlightStep(step, store.tutorialStepIndex);
    narrator.speak(`${step.title}. ${step.instructions}`);
    // The component tree/inspector panels this step's own target usually lives in re-render their
    // DOM (tearing down and rebuilding the very button just highlighted) shortly after a design
    // change settles — driver.js caches the element it was given, so its next internal refresh
    // (scheduled via requestAnimationFrame) can end up measuring a now-detached node, collapsing
    // the spotlight to a zero-sized cutout that blocks the real click. Re-asserting the highlight
    // one frame later re-queries the selector fresh, picking up whatever DOM is actually current.
    requestAnimationFrame(() => {
      if (key === lastRenderedKey) highlightStep(step, store.tutorialStepIndex);
    });
  }

  function highlightStep(step: NonNullable<AppStore["tutorialStep"]>, stepIndex: number): void {
    if (tourDriver === null) return;
    const progressText = `Step ${String(stepIndex + 1)} of ${String(TUTORIAL_STEPS.length)}`;
    tourDriver.highlight({
      ...(step.targetSelector === null ? {} : { element: step.targetSelector }),
      popover: {
        title: step.title,
        description: step.instructions,
        // Most tutorial targets live in the narrow left "Components"/tree panel, hard against
        // the screen edge — opening toward the spacious viewport to its right avoids covering
        // the very control the step is pointing at (driver.js still falls back to another side
        // on its own when "right" genuinely has no room, e.g. a target in the right-hand
        // Inspector panel).
        side: "right",
        align: "start",
        showButtons: ["next", "close"],
        showProgress: true,
        progressText,
        nextBtnText: step.isComplete === null ? "Done" : "Skip this step",
        closeBtnLabel: "Exit tutorial",
        onNextClick: () => { store.advanceTutorial(); },
      },
    });
  }

  render();
  return store.subscribe(render);
}
