import type { AppStore } from "@/app/store";
import { builtInDialColour } from "@/app/colour/builtInColours";
import { hexToNumber } from "@/domain/appearance";
import { setDialTexture } from "@/domain/movement";
import {
  DIAL_TEXTURE, DIAL_TEXTURE_IDS, dialTextureLabel, encodeHeights, heightsFromImage, previewRgba, sameDialTexture,
  type DialTexture,
} from "@/geometry/dialTexture";

/**
 * The dial texture menu (follow-up 50, ASM-0094): one button showing the texture in force; pressed, it drops a
 * list of every built-in texture, each with a small swatch lit and tinted in the dial's own colour (so the list
 * shows what each would look like on this dial), and at the bottom an "Import image…" item that reads a picture as
 * a grey-level relief. A choice is one undoable edit, saved with the design. Nothing here touches the movement.
 */
export interface DialTextureMenu {
  element: HTMLElement;
}

const NONE: DialTexture = { kind: "NONE" };

/** Reads a picture file into an imported texture: cropped to the square about its middle, reduced, grey level as height. */
async function textureFromFile(file: File): Promise<DialTexture> {
  if (file.size > DIAL_TEXTURE.maxImportBytes) throw new Error(`That picture is too large (the limit is ${String(Math.round(DIAL_TEXTURE.maxImportBytes / 1024 / 1024))} MB).`);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("That file could not be read as a picture. Try a PNG, JPEG, WebP or GIF.");
  }
  try {
    const size = DIAL_TEXTURE.importedSizePx;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (context === null) throw new Error("This browser cannot read pictures here.");
    const side = Math.min(bitmap.width, bitmap.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
    const pixels = context.getImageData(0, 0, size, size);
    const heights = heightsFromImage(pixels.data, size, size, size);
    const name = file.name.trim() === "" ? "Imported picture" : file.name.trim().slice(0, DIAL_TEXTURE.maxNameLength);
    return { kind: "IMPORTED", name, size, data: encodeHeights(heights) };
  } finally {
    bitmap.close();
  }
}

