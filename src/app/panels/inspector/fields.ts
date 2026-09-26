import { millimetres, toMillimetres, type Length } from "@/units/length";
import type { DerivedLength } from "@/assembly/assemblyGeometry";

export function sectionHeader(text: string): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "section-header";
  el.textContent = text;
  return el;
}

export function readonlyRow(label: string, value: string, title?: string): HTMLDivElement {
  const field = document.createElement("div");
  field.className = "field";
  const labelEl = document.createElement("label");
  labelEl.textContent = label;
  const valueEl = document.createElement("span");
  valueEl.className = "readonly";
  valueEl.textContent = value;
  if (title !== undefined) field.title = title;
  field.append(labelEl, valueEl);
  return field;
}

interface InputOptions {
  label: string;
  value: string;
  step: string;
  invalid: boolean;
  placeholder?: string;
  title?: string;
  /** Receives the raw text; parsing is the caller's decision. Fires on change (Enter / blur / spinner). */
  onCommit: (raw: string) => void;
}

export function inputRow(options: InputOptions): HTMLDivElement {
  const field = document.createElement("div");
  field.className = "field";
  if (options.title !== undefined) field.title = options.title;
  const labelEl = document.createElement("label");
  labelEl.textContent = options.label;
  const input = document.createElement("input");
  input.type = "number";
  input.step = options.step;
  input.value = options.value;
  input.dataset.field = options.label;
  if (options.placeholder !== undefined) input.placeholder = options.placeholder;
  if (options.invalid) input.classList.add("invalid");
  input.addEventListener("change", () => {
    options.onCommit(input.value);
  });
  field.append(labelEl, input);
  return field;
}

export function actionRow(label: string, title: string, onClick: () => void, danger = false): HTMLDivElement {
  const field = document.createElement("div");
  field.className = "field field-action";
  const buttonEl = document.createElement("button");
  buttonEl.type = "button";
  buttonEl.textContent = label;
  buttonEl.title = title;
  if (danger) buttonEl.classList.add("danger");
  buttonEl.addEventListener("click", onClick);
  field.appendChild(buttonEl);
  return field;
}

/** Required number: empty text is "no value" (NaN), which validation reports. Never coerced. */
export function parseRequired(raw: string): number {
  return raw.trim() === "" ? Number.NaN : Number(raw);
}

/** Optional dimension in mm: empty text means unknown (null). */
export function parseOptionalMm(raw: string): Length | null {
  return raw.trim() === "" ? null : millimetres(Number(raw));
}

export function mmText(value: Length): string {
  return Number.isFinite(value) ? String(toMillimetres(value)) : "";
}

export function optionalMmText(value: Length | null): string {
  return value === null ? "" : mmText(value);
}

export function isPositiveOrUnknown(value: Length | null): boolean {
  return value === null || (Number.isFinite(value) && value > 0);
}

export function formatMm(value: number, digits = 4): string {
  return `${(value * 1000).toFixed(digits)} mm`;
}

export function derivedText(value: DerivedLength): string {
  switch (value.status) {
    case "KNOWN":
      return formatMm(value.value);
    case "UNKNOWN":
      return `unknown (needs ${value.missing.join(", ")})`;
    case "INVALID_INPUT":
      return "invalid input";
  }
}
