import type { AppStore } from "@/app/store";
import { builtInDialColour, builtInWheelColours } from "@/app/colour/builtInColours";
import { colourableWheels, wheelAppearance, type DialColourKey, type HexColour } from "@/domain/appearance";
import { resetAppearance, setDialColour, setWheelColour } from "@/domain/movement";
import type { Movement } from "@/domain/movement";
import { createColourPicker, type ColourPicker } from "./colourPicker";

/** What a colour button changes. */
type Target = { kind: "DIAL"; key: DialColourKey } | { kind: "WHEEL"; key: string; part: "body" | "text"; name: string };

const DIAL_BUTTONS: readonly { key: DialColourKey; label: string; title: string }[] = [
  { key: "dial", label: "Dial", title: "The dial's face" },
  { key: "hourMarkers", label: "Hour markers", title: "The hour markers: the eleven small circles and the triangle at 12" },
  { key: "hourMarkerDigits", label: "Hour marker digits", title: "The twelve hour numbers printed just inside the hour markers" },
  { key: "dialPrint", label: "Dial text, triangles and digits", title: "The printed text, the triangles, the window frames and the seconds numbers on the dial" },
  { key: "secondsHand", label: "Seconds hand", title: "The seconds hand" },
  { key: "minuteHand", label: "Minute hand", title: "The minute hand" },
  { key: "hourHand", label: "Hour hand", title: "The hour hand" },
];

const same = (a: Target | null, b: Target): boolean =>
  a !== null && a.kind === b.kind && a.key === b.key && (a.kind === "DIAL" || (b.kind === "WHEEL" && a.part === b.part));

/**
 * The Colours flyout (follow-up 39, ASM-0090): a button for the colour of each wheel a dial window shows, with a
 * second button beside it for the text or digits printed on that wheel, and buttons for the dial, the hour markers,
 * the digits in them, the dial's printed text and triangles, and the minute and hour hands. Pressing one opens the
 * colour chart under it. A drag on the chart is one undoable step; the colours are saved with the design.
 */
