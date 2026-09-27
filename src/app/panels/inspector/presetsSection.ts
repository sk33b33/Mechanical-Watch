import type { KeyValueStore } from "@/persistence/autosave";
import { deletePreset, listPresets, PRESET_FIELDS, savePreset, type PartPreset, type PresetKind } from "@/persistence/presets";
import { toMillimetres, type Length } from "@/units/length";
import { actionButton, listRow, readonlyRow, sectionHeader } from "./fields";
import type { Section } from "./common";

type NotifyFn = (message: string, kind: "error" | "info") => void;
type ValuesOf<K extends PresetKind> = Extract<PartPreset, { kind: K }>["values"];

function formatValue(v: Length | null): string {
  return v === null ? "unset" : `${toMillimetres(v).toFixed(4)} mm`;
}

function summarize<K extends PresetKind>(kind: K, values: ValuesOf<K>): string {
  // Each PRESET_FIELDS[kind] key is one of this kind's own value fields by construction
  // (see PRESET_FIELDS in persistence/presets.ts), so this record view is safe.
  const record = values as unknown as Record<string, Length | null>;
  return PRESET_FIELDS[kind].map((f) => `${f.label.replace(/ \(mm\)$/, "")}: ${formatValue(record[f.key] ?? null)}`).join(", ");
}

/**
 * Save-and-apply presets for one part kind (Shaft/Gear/Jewel/Frame): the
 * user names the current values once, then applies that name to any other
 * part of the same kind. No invented defaults (CLAUDE.md "never invent an
 * engineering constant") — every value traces back to something the user
 * entered on some part, at some point. Manages its own re-rendering (a
 * save/delete doesn't touch the design, so the inspector's own render
 * cycle, which fires on design changes, wouldn't otherwise pick it up).
 */
export function presetRows<K extends PresetKind>(
  kind: K,
  currentValues: ValuesOf<K>,
  applyValues: (values: ValuesOf<K>) => void,
  storage: KeyValueStore | null,
  notify: NotifyFn,
): Section {
  const list = document.createElement("div");

  function renderList(): void {
    list.innerHTML = "";
    const result = listPresets(storage, kind);
    if (!result.ok) {
      list.appendChild(readonlyRow("Saved presets", result.reason));
      return;
    }
    if (result.value.length === 0) {
      list.appendChild(readonlyRow("Saved presets", `none yet for ${kind.toLowerCase()} parts`));
      return;
    }
    for (const preset of result.value) {
      // `preset` is Extract<PartPreset, { kind: K }> by listPresets's own signature (filtered by `kind`
      // above), but TS can't carry that through the generic K here; this cast reflects the runtime guarantee.
      const values = preset.values as ValuesOf<K>;
      list.appendChild(
        listRow(
          `${preset.name} — ${summarize(kind, values)}`,
          actionButton(
            "Apply",
            `Fill this part's fields from “${preset.name}” (only the fields this preset sets).`,
            () => { applyValues(values); },
          ),
        ),
      );
      const row = list.lastElementChild as HTMLDivElement;
      row.appendChild(
        actionButton("Remove", `Delete the “${preset.name}” preset (does not affect any part it was already applied to).`, () => {
          const removed = deletePreset(storage, preset.id);
          if (!removed.ok) notify(removed.reason, "error");
          renderList();
        }, true),
      );
    }
  }
  renderList();

  const saveField = document.createElement("div");
  saveField.className = "field field-action";
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "text-input";
  nameInput.placeholder = "Preset name";
  saveField.append(
    nameInput,
    actionButton(
      "Save current values as preset",
      "Records this part's current dimensions under a name, so they can be applied to other parts of the same kind.",
      () => {
        const name = nameInput.value.trim();
        if (name === "") {
          notify("Name the preset before saving it.", "error");
          return;
        }
        const result = savePreset(storage, { kind, name, values: currentValues });
        if (result.ok) {
          notify(`Saved preset “${name}”.`, "info");
          nameInput.value = "";
          renderList();
        } else {
          notify(result.reason, "error");
        }
      },
    ),
  );

  return [sectionHeader("Presets"), saveField, list];
}
