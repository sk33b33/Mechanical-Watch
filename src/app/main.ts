import "./style.css";
import { bootstrapApp } from "./bootstrap";
import { browserStore } from "@/persistence/autosave";
import { mountSplash } from "./splash/splashScreen";
import { splashChips, splashNote } from "./splash/splashContent";
import { splashDisabled } from "./splash/splashGears";

const root = document.querySelector<HTMLDivElement>("#app");
if (root === null) {
  throw new Error("Root element #app not found");
}

const store = bootstrapApp(root);
// The start screen shows on every load; `?splash=off` skips it (automated tests, embedding, screenshots).
if (!splashDisabled(window.location.search)) {
  mountSplash({
    host: document.body,
    appRoot: root,
    storage: browserStore(),
    chips: splashChips(store.movement),
    note: splashNote(store.movement),
  });
}
