import { describe, expect, it } from "vitest";
import { degrees, toDegrees } from "@/units/angle";
import { metres } from "@/units/length";
import { joules } from "@/units/energy";
import { newtonMillimetres, toNewtonMillimetres } from "@/units/torque";
import { newtonMetresPerRadian } from "@/units/rotational";
import { rpmToRadPerSecond } from "@/units/angularVelocity";
import { fixedAt } from "@/domain/shaft";
import { setNominalTimeDrive, updateCouplingSpring, updateEscapement, updateShaft, type Movement } from "@/domain/movement";
import { mainsprings, type MainspringSpec } from "@/domain/coupling";
import { createTeachingMovement } from "@/app/teachingMovement";
import { analyzeMovement } from "@/analysis/analyzeMovement";
import { validateMovement } from "@/validation/validateMovement";
import { balanceEnergy, energyPerBeat, escapeTorque, powerReserveSeconds, springTorque, steadyAmplitude } from "./mainspringEnergy";
import { amplitudeAtWind, summarizeEnergy } from "./energySummary";

const spec: MainspringSpec = { usableTurns: 6.5, fullyWoundTorque: newtonMillimetres(10), letDownTorque: newtonMillimetres(6), trainEfficiency: null };

describe("simplified energy model (ASM-0026)", () => {
  it("spring torque is linear in wind and clamped to the entered range", () => {
    expect(toNewtonMillimetres(springTorque(spec, 6.5))).toBeCloseTo(10, 12);
    expect(toNewtonMillimetres(springTorque(spec, 3.25))).toBeCloseTo(8, 12);
    expect(toNewtonMillimetres(springTorque(spec, -1))).toBeCloseTo(6, 12);
    expect(toNewtonMillimetres(springTorque(spec, 9))).toBeCloseTo(10, 12);
  });

  it("power reserve: 6.5 turns at one drum turn per 6 h is 39 h", () => {
    expect((powerReserveSeconds(6.5, rpmToRadPerSecond(1 / 360)) ?? 0) / 3600).toBeCloseTo(39, 9);
  });

  it("escape torque conserves power through the train, less the configured efficiency", () => {
    const Td = newtonMillimetres(10);
    const wd = rpmToRadPerSecond(1 / 360);
    const we = rpmToRadPerSecond(10);
    expect(escapeTorque(Td, wd, we, null) * we).toBeCloseTo(Td * wd, 20);
    expect(escapeTorque(Td, wd, we, 0.5) * we).toBeCloseTo(0.5 * Td * wd, 20);
  });

  it("energy per beat is torque × half a pitch × escapement efficiency", () => {
    expect(energyPerBeat(newtonMillimetres(1), 15, 0.4)).toBeCloseTo(1e-3 * (Math.PI / 15) * 0.4, 18);
  });

  it("property: at the steady amplitude, energy in per period equals the loss 2πE/Q", () => {
    let seed = 5;
    const next = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let i = 0; i < 200; i += 1) {
      const E = joules(1e-7 * (0.1 + next()));
      const Q = 50 + next() * 400;
      const k = newtonMetresPerRadian(1e-7 * (0.5 + next()));
      const A = steadyAmplitude(E, Q, k);
      if (A === null) throw new Error("no amplitude");
      expect(2 * E).toBeCloseTo((2 * Math.PI * balanceEnergy(k, A)) / Q, 18);
    }
  });
});

