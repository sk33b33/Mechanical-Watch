import type { Movement } from "@/domain/movement";
import { nominalOf, TOLERANCED_DIMENSION_LABELS } from "@/domain/tolerance";
import { findEntity } from "@/domain/lookup";
import type { MovementAnalysis } from "@/analysis/analyzeMovement";
import { declaredLevelStatus, type ValidationIssue, type ValidationSeverity } from "@/validation/validationIssue";
import { VALIDATION_LEVEL_LABELS } from "@/reference/validationLevels";
import { listAssumptions } from "@/reference/assumptions";
import { DESIGN_SCHEMA_VERSION } from "@/persistence/designFile";
import { BOM_COLUMNS, buildBom } from "./bom";
import { componentReports, meshReports, mmText, type ComponentReport, type ReportValue } from "./componentReport";
import { buildPlanDrawing } from "./drawing/planDrawing";
import { buildElevationDrawing } from "./drawing/elevationDrawing";
import { escapeXml as esc, renderPlanSvg } from "./drawing/svg";

/**
 * A self-contained, printable HTML engineering report generated entirely
 * from the design model and its analysis. It states the declared level
 * and whether validation currently meets it, and never claims more than
 * that (REF-ENG §15–16, MFG-001, MFG-002).
 */
export interface ReportOptions {
  generatedAt: Date;
}

const SEVERITIES: readonly ValidationSeverity[] = ["blocker", "error", "warning", "info"];

