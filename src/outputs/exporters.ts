import type { Movement } from "@/domain/movement";
import type { MovementAnalysis } from "@/analysis/analyzeMovement";
import type { ReferenceId, ValidationLevel } from "@/validation/validationIssue";
import { bomCsv } from "./bom";
import { renderMovementReport } from "./movementReport";
import { buildPlanDrawing } from "./drawing/planDrawing";
import { renderPlanSvg } from "./drawing/svg";
import { renderPlanDxf } from "./drawing/dxf";
import { buildStl } from "./stl";

/**
 * Export architecture. Every output format declares the model level its
 * content represents and the caveats that travel with it, so an export can
 * never look more validated than the model behind it. Formats the model
 * can't honestly produce yet are listed with the reason instead of being
 * approximated.
 */
export interface ExportInput {
  movement: Movement;
  analysis: MovementAnalysis;
  generatedAt: Date;
}

export interface ExportFile {
  filename: string;
  mimeType: string;
  content: string;
}

export type ExportAvailability = { status: "AVAILABLE" } | { status: "NOT_AVAILABLE"; reason: string };

export interface ExportFormat {
  id: "report-html" | "bom-csv" | "plan-svg" | "plan-dxf" | "assembly-stl" | "step";
  label: string;
  extension: string;
  /** The highest model level the content represents. */
  level: ValidationLevel;
  description: string;
  caveats: ReferenceId[];
  availability: ExportAvailability;
  produce: ((input: ExportInput) => ExportFile) | null;
}

/** A file-name stem from the design name: letters, digits, dot, dash and underscore only. */
export function fileStem(movement: Movement): string {
  const stem = movement.name.trim().replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "");
  return stem === "" ? "movement" : stem;
}

export const EXPORT_FORMATS: readonly ExportFormat[] = [
  {
    id: "report-html",
    label: "Engineering report",
    extension: "html",
    level: "L2_KINEMATIC",
    description: "Printable report: validation, gear train, plan drawing, BOM, tolerances, component reports and assumptions.",
    caveats: ["REF-ENG §15", "REF-ENG §16"],
    availability: { status: "AVAILABLE" },
    produce: ({ movement, analysis, generatedAt }) => ({
      filename: `${fileStem(movement)}-report.html`,
      mimeType: "text/html",
      content: renderMovementReport(movement, analysis, { generatedAt }),
    }),
  },
  {
    id: "bom-csv",
    label: "Bill of materials",
    extension: "csv",
    level: "L1_GEOMETRIC",
    description: "One row per modeled part, with nominal specification. Material is not modeled.",
    caveats: ["REF-ENG §14"],
    availability: { status: "AVAILABLE" },
    produce: ({ movement }) => ({
      filename: `${fileStem(movement)}-bom.csv`,
      mimeType: "text/csv",
      content: bomCsv(movement),
    }),
  },
  {
    id: "plan-svg",
    label: "Plan drawing",
    extension: "svg",
    level: "L1_GEOMETRIC",
    description: "Dimensioned plan: frame outlines, axes, pitch circles and centre distances, with a gear table. Nominal.",
    caveats: ["REF-ENG §6", "REF-ENG §14"],
    availability: { status: "AVAILABLE" },
    produce: ({ movement, analysis, generatedAt }) => ({
      filename: `${fileStem(movement)}-plan.svg`,
      mimeType: "image/svg+xml",
      content: renderPlanSvg(buildPlanDrawing(movement, analysis), { generatedAt: generatedAt.toISOString() }),
    }),
  },
  {
    id: "plan-dxf",
    label: "Plan drawing",
    extension: "dxf",
    level: "L1_GEOMETRIC",
    description: "The same plan as 2D CAD geometry at 1:1 in millimetres (DXF R12: lines, circles, text).",
    caveats: ["REF-ENG §6", "REF-ENG §14"],
    availability: { status: "AVAILABLE" },
    produce: ({ movement, analysis }) => ({
      filename: `${fileStem(movement)}-plan.dxf`,
      mimeType: "application/dxf",
      content: renderPlanDxf(buildPlanDrawing(movement, analysis)),
    }),
  },
  {
    id: "assembly-stl",
    label: "Visual mesh",
    extension: "stl",
    level: "L0_VISUAL",
    description: "Frames and gears as drawn in the viewport, in millimetres, for viewing or visual prototyping only. Tooth shapes are visual.",
    caveats: ["ASM-0004", "ASM-0005", "ASM-0010", "ASM-0012"],
    availability: { status: "AVAILABLE" },
    produce: ({ movement, analysis }) => {
      const stl = buildStl(movement, analysis);
      return { filename: `${fileStem(movement)}-visual.stl`, mimeType: "model/stl", content: stl.text };
    },
  },
  {
    id: "step",
    label: "Solid model",
    extension: "step",
    level: "L1_GEOMETRIC",
    description: "Exact solid geometry for CAD/CAM.",
    caveats: ["REF-ENG §6"],
    availability: {
      status: "NOT_AVAILABLE",
      reason:
        "Needs a solid-modeling (B-rep) kernel and defined tooth profiles. Gears are pitch models with no tooth flank (REF-ENG §6), so an exact solid would be invented geometry.",
    },
    produce: null,
  },
];

export function produceExport(id: ExportFormat["id"], input: ExportInput): ExportFile {
  const format = EXPORT_FORMATS.find((f) => f.id === id);
  if (format === undefined) throw new Error(`Unknown export format: ${id}`);
  if (format.produce === null) {
    throw new Error(format.availability.status === "NOT_AVAILABLE" ? format.availability.reason : `${format.label} is not available.`);
  }
  return format.produce(input);
}
