import type { Movement } from "@/domain/movement";
import { shaftSupport } from "@/assembly/assemblyGeometry";

/**
 * One step of the guided "build a movement from scratch" walkthrough.
 *
 * `isComplete` is checked against the domain model (never UI state) after
 * every design change, per this app's "domain model is authoritative"
 * rule — a step is done when the design says so, not when a button was
 * merely clicked. `null` means the step only advances when the user
 * presses Next (there's nothing in the design to check yet, e.g. reading
 * an explanation).
 *
 * `targetSelector` is a CSS selector for the control the step wants the
 * user to use; the tutorial banner (tutorialBanner.ts) highlights whatever
 * currently matches it. `null` means nothing to point at (e.g. the final
 * step). Selectors are only looked up in the main document — a control
 * popped out into its own window (see layout/panelWindows.ts) won't be
 * highlighted there; a known, stated limitation, not a silent gap.
 */
export interface TutorialStep {
  id: string;
  title: string;
  instructions: string;
  targetSelector: string | null;
  isComplete: ((movement: Movement) => boolean) | null;
}

function hasFrameKind(movement: Movement, kind: "MAINPLATE" | "BRIDGE"): boolean {
  return Object.values(movement.frames).some((f) => f.kind === kind);
}

function bothBearingsFitted(movement: Movement): boolean {
  const pivoted = Object.values(movement.shafts).filter((s) => s.support.kind === "PIVOTED");
  if (pivoted.length === 0) return false;
  return pivoted.every((s) => {
    const support = shaftSupport(movement, s.id);
    return support.lower !== null && support.upper !== null;
  });
}

/**
 * Covers the opening workflow only: an empty movement to a two-arbor,
 * meshed, fully-bearinged gear train, checked in validation. It does not
 * walk through a full caliber (escapement, keyless works, dial) — those
 * follow the same pattern (add a part, fill it in) once this gets someone
 * started. Extending TUTORIAL_STEPS is how a future session would cover
 * more of the build.
 */
export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "start-empty",
    title: "Start from nothing",
    instructions:
      "Every design starts as data, not a template. Open the “New…” menu in the toolbar and choose “Empty movement”.",
    targetSelector: '[data-testid="new-design"]',
    isComplete: (m) => Object.keys(m.frames).length === 0 && Object.keys(m.shafts).length === 0,
  },
  {
    id: "add-mainplate",
    title: "Add the mainplate",
    instructions:
      "Every part starts with every dimension empty — nothing is guessed for you. Click “+ Mainplate” in the component tree.",
    targetSelector: '[data-tutorial="add-mainplate"]',
    isComplete: (m) => hasFrameKind(m, "MAINPLATE"),
  },
  {
    id: "add-bridge",
    title: "Add a bridge",
    instructions: "Arbors need a bearing at each end, in two different frames. Click “+ Bridge”.",
    targetSelector: '[data-tutorial="add-bridge"]',
    isComplete: (m) => hasFrameKind(m, "BRIDGE"),
  },
  {
    id: "add-arbor-1",
    title: "Add the first arbor",
    instructions: "Click “+ Arbor” to add the first shaft. It will carry the driving gear.",
    targetSelector: '[data-tutorial="add-arbor"]',
    isComplete: (m) => Object.keys(m.shafts).length >= 1,
  },
  {
    id: "add-gear-1",
    title: "Give it a gear",
    instructions: "The new arbor is now selected in the inspector. Click “Add gear” to put a gear on it.",
    targetSelector: '[data-tutorial="add-gear"]',
    isComplete: (m) => Object.keys(m.gears).length >= 1,
  },
  {
    id: "add-arbor-2",
    title: "Add a second arbor",
    instructions: "A gear train needs at least two arbors to mesh. Click “+ Arbor” again.",
    targetSelector: '[data-tutorial="add-arbor"]',
    isComplete: (m) => Object.keys(m.shafts).length >= 2,
  },
  {
    id: "add-gear-2",
    title: "Give the second arbor a gear",
    instructions: "Click “Add gear” again, this time on the second arbor.",
    targetSelector: '[data-tutorial="add-gear"]',
    isComplete: (m) => Object.keys(m.gears).length >= 2,
  },
  {
    id: "mesh-gears",
    title: "Mesh the two gears",
    instructions:
      "Select the first gear, then use “Mesh with” in its inspector to choose the second gear. Tooth counts and modules can stay empty for now — the mesh itself is what's being declared here.",
    targetSelector: '[data-field="Mesh with"]',
    isComplete: (m) => Object.keys(m.gearMeshes).length >= 1,
  },
  {
    id: "add-bearings",
    title: "Add bearings",
    instructions:
      "Each arbor still needs a lower and upper bearing. Select an arbor, then use the bearing rows in its inspector (“Add in frame…”) for both ends — on both arbors.",
    targetSelector: '[data-field="Lower bearing"]',
    isComplete: (m) => bothBearingsFitted(m),
  },
  {
    id: "check-validation",
    title: "Check validation",
    instructions:
      "Open the Validation panel to see what the design still needs (dimensions, mostly) before it's geometrically consistent. That's the whole loop: add a part, fill it in, check what's still open.",
    targetSelector: null,
    isComplete: null,
  },
];
