import "./style.css";
import { bootstrapApp } from "./bootstrap";

const root = document.querySelector<HTMLDivElement>("#app");
if (root === null) {
  throw new Error("Root element #app not found");
}

bootstrapApp(root);
