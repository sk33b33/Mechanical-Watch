import "./style.css";
import { bootstrapApp } from "./bootstrap";
import { browserStore } from "@/persistence/autosave";
import { mountSplash } from "./splash/splashScreen";
import { splashChips, splashNote } from "./splash/splashContent";
import { splashDisabled } from "./splash/splashGears";
import { applyStartup, startupPlain } from "./startup";
import { installViewportDebug, installVisualViewportVariables, viewportDebugWanted } from "./layout/visualViewport";

const root = document.querySelector<HTMLDivElement>("#app");
if (root === null) {
  throw new Error("Root element #app not found");
}

// Keeps the flyout panels' edge tabs on the screen's edges whatever the pinch zoom (Android's desktop mode, follow-up 54).
installVisualViewportVariables();
if (viewportDebugWanted(window.location.search)) installViewportDebug();

const plain = startupPlain(window.location.search);
const { store, viewport, carousel } = bootstrapApp(root, plain);
// Without the start screen the app opens straight onto the movement it holds (the teaching movement, or the restored
// autosave with `?start=plain`), at the browser's date and time, in the dial view, centred.
const enter = (): void => {
  if (!plain) applyStartup(store, viewport);
  viewport.resume();
};
// The start screen shows on every load; `?splash=off` skips it (automated tests, embedding, screenshots).
if (splashDisabled(window.location.search)) {
  enter();
} else {
  // Nothing draws or simulates behind the splash, so a phone's GPU is left to the splash itself, and
  // the browser time is read at the moment of entering rather than at load.
  viewport.suspend();
  mountSplash({
    host: document.body,
    appRoot: root,
    storage: browserStore(),
    chips: splashChips(store.movement),
    note: splashNote(store.movement),
    // Tapping to enter meets the carousel of saved movements; the editor appears when one is chosen (follow-up 54).
    onEnter: () => { carousel.open({ entering: true }); },
  });
}
