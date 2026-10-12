import type { AppStore } from "@/app/store";
import { millimetres } from "@/units/length";
import { updateScrew } from "@/domain/movement";
import type { Screw } from "@/domain/screw";
import type { FrameId } from "@/domain/frame";
import { inputRow, mmText, parseRequired, readonlyRow, sectionHeader, selectRow, textRow } from "./fields";
import { deleteRow, positive, type Section } from "./common";

export function screwSection(store: AppStore, screw: Screw): Section {
  const { movement } = store;
  const edit = (patch: Parameters<typeof updateScrew>[2]): void => {
    store.edit((m) => updateScrew(m, screw.id, patch));
  };

  const frameSelect = selectRow("Frame", screw.frameId in movement.frames ? screw.frameId : "", [
    { value: "", label: "Choose a frame…" },
    ...Object.values(movement.frames).map((f) => ({ value: f.id, label: f.name })),
  ], (id) => { if (id !== "") edit({ frameId: id as FrameId }); },
    "The mainplate or bridge this screw holds in place — its own through-hole is punched into this frame (ASM-0056).");

  return [
    textRow("Name", screw.name, (name) => { edit({ name }); }),
    sectionHeader("Screw"),
    frameSelect,
    inputRow({
      label: "Position X (mm)", value: mmText(screw.position.x), step: "0.1", invalid: !Number.isFinite(screw.position.x),
      onCommit: (raw) => { edit({ position: { ...screw.position, x: millimetres(parseRequired(raw)) } }); },
    }),
    inputRow({
      label: "Position Y (mm)", value: mmText(screw.position.y), step: "0.1", invalid: !Number.isFinite(screw.position.y),
      onCommit: (raw) => { edit({ position: { ...screw.position, y: millimetres(parseRequired(raw)) } }); },
    }),
    inputRow({
      label: "Diameter (mm)", value: mmText(screw.diameter), step: "0.05", invalid: !positive(screw.diameter),
      onCommit: (raw) => { edit({ diameter: millimetres(parseRequired(raw)) }); },
    }),
    readonlyRow("Model", "a plain cylindrical through-hole in the chosen frame, at this position and diameter (ASM-0056)",
      "Visual only — no thread, head, countersink/counterbore, or clamping-torque data is modeled, and the second frame or bridge foot a real screw also clamps is not represented. Same treatment as this project's other declared, non-manufacturing geometry (ASM-0004, ASM-0051)."),
    deleteRow(store, screw.id, "Delete screw", "The referenced frame is not removed."),
  ];
}
