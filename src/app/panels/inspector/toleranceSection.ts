import type { AppStore } from "@/app/store";
import { millimetres, type Length } from "@/units/length";
import type { EntityId } from "@/domain/ids";
import { setTolerance, updateTolerance } from "@/domain/movement";
import {
  createTolerance,
  nominalOf,
  toleranceFor,
  TOLERANCED_DIMENSION_LABELS,
  tolerancedDimensionsOf,
  type Tolerance,
  type ToleranceDistribution,
} from "@/domain/tolerance";
import { COVERAGE_LABELS, type StackResult } from "@/assembly/toleranceAnalysis";
import { actionButton, formatMm, inputRow, listRow, mmText, parseRequired, sectionHeader, selectRow, textRow } from "./fields";
import type { Section } from "./common";

function limitsText(nominal: Length | null | undefined, tolerance: Tolerance): string {
  if (nominal === null || nominal === undefined) return "dimension unknown";
  const lo = nominal + tolerance.lowerDeviation;
  const hi = nominal + tolerance.upperDeviation;
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return "enter both limits";
  return `${formatMm(lo)} … ${formatMm(hi)}`;
}

function toleranceRows(store: AppStore, tolerance: Tolerance): Section {
  const nominal = nominalOf(store.movement, tolerance.entityId, tolerance.dimension);
  const label = TOLERANCED_DIMENSION_LABELS[tolerance.dimension];
  const edit = (patch: Parameters<typeof updateTolerance>[2]): void => {
    store.edit((m) => updateTolerance(m, tolerance.id, patch));
  };
  const deviation = (which: "lowerDeviation" | "upperDeviation"): HTMLDivElement =>
    inputRow({
      label: `${label}: ${which === "lowerDeviation" ? "lower" : "upper"} dev. (mm)`,
      value: mmText(tolerance[which]),
      step: "0.001",
      invalid: !Number.isFinite(tolerance[which]),
      placeholder: "required",
      title: "Signed deviation from the nominal, e.g. −0.002 or +0.003.",
      onCommit: (raw) => { edit({ [which]: millimetres(parseRequired(raw)) }); },
    });
  return [
    listRow(`${label}: ${limitsText(nominal, tolerance)}`,
      actionButton("Remove", "Remove this tolerance. The dimension becomes nominal only.", () => { store.remove(tolerance.id); }, true)),
    deviation("lowerDeviation"),
    deviation("upperDeviation"),
    selectRow(`${label}: distribution`, tolerance.distribution, [
      { value: "NOT_STATED", label: "Not stated" },
      { value: "UNIFORM", label: "Uniform" },
      { value: "NORMAL", label: "Normal" },
    ], (value) => { edit({ distribution: value as ToleranceDistribution }); },
    "Recorded only. The analysis is worst-case and does not use it (ASM-0017)."),
    textRow(`${label}: source`, tolerance.source ?? "", (value) => {
      edit({ source: value.trim() === "" ? null : value });
    }),
    textRow(`${label}: checked against`, tolerance.validationScope, (value) => { edit({ validationScope: value }); }),
  ];
}

/**
 * Tolerances on an entity's entered dimensions (REF-ENG §14). A new
 * tolerance starts with empty limits: no default band is assumed.
 */
export function toleranceSection(store: AppStore, entityId: EntityId): Section {
  const dimensions = tolerancedDimensionsOf(store.movement, entityId);
  if (dimensions.length === 0) return [];
  const out: Section = [sectionHeader("Tolerances (declared, not validated)")];
  for (const dimension of dimensions) {
    const tolerance = toleranceFor(store.movement, entityId, dimension);
    if (tolerance !== null) {
      out.push(...toleranceRows(store, tolerance));
    } else {
      out.push(listRow(`${TOLERANCED_DIMENSION_LABELS[dimension]}: nominal only`,
        actionButton("Add", "Declare a tolerance on this dimension. Its limits start empty.", () => {
          const nan = millimetres(Number.NaN);
          store.edit((m) => setTolerance(m, createTolerance({ entityId, dimension, lowerDeviation: nan, upperDeviation: nan })));
        })));
    }
  }
  return out;
}

/** "nominal; worst case min … max (coverage)" for a clearance. */
export function stackText(result: StackResult): string {
  switch (result.status) {
    case "KNOWN": {
      const { stack } = result;
      if (stack.coverage === "NONE") return `${formatMm(stack.nominal)} (nominal only)`;
      return `${formatMm(stack.min)} … ${formatMm(stack.max)}`;
    }
    case "UNKNOWN":
      return `unknown (needs ${result.missing.join(", ")})`;
    case "INVALID_INPUT":
      return `invalid input (${result.reason})`;
  }
}

export function stackTitle(result: StackResult): string {
  return result.status === "KNOWN"
    ? `Worst case over declared tolerances; ${COVERAGE_LABELS[result.stack.coverage]} (ASM-0017). Not manufacturing validation (MFG-002).`
    : "Worst case over declared tolerances (ASM-0017).";
}