function table(header: readonly string[], rows: readonly (readonly string[])[], className = ""): string {
  if (rows.length === 0) return `<p class="muted">None.</p>`;
  return `<table${className === "" ? "" : ` class="${className}"`}><thead><tr>${header.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
}

function valueRows(values: readonly ReportValue[]): string[][] {
  return values.map((v) => [v.label, v.text, v.equation ?? "", VALIDATION_LEVEL_LABELS[v.level], v.references.join(", ")]);
}

function issueRows(movement: Movement, issues: readonly ValidationIssue[]): string[][] {
  return issues.map((i) => [
    i.severity,
    i.rule,
    VALIDATION_LEVEL_LABELS[i.validationLevel],
    i.message,
    i.entityIds.map((id) => findEntity(movement, id)?.name ?? id).join(", "),
    i.references.join(", "),
  ]);
}

function componentHtml(movement: Movement, c: ComponentReport): string {
  return `<section class="component" id="${esc(c.id)}">
<h3>${esc(c.name)} <span class="muted">— ${esc(c.kind)}, ${esc(c.description)}</span></h3>
<h4>Entered parameters</h4>
${table(["Parameter", "Value"], c.parameters.map((p) => [p.label, p.text]))}
<h4>Derived (model predicts)</h4>
${table(["Quantity", "Value", "Equation", "Level", "Basis"], valueRows(c.derived))}
${c.tolerances.length === 0 ? "" : `<h4>Tolerances (declared, not validated)</h4>
${table(["Dimension", "Nominal", "Limits", "Distribution", "Source", "Checked against"], c.tolerances.map((t) => [t.dimension, t.nominal, t.limits, t.distribution, t.source, t.scope]))}`}
${c.issues.length === 0 ? "" : `<h4>Validation issues</h4>
${table(["Severity", "Rule", "Level", "Message", "Parts", "Basis"], issueRows(movement, c.issues))}`}
</section>`;
}

const rpm = (omega: number): string => ((omega * 60) / (2 * Math.PI)).toFixed(6);

export function renderMovementReport(movement: Movement, analysis: MovementAnalysis, options: ReportOptions): string {
  const generated = options.generatedAt.toISOString();
  const status = declaredLevelStatus(movement.declaredValidationLevel, analysis.issues);
  const counts = SEVERITIES.map((s) => `${String(analysis.issues.filter((i) => i.severity === s).length)} ${s}`).join(", ");
  const tolerances = Object.values(movement.tolerances);
  const components = componentReports(movement, analysis);
  const meshes = meshReports(movement, analysis);
  const bom = buildBom(movement);
  const drawing = buildPlanDrawing(movement, analysis);
  const svg = renderPlanSvg(drawing, { generatedAt: generated });
  const elevation = buildElevationDrawing(movement, analysis);
  const elevationSvg = renderPlanSvg(elevation, { generatedAt: generated });

  const arborRows = Object.values(movement.shafts)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((s) => {
      const omega = analysis.train.shaftAngularVelocity.get(s.id);
      return [
        s.name,
        s.hand === null ? "" : s.hand.toLowerCase(),
        omega === undefined ? "unpowered" : rpm(omega),
        omega === undefined ? "" : omega === 0 ? "stationary" : omega > 0 ? "clockwise" : "counter-clockwise",
      ];
    });

  const referenced = new Set<string>([
    ...analysis.issues.flatMap((i) => i.references),
    ...components.flatMap((c) => c.derived.flatMap((d) => d.references)),
  ]);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(movement.name)} — engineering report</title>
<style>
  :root { color-scheme: light; }
  body { font: 13px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; color: #111; background: #fff; margin: 24px auto; max-width: 1100px; padding: 0 16px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 17px; border-bottom: 1px solid #999; padding-bottom: 3px; margin-top: 28px; }
  h3 { font-size: 14px; margin: 18px 0 4px; }
  h4 { font-size: 12px; margin: 10px 0 4px; text-transform: uppercase; letter-spacing: .04em; color: #444; }
  table { border-collapse: collapse; width: 100%; margin: 4px 0 8px; font-size: 12px; }
  th, td { border: 1px solid #bbb; padding: 3px 6px; text-align: left; vertical-align: top; }
  th { background: #eee; }
  td { font-variant-numeric: tabular-nums; }
  .muted { color: #666; font-weight: normal; }
  .claims { border: 2px solid #333; padding: 8px 12px; margin: 12px 0; background: #fafafa; }
  .claims b { display: inline-block; min-width: 190px; }
  .ok { color: #11632f; } .bad { color: #a01919; }
  .drawing { overflow-x: auto; border: 1px solid #ccc; padding: 4px; }
  .drawing svg { max-width: 100%; height: auto; }
  .component { break-inside: avoid; }
  nav ol { columns: 2; }
  @media print { body { margin: 0; max-width: none; } h2 { break-after: avoid; } a { color: inherit; text-decoration: none; } }
</style>
</head>
<body>
<h1>${esc(movement.name)} — engineering report</h1>
<div class="muted">Generated ${esc(generated)} from the design model (design schema ${String(DESIGN_SCHEMA_VERSION)}). Values are computed in SI units and rounded only for display.</div>

<div class="claims">
<div><b>Declared validation level</b> ${esc(VALIDATION_LEVEL_LABELS[movement.declaredValidationLevel])}: ${status.satisfied
    ? `<span class="ok">currently met</span> (no blocking issue at or below it)`
    : `<span class="bad">not met</span> (${String(status.blockingIssues.length)} blocking issue${status.blockingIssues.length === 1 ? "" : "s"})`}</div>
<div><b>Validation issues</b> ${esc(counts)}</div>
<div><b>Tolerances</b> ${tolerances.length === 0
    ? "none declared: every dimension in this report is nominal only (MFG-001)"
    : `${String(tolerances.length)} declared; worst-case stacks shown for side shake and endshake; all other dimensions are nominal (MFG-001, ASM-0017)`}</div>
<div><b>Manufacturing readiness</b> not validated. No manufacturing or physical validation has been performed (MFG-002, L5 not reached).</div>
${Object.keys(movement.escapements).length > 0 ? `<div><b>Escapement</b> SIMPLIFIED ESCAPEMENT MODEL (kinematic). Beat rate is derived from the train${movement.drive?.kind === "BALANCE" ? ", which is governed by the balance's free frequency (simplified dynamic model, L3, ASM-0024)" : ""}; the balance is shown at a declared amplitude unless the simplified energy model (L3, ASM-0026) can predict it from entered spring data, Q and escapement efficiency; pallet locking geometry is simplified (ASM-0025); rate accuracy is not modeled (ESC-001, ESC-002).</div>` : ""}
${movement.isTeachingDemo ? `<div><b>Teaching demo</b> dimensions are illustrative and not a production caliber (ASM-0009).</div>` : ""}
</div>

<nav><ol>
<li><a href="#validation">Validation</a></li>
<li><a href="#train">Gear train and arbor speeds</a></li>
<li><a href="#plan">Plan drawing</a></li>
<li><a href="#elevation">Elevation drawing</a></li>
<li><a href="#bom">Bill of materials</a></li>
<li><a href="#tolerances">Tolerances</a></li>
<li><a href="#components">Component reports</a></li>
<li><a href="#assumptions">Assumptions</a></li>
</ol></nav>

<h2 id="validation">1. Validation</h2>
${table(["Severity", "Rule", "Level", "Message", "Parts", "Basis"], issueRows(movement, analysis.issues))}

<h2 id="train">2. Gear train and arbor speeds</h2>
<p>Kinematic (L2) results with the clutches engaged (running). The drive is ${movement.drive === null
    ? "not set, so no speeds are computed"
    : movement.drive.kind === "NOMINAL_TIME"
      ? "nominal time: the minutes-hand arbor turns once per hour (ASM-0014)"
      : movement.drive.kind === "BALANCE"
        ? "the balance: its free frequency (simplified dynamic model, L3, ASM-0024) sets the escape arbor's speed and the train follows"
        : `prescribed on ${esc(movement.shafts[movement.drive.shaftId]?.name ?? "a missing arbor")} (ASM-0007)`}. Speeds are kinematic: no friction is modeled, and torque and energy appear only in the simplified energy model reported with the escapement (L3, ASM-0026).</p>
<h4>Meshes</h4>
${table([
    "Driving", "Driven", "z1", "z2", "Module", "Speed ratio −z1/z2", "Ideal centre distance", "Placed centre distance",
    ...(tolerances.length > 0 ? ["Worst case (tol., ASM-0027)"] : []),
  ], meshes.map((m) => [
    m.driving, m.driven, String(m.z1), String(m.z2), m.module,
    m.ratio === null ? "—" : m.ratio.toFixed(6),
    m.idealCentreDistance === null ? "—" : mmText(m.idealCentreDistance),
    m.actualCentreDistance === null ? "unresolved" : mmText(m.actualCentreDistance),
    ...(tolerances.length > 0 ? [m.centreDistanceTolerance ?? "nominal only"] : []),
  ]))}
<h4>Arbors</h4>
${table(["Arbor", "Hand", "Speed (rev/min)", "Direction seen from the dial"], arborRows)}
${components.filter((c) => c.kind === "Escapement").map((c) => `<h4>${esc(c.name)}: SIMPLIFIED ESCAPEMENT MODEL</h4>
<p>Two beats per escape tooth (ASM-0021, source pending). Balance frequencies from inertia and hairspring stiffness use a linear, undamped, isochronous oscillator (simplified dynamic, L3, ASM-0024); amplitude dependence ("circular error") has an optional, declared/measured first-order correction (ASM-0034) and is otherwise not modeled; escapement, position and temperature effects on rate are never modeled, so the daily rate is a model prediction, not a rate-accuracy claim. Pallet values use simplified tangential locking (L1, ASM-0025). Energy values use a linear torque curve, power balance through the train and a steady-state amplitude from the balance's Q (simplified, L3, ASM-0026); without a configured train efficiency, torques are lossless upper bounds. All of it requires physical validation.</p>
${table(["Quantity", "Value", "Equation", "Basis"], c.derived.map((d) => [d.label, d.text, d.equation ?? "", d.references.join(", ")]))}`).join("\n")}
${components.filter((c) => c.kind === "Keyless works").map((c) => `<h4>${esc(c.name)}: crown</h4>
<p>Winding and setting are kinematic only: no winding torque, spring state or setting friction is modeled (ASM-0007, ASM-0015). Right-angle stem meshes are rolling pitch circles (ASM-0019).</p>
${table(["Quantity", "Value", "Basis"], c.derived.filter((d) => /direction|crown|forward/i.test(d.label)).map((d) => [d.label, d.text, d.references.join(", ")]))}`).join("\n")}

<h2 id="plan">3. Plan drawing</h2>
<div class="drawing">${svg}</div>

<h2 id="elevation">4. Elevation drawing</h2>
<p>Axial (Z) stack projected onto the X-Z plane (ASM-0006); frames, gear and escapement bodies (at pitch/tip diameter, REF-ENG §6) and bearing markers (flush with their frame's inner face, ASM-0011). The keyless works, stem and dial hand pipes are not shown (the stem has no single faithful elevation in this projection).</p>
<div class="drawing">${elevationSvg}</div>

<h2 id="bom">5. Bill of materials</h2>
<p class="muted">One row per modeled part. Material, finish and supplier are not modeled.</p>
${table(BOM_COLUMNS.map((c) => c.label), bom.map((r) => BOM_COLUMNS.map((c) => String(r[c.key]))))}

<h2 id="tolerances">6. Tolerances</h2>
<p>Tolerances are declared design intent (REF-ENG §14), not measured or validated values. Limits are nominal plus the signed deviations. The worst-case analysis does not use distributions (ASM-0017).</p>
${table(["Part", "Dimension", "Nominal", "Lower limit", "Upper limit", "Distribution", "Source", "Checked against"], tolerances.map((t) => {
    const nominal = nominalOf(movement, t.entityId, t.dimension);
    const known = nominal !== null && nominal !== undefined;
    return [
      findEntity(movement, t.entityId)?.name ?? "missing part",
      TOLERANCED_DIMENSION_LABELS[t.dimension],
      known ? mmText(nominal) : "unknown",
      known ? mmText((nominal + t.lowerDeviation)) : "—",
      known ? mmText((nominal + t.upperDeviation)) : "—",
      t.distribution === "NOT_STATED" ? "not stated" : t.distribution.toLowerCase(),
      t.source ?? "none given",
      t.validationScope.trim() === "" ? "not stated" : t.validationScope,
    ];
  }))}

<h2 id="components">7. Component reports</h2>
${components.map((c) => componentHtml(movement, c)).join("\n")}

<h2 id="assumptions">8. Assumptions</h2>
<p>The full assumption register (reference/assumptions/ASSUMPTION_REGISTER.md). Entries cited in this report are marked.</p>
${table(["ID", "Cited here", "Assumption", "Scope", "Status"], listAssumptions().map((a) => [a.id, referenced.has(a.id) ? "yes" : "", a.summary, a.scope, a.status]))}

<p class="muted">End of report. Display rounding: lengths to 0.0001 mm, speeds and ratios to 6 decimals.</p>
</body>
</html>
`;
}