export function mountColourPanel(container: HTMLElement, store: AppStore): void {
  const root = document.createElement("div");
  root.className = "colour-panel";
  container.appendChild(root);

  let active: Target | null = null;
  const swatches = new Map<HTMLElement, () => HexColour>();

  const effective = (m: Movement, target: Target): { colour: HexColour; builtIn: HexColour; chosen: boolean } => {
    if (target.kind === "DIAL") {
      const chosen = m.appearance[target.key];
      const builtIn = builtInDialColour(target.key);
      return { colour: chosen ?? builtIn, builtIn, chosen: chosen !== null };
    }
    const own = wheelAppearance(m, target.key)[target.part];
    const builtIn = builtInWheelColours(m, target.key)[target.part];
    return { colour: own ?? builtIn, builtIn, chosen: own !== null };
  };

  const apply = (m: Movement, target: Target, colour: HexColour | null): Movement =>
    target.kind === "DIAL" ? setDialColour(m, target.key, colour) : setWheelColour(m, target.key, target.part, colour);

  const picker: ColourPicker = createColourPicker({
    onStart: () => { store.beginInteractiveEdit(); },
    onLive: (colour) => {
      const target = active;
      if (target !== null) store.previewEdit((original) => apply(original, target, colour));
    },
    onEnd: () => { store.endInteractiveEdit(true); },
    onChange: (colour) => {
      const target = active;
      if (target !== null) store.edit((m) => apply(m, target, colour));
    },
  });

  const refreshSwatches = (): void => {
    for (const [swatch, read] of swatches) swatch.style.background = read();
  };

  /** Moves the chart under the pressed button (or closes it when that button is pressed again). */
  const toggle = (target: Target, after: HTMLElement): void => {
    if (same(active, target)) {
      active = null;
      picker.element.remove();
    } else {
      active = target;
      after.after(picker.element);
      const { colour, builtIn } = effective(store.movement, target);
      picker.show(colour, colour === builtIn, target.kind === "DIAL" ? `${DIAL_BUTTONS.find((b) => b.key === target.key)?.label ?? ""} colour` : `${target.name}: ${target.part === "body" ? "colour" : "text and digits colour"}`);
    }
    refreshPressed();
  };

  const pressed = new Map<HTMLButtonElement, Target>();
  const refreshPressed = (): void => {
    for (const [button, target] of pressed) {
      const on = same(active, target);
      button.classList.toggle("active", on);
      button.setAttribute("aria-pressed", String(on));
    }
  };

  const button = (target: Target, rowEl: HTMLElement, text: string, label: string, title: string, testId: string): HTMLButtonElement => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "colour-button";
    b.dataset.testid = testId;
    b.title = title;
    b.setAttribute("aria-label", label);
    const swatch = document.createElement("span");
    swatch.className = "colour-swatch";
    swatches.set(swatch, () => effective(store.movement, target).colour);
    const caption = document.createElement("span");
    caption.textContent = text;
    b.append(swatch, caption);
    b.addEventListener("click", () => { toggle(target, rowEl); });
    pressed.set(b, target);
    return b;
  };

  const heading = (text: string): HTMLElement => {
    const h = document.createElement("h3");
    h.className = "colour-heading";
    h.textContent = text;
    return h;
  };

  /** Rebuilt when the design is loaded or the set of wheels changes, not on every colour change (that would close the chart mid-drag). */
  let builtFor = "";
  const build = (): void => {
    const m = store.movement;
    const wheels = colourableWheels(m);
    swatches.clear();
    pressed.clear();
    picker.element.remove();
    root.replaceChildren();

    const intro = document.createElement("p");
    intro.className = "muted colour-intro";
    intro.textContent = "Press a colour to open the colour chart, then click or drag on it. The choices are saved with the design, and Undo takes one back.";
    root.appendChild(intro);

    root.appendChild(heading("Wheels seen through the dial windows"));
    if (wheels.length === 0) {
      const none = document.createElement("p");
      none.className = "muted";
      none.textContent = "No dial window shows a wheel yet.";
      root.appendChild(none);
    }
    for (const wheel of wheels) {
      const rowEl = document.createElement("div");
      rowEl.className = "colour-row";
      rowEl.dataset.testid = `colour-row-${wheel.name}`;
      const wheelPhrase = wheel.name.endsWith("wheel") ? wheel.name : `${wheel.name} wheel`;
      const bodyTarget: Target = { kind: "WHEEL", key: wheel.key, part: "body", name: wheel.name };
      const textTarget: Target = { kind: "WHEEL", key: wheel.key, part: "text", name: wheel.name };
      rowEl.append(
        button(bodyTarget, rowEl, wheel.name, `${wheel.name} colour`, `The colour of the ${wheelPhrase}`, `colour-wheel-${wheel.name}`),
        button(textTarget, rowEl, wheel.textLabel, `${wheel.name} text colour`, wheel.textLabel === "Text" ? `The text or digits printed on the ${wheelPhrase}` : `The white moon phases printed on the ${wheelPhrase}`, `colour-wheel-text-${wheel.name}`),
      );
      root.appendChild(rowEl);
    }

    root.appendChild(heading("Dial and hands"));
    for (const item of DIAL_BUTTONS) {
      const rowEl = document.createElement("div");
      rowEl.className = "colour-row";
      rowEl.appendChild(button({ kind: "DIAL", key: item.key }, rowEl, item.label, `${item.label} colour`, item.title, `colour-dial-${item.key}`));
      root.appendChild(rowEl);
    }

    const resetAll = document.createElement("button");
    resetAll.type = "button";
    resetAll.className = "colour-reset-all";
    resetAll.textContent = "Reset all colours";
    resetAll.dataset.testid = "colour-reset-all";
    resetAll.title = "Put every colour back to the built-in one";
    resetAll.addEventListener("click", () => { store.edit((current) => resetAppearance(current)); });
    root.appendChild(resetAll);

    active = null;
    builtFor = wheels.map((w) => w.key).join("|");
    refreshSwatches();
  };

  build();
  store.subscribe(() => {
    const wheels = colourableWheels(store.movement).map((w) => w.key).join("|");
    if (wheels !== builtFor && !store.isInteractiveEditing) build();
    refreshSwatches();
    // The chart shows the colour now in force (undo, reset or a loaded design can change it from outside).
    const target = active;
    if (target !== null && !store.isInteractiveEditing) {
      const { colour, builtIn } = effective(store.movement, target);
      picker.show(colour, colour === builtIn, target.kind === "DIAL" ? `${DIAL_BUTTONS.find((b) => b.key === target.key)?.label ?? ""} colour` : `${target.name}: ${target.part === "body" ? "colour" : "text and digits colour"}`);
    }
  });
}
