import "./style.css";
import { bootstrapApp } from "./bootstrap";
import { browserStore } from "@/persistence/autosave";
import { mountSplash } from "./splash/splashScreen";
import { splashChips, splashNote } from "./splash/splashContent";
import { splashDisabled } from "./splash/splashGears";
import { applyStartup, startupPlain } from "./startup";

const root = document.querySelector<HTMLDivElement>("#app");
if (root === null) {
  throw new Error("Root element #app not found");
}

const plain = startupPlain(window.location.search);
const { store, viewport } = bootstrapApp(root, plain);
// On entry the app shows the teaching movement at the browser's date and time, dial view, centred.
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
    onEnter: enter,
  });
}