export function createDialTextureMenu(store: AppStore): DialTextureMenu {
  const root = document.createElement("div");
  root.className = "dial-texture";
  root.dataset.testid = "dial-texture";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "dial-texture-button";
  button.dataset.testid = "dial-texture-button";
  button.setAttribute("aria-haspopup", "listbox");
  button.setAttribute("aria-expanded", "false");
  button.title = "Choose a 3D texture for the dial. It takes the dial's colour. Saved with the design; Undo takes it back.";
  // Swatches are pictures, not <canvas> elements, so the page keeps one canvas: the 3D viewport.
  const buttonSwatch = document.createElement("img");
  buttonSwatch.className = "dial-texture-swatch";
  buttonSwatch.alt = "";
  const buttonLabel = document.createElement("span");
  buttonLabel.className = "dial-texture-label";
  const caret = document.createElement("span");
  caret.className = "dial-texture-caret";
  caret.textContent = "▾";
  caret.setAttribute("aria-hidden", "true");
  button.append(buttonSwatch, buttonLabel, caret);

  const list = document.createElement("div");
  list.className = "dial-texture-list";
  list.dataset.testid = "dial-texture-list";
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-label", "Dial textures");
  list.hidden = true;

  const error = document.createElement("p");
  error.className = "dial-texture-error";
  error.dataset.testid = "dial-texture-error";
  error.setAttribute("role", "alert");
  error.hidden = true;

  const file = document.createElement("input");
  file.type = "file";
  file.accept = "image/*";
  file.hidden = true;
  file.dataset.testid = "dial-texture-file";

  root.append(button, list, error, file);

  const dialColour = (): number => hexToNumber(store.movement.appearance.dial ?? builtInDialColour("dial"));

  /** Draws a swatch: the texture lit and tinted in the dial's colour. */
  const paint = (picture: HTMLImageElement, texture: DialTexture): void => {
    const size = DIAL_TEXTURE.previewPx;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (context === null) return;
    const rgba = previewRgba(texture, dialColour());
    context.putImageData(new ImageData(Uint8ClampedArray.from(rgba), size, size), 0, 0);
    picture.src = canvas.toDataURL();
  };

  const choose = (texture: DialTexture): void => {
    error.hidden = true;
    close();
    if (!sameDialTexture(texture, store.movement.appearance.dialTexture)) store.edit((m) => setDialTexture(m, texture));
  };

  const options: { texture: DialTexture; canvas: HTMLImageElement; element: HTMLElement }[] = [];
  const addOption = (texture: DialTexture, testId: string): void => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "dial-texture-option";
    option.setAttribute("role", "option");
    option.dataset.testid = testId;
    const canvas = document.createElement("img");
    canvas.className = "dial-texture-swatch";
    canvas.alt = "";
    const text = document.createElement("span");
    text.textContent = dialTextureLabel(texture);
    option.append(canvas, text);
    option.addEventListener("click", () => { choose(texture); });
    list.appendChild(option);
    options.push({ texture, canvas, element: option });
  };

  const buildList = (): void => {
    list.replaceChildren();
    options.length = 0;
    addOption(NONE, "dial-texture-none");
    for (const id of DIAL_TEXTURE_IDS) addOption({ kind: "BUILT_IN", id }, `dial-texture-${id}`);
    const current = store.movement.appearance.dialTexture;
    // The picture in force, if it was imported, is listed (it lives in the design, not in the app).
    if (current.kind === "IMPORTED") addOption(current, "dial-texture-imported");
    const importButton = document.createElement("button");
    importButton.type = "button";
    importButton.className = "dial-texture-import";
    importButton.dataset.testid = "dial-texture-import";
    importButton.textContent = "Import image…";
    importButton.title = "Use a picture as the dial's relief: its grey levels become the heights (white high, black low), cropped to a square. Its colours are ignored; the dial keeps its own colour.";
    importButton.addEventListener("click", () => { file.click(); });
    list.appendChild(importButton);
  };

  /** Brings every swatch and the selection up to date with the dial's colour and the texture in force. */
  const refresh = (): void => {
    const current = store.movement.appearance.dialTexture;
    buttonLabel.textContent = dialTextureLabel(current);
    paint(buttonSwatch, current);
    if (!list.hidden) {
      // A picture imported earlier is listed only while it is in force, so the list is rebuilt if that changed.
      const hasImported = options.some((o) => o.texture.kind === "IMPORTED");
      if ((current.kind === "IMPORTED") !== hasImported || (current.kind === "IMPORTED" && !options.some((o) => sameDialTexture(o.texture, current)))) buildList();
      for (const option of options) {
        paint(option.canvas, option.texture);
        const selected = sameDialTexture(option.texture, current);
        option.element.setAttribute("aria-selected", String(selected));
        option.element.classList.toggle("selected", selected);
      }
    }
  };

  function open(): void {
    buildList();
    list.hidden = false;
    button.setAttribute("aria-expanded", "true");
    refresh();
    const selected = options.find((o) => o.element.getAttribute("aria-selected") === "true") ?? options[0];
    selected?.element.focus();
  }
  function close(): void {
    list.hidden = true;
    button.setAttribute("aria-expanded", "false");
  }

  button.addEventListener("click", () => { if (list.hidden) open(); else close(); });
  list.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { event.stopPropagation(); close(); button.focus(); return; }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const items = [...list.querySelectorAll<HTMLElement>("button")];
    const at = items.indexOf(document.activeElement as HTMLElement);
    const next = items[(at + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length];
    event.preventDefault();
    next?.focus();
  });
  document.addEventListener("pointerdown", (event) => {
    if (!list.hidden && event.target instanceof Node && !root.contains(event.target)) close();
  });

  file.addEventListener("change", () => {
    const picked = file.files?.[0];
    file.value = "";
    if (picked === undefined) return;
    textureFromFile(picked).then(
      (texture) => { choose(texture); },
      (problem: unknown) => {
        error.textContent = problem instanceof Error ? problem.message : "That picture could not be used.";
        error.hidden = false;
      },
    );
  });

  store.subscribe(refresh);
  refresh();
  return { element: root };
}