describe("teaching movement energy chain", () => {
  const nominal = setNominalTimeDrive(createTeachingMovement());
  const running = analyzeMovement(nominal).train;
  const escapement = Object.values(nominal.escapements)[0];
  const link = mainsprings(nominal.couplings)[0];
  if (escapement === undefined || link === undefined) throw new Error("teaching movement incomplete");

  it("reports 39 h of reserve and the lossless escape torque, but no amplitude without Q and efficiency", () => {
    const s = summarizeEnergy(nominal, running);
    expect((s?.reserveSeconds ?? 0) / 3600).toBeCloseTo(39, 9);
    // Drum 1/6 rev/h, escape 600 rev/h: 3600 : 1.
    expect(toNewtonMillimetres(s?.escapeTorqueFull ?? newtonMillimetres(Number.NaN))).toBeCloseTo(10 / 3600, 12);
    expect(s?.lossless).toBe(true);
    expect(s?.amplitudeFull).toBeNull();
    expect(s?.missingForAmplitude).toEqual(["escapement efficiency", "balance quality factor Q"]);
    const info = validateMovement(nominal).find((i) => i.rule === "SPR-002");
    expect(info?.message).toContain("power reserve 39.0 h");
    expect(info?.message).toContain("lossless upper bound");
  });

  const withLosses = (q: number, eta: number): Movement =>
    updateEscapement(nominal, escapement.id, { escapementEfficiency: eta, balance: { ...escapement.balance, qualityFactor: q } });

  it("with Q and escapement efficiency the amplitude becomes an output, falling as √T while it unwinds", () => {
    const m = withLosses(250, 0.35);
    const s = summarizeEnergy(m, analyzeMovement(m).train);
    if (s?.amplitudeFull == null || s.amplitudeLetDown === null) throw new Error("no amplitude");
    expect(s.amplitudeLetDown / s.amplitudeFull).toBeCloseTo(Math.sqrt(6 / 10), 12);
    expect(amplitudeAtWind(s, 6.5)).toBeCloseTo(s.amplitudeFull, 12);
  });

  it("finds where the balance stops unlocking, and shortens the running reserve", () => {
    // Choose Q so the amplitude fully wound is 30°, just above half the lift angle (25°): A ∝ √Q.
    const probe = withLosses(1, 0.35);
    const a1 = summarizeEnergy(probe, analyzeMovement(probe).train)?.amplitudeFull ?? degrees(Number.NaN);
    const m = withLosses((degrees(30) / a1) ** 2, 0.35);
    const s = summarizeEnergy(m, analyzeMovement(m).train);
    if (s?.stopWindTurns == null || s.runningReserveSeconds === null || s.reserveSeconds === null) throw new Error("no stop");
    expect(s.stopWindTurns).toBeGreaterThan(0);
    expect(toDegrees(amplitudeAtWind(s, s.stopWindTurns) ?? degrees(Number.NaN))).toBeCloseTo(25, 9); // λ/2 = 50°/2
    expect(s.runningReserveSeconds).toBeLessThan(s.reserveSeconds);
    expect(validateMovement(m).some((i) => i.rule === "SPR-003" && i.severity === "warning")).toBe(true);
  });

  it("SPR-003 error when even fully wound it cannot unlock", () => {
    expect(validateMovement(withLosses(0.01, 0.05)).some((i) => i.rule === "SPR-003" && i.severity === "error")).toBe(true);
  });

  it("SPR-001 refuses invalid spring data", () => {
    const m = updateCouplingSpring(nominal, link.id, { ...spec, letDownTorque: newtonMillimetres(12) });
    expect(validateMovement(m).some((i) => i.rule === "SPR-001")).toBe(true);
  });
});

describe("pallet rules (ESC-104, ESC-105)", () => {
  const teaching = createTeachingMovement();
  const esc = Object.values(teaching.escapements)[0];
  const pallets = esc?.pallets;
  if (esc === undefined || pallets == null) throw new Error("teaching movement lacks pallets");
  const rules = (m: Movement): string[] =>
    validateMovement(m).filter((i) => i.rule === "ESC-104" || i.rule === "ESC-105").map((i) => `${i.rule}:${i.severity}:${i.id.split(":")[1] ?? ""}`);

  it("the teaching pallets meet the locking points with no issues", () => {
    expect(rules(teaching)).toEqual([]);
  });

  it("a whole-tooth span cannot give two beats per tooth", () => {
    expect(rules(updateEscapement(teaching, esc.id, { pallets: { ...pallets, spanTeeth: 3 } }))).toContain("ESC-104:error:span");
  });

  it("a pallet arbor off the tangential distance misses the locking points", () => {
    const placement = teaching.shafts[esc.palletArborShaftId]?.placement;
    if (placement?.kind !== "FIXED") throw new Error("pallet arbor is not fixed");
    const moved = fixedAt(metres(placement.position.x + 1e-4), placement.position.y); // 0.1 mm further along +X
    const m = updateShaft(teaching, esc.palletArborShaftId, { placement: moved });
    expect(rules(m)).toContain("ESC-104:error:centre-distance");
  });

  it("lock and run must leave room for impulse, and draw must be positive", () => {
    const m = updateEscapement(teaching, esc.id, { pallets: { ...pallets, lockAngle: degrees(10), drawAngle: degrees(0) } });
    const found = rules(m);
    expect(found.some((r) => r.startsWith("ESC-105:error:lock and run"))).toBe(true);
    expect(found).toContain("ESC-105:warning:no-draw");
  });
});
