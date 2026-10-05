import { describe, expect, it } from "vitest";
import { degrees, toDegrees } from "@/units/angle";
import { metres, millimetres } from "@/units/length";
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

  it("SPR-004: a Q within the informal 100-300 range (ASM-0035) draws no advisory", () => {
    const m = withLosses(250, 0.35);
    expect(validateMovement(m).some((i) => i.rule === "SPR-004")).toBe(false);
  });

  it("SPR-004: a Q outside the informal range is an info advisory, not an error", () => {
    const tooLow = withLosses(20, 0.35);
    const info = validateMovement(tooLow).find((i) => i.rule === "SPR-004");
    expect(info?.severity).toBe("info");
    expect(info?.message).toContain("100–300");
    expect(info?.references).toContain("ASM-0035");

    const tooHigh = withLosses(5000, 0.35);
    expect(validateMovement(tooHigh).some((i) => i.rule === "SPR-004")).toBe(true);
  });

  it("SPR-004 does not fire when Q is unknown (already null in the teaching movement)", () => {
    expect(validateMovement(nominal).some((i) => i.rule === "SPR-004")).toBe(false);
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

describe("drop and pallet width (ESC-106, ESC-107, ASM-0036, ASM-0037)", () => {
  const teaching = createTeachingMovement();
  const esc = Object.values(teaching.escapements)[0];
  const pallets = esc?.pallets;
  if (esc === undefined || pallets == null) throw new Error("teaching movement lacks pallets");
  const dropRules = (m: Movement): string[] =>
    validateMovement(m).filter((i) => i.rule === "ESC-106" || i.rule === "ESC-107").map((i) => `${i.rule}:${i.severity}:${i.id.split(":")[1] ?? ""}`);

  it("the teaching movement's Playtner 15-tooth example (1.5° drop, 6° pallet) reports the clearance and the derived 4.5° tooth width", () => {
    expect(dropRules(teaching)).toEqual(["ESC-107:info:drop-clearance", "ESC-107:info:tooth-width"]);
    const info = validateMovement(teaching).find((i) => i.rule === "ESC-107" && i.id.includes("tooth-width"));
    expect(info?.message).toContain("4.50°");
  });

  it("drop must be positive", () => {
    const m = updateEscapement(teaching, esc.id, { pallets: { ...pallets, dropAngle: degrees(0) } });
    expect(dropRules(m)).toContain("ESC-106:error:drop-budget");
  });

  it("drop must stay under the one-beat wheel-angle budget (180°/15 teeth = 12°)", () => {
    const m = updateEscapement(teaching, esc.id, { pallets: { ...pallets, dropAngle: degrees(12) } });
    expect(dropRules(m)).toContain("ESC-106:error:drop-budget");
  });

  it("drop outside the informal 1-2° club-tooth range is an advisory, not an error", () => {
    const tooSmall = updateEscapement(teaching, esc.id, { pallets: { ...pallets, dropAngle: degrees(0.5) } });
    const found = dropRules(tooSmall);
    expect(found).toContain("ESC-107:info:drop-advisory");
    expect(found).toContain("ESC-107:info:drop-clearance");
    expect(found.every((r) => !r.startsWith("ESC-106"))).toBe(true);
  });

  it("pallet width must be positive", () => {
    const m = updateEscapement(teaching, esc.id, { pallets: { ...pallets, widthAngle: degrees(0) } });
    expect(dropRules(m)).toContain("ESC-106:error:pallet-width");
  });

  it("pallet width plus drop must leave room for the tooth within the budget", () => {
    // 11° pallet + 1.5° drop = 12.5° > the 12° budget, leaving a negative tooth width.
    const m = updateEscapement(teaching, esc.id, { pallets: { ...pallets, widthAngle: degrees(11) } });
    const found = dropRules(m);
    expect(found).toContain("ESC-106:error:tooth-width-budget");
    expect(found.every((r) => !r.startsWith("ESC-107"))).toBe(true);
  });

  it("a ratchet tooth (ASM-0038) allows the derived tooth width to be exactly zero, unlike club", () => {
    // 10.5° pallet + 1.5° drop = 12° budget exactly, leaving zero tooth width.
    const club = updateEscapement(teaching, esc.id, { pallets: { ...pallets, widthAngle: degrees(10.5) } });
    expect(dropRules(club)).toContain("ESC-106:error:tooth-width-budget");

    const ratchet = updateEscapement(club, esc.id, { escapeWheel: { ...esc.escapeWheel, toothKind: "RATCHET" } });
    const found = dropRules(ratchet);
    expect(found.every((r) => !r.startsWith("ESC-106"))).toBe(true);
    const info = validateMovement(ratchet).find((i) => i.rule === "ESC-107" && i.id.includes("tooth-width"));
    expect(info?.message).toContain("0.00°");
  });

  it("a ratchet tooth still requires the derived tooth width to be non-negative", () => {
    // 11° pallet + 1.5° drop = 12.5° > the 12° budget, leaving a negative tooth width even for a ratchet tooth.
    const m = updateEscapement(teaching, esc.id, {
      pallets: { ...pallets, widthAngle: degrees(11) },
      escapeWheel: { ...esc.escapeWheel, toothKind: "RATCHET" },
    });
    const found = dropRules(m);
    expect(found).toContain("ESC-106:error:tooth-width-budget");
    const err = validateMovement(m).find((i) => i.rule === "ESC-106" && i.id.includes("tooth-width-budget"));
    expect(err?.message).toContain("ratchet");
    expect(err?.message).toContain("non-negative");
  });

  it("the drop advisory cites the type-specific figure (1.5° club, 2° ratchet)", () => {
    const club = updateEscapement(teaching, esc.id, { pallets: { ...pallets, dropAngle: degrees(0.5) } });
    const clubInfo = validateMovement(club).find((i) => i.rule === "ESC-107" && i.id.includes("drop-advisory"));
    expect(clubInfo?.message).toContain("club-tooth escapement (1.5°");

    const ratchet = updateEscapement(teaching, esc.id, {
      pallets: { ...pallets, dropAngle: degrees(0.5) },
      escapeWheel: { ...esc.escapeWheel, toothKind: "RATCHET" },
    });
    const ratchetInfo = validateMovement(ratchet).find((i) => i.rule === "ESC-107" && i.id.includes("drop-advisory"));
    expect(ratchetInfo?.message).toContain("ratchet-tooth escapement (2°");
  });
});

describe("escape-tooth locking face, derived from draw (ESC-108, ASM-0039)", () => {
  const teaching = createTeachingMovement();
  const esc = Object.values(teaching.escapements)[0];
  const pallets = esc?.pallets;
  if (esc === undefined || pallets == null) throw new Error("teaching movement lacks pallets");
  const drawRules = (m: Movement): string[] =>
    validateMovement(m).filter((i) => i.rule === "ESC-108").map((i) => `${i.rule}:${i.severity}:${i.id.split(":")[1] ?? ""}`);

  it("the teaching movement's 12° draw derives a 24° escape-tooth locking face, within Playtner's practical range", () => {
    expect(drawRules(teaching)).toEqual(["ESC-108:info:tooth-draw"]);
    const info = validateMovement(teaching).find((i) => i.rule === "ESC-108" && i.id.includes("tooth-draw"));
    expect(info?.message).toContain("24.00°");
    expect(info?.message).toContain("12.00°");
  });

  it("nothing is derived without a positive draw angle", () => {
    const m = updateEscapement(teaching, esc.id, { pallets: { ...pallets, drawAngle: degrees(0) } });
    expect(drawRules(m)).toEqual([]);
  });

  it("a derived tooth-face angle outside the practically cited 20°-28° range is an advisory", () => {
    // 8° draw -> 16° derived tooth face, below the 20° floor.
    const tooLittle = updateEscapement(teaching, esc.id, { pallets: { ...pallets, drawAngle: degrees(8) } });
    expect(drawRules(tooLittle)).toEqual(["ESC-108:info:tooth-draw", "ESC-108:info:tooth-draw-advisory"]);

    // 15° draw -> 30° derived tooth face, above the 28° ceiling.
    const tooMuch = updateEscapement(teaching, esc.id, { pallets: { ...pallets, drawAngle: degrees(15) } });
    expect(drawRules(tooMuch)).toEqual(["ESC-108:info:tooth-draw", "ESC-108:info:tooth-draw-advisory"]);
  });
});

describe("impulse radius and the derived fork acting length (ESC-109, ASM-0041)", () => {
  const teaching = createTeachingMovement();
  const esc = Object.values(teaching.escapements)[0];
  if (esc === undefined) throw new Error("teaching movement lacks an escapement");
  const forkRules = (m: Movement): string[] =>
    validateMovement(m).filter((i) => i.rule === "ESC-109").map((i) => `${i.rule}:${i.severity}:${i.id.split(":")[1] ?? ""}`);

  it("the teaching movement's 0.9mm impulse radius derives a 4.5mm fork acting length (Playtner's own worked example)", () => {
    expect(forkRules(teaching)).toEqual(["ESC-109:info:fork-acting-length"]);
    const info = validateMovement(teaching).find((i) => i.rule === "ESC-109" && i.id.includes("fork-acting-length"));
    expect(info?.message).toContain("4.5000 mm");
  });

  it("nothing is derived without an entered impulse radius", () => {
    const m = updateEscapement(teaching, esc.id, { balance: { ...esc.balance, impulseRadius: null } });
    expect(forkRules(m)).toEqual([]);
  });

  it("a non-positive impulse radius is an error", () => {
    const zero = updateEscapement(teaching, esc.id, { balance: { ...esc.balance, impulseRadius: millimetres(0) } });
    expect(forkRules(zero)).toEqual(["ESC-109:error:impulse-radius"]);

    const negative = updateEscapement(teaching, esc.id, { balance: { ...esc.balance, impulseRadius: millimetres(-0.5) } });
    expect(forkRules(negative)).toEqual(["ESC-109:error:impulse-radius"]);
  });
});

describe("ruby-pin entry freedom, slot shake and the suggested width (ESC-110, ASM-0042)", () => {
  const teaching = createTeachingMovement();
  const esc = Object.values(teaching.escapements)[0];
  const pallets = esc?.pallets;
  if (esc === undefined || pallets == null) throw new Error("teaching movement lacks pallets");
  const rubyRules = (m: Movement): string[] =>
    validateMovement(m).filter((i) => i.rule === "ESC-110").map((i) => `${i.rule}:${i.severity}:${i.id.split(":")[1] ?? ""}`);

  it("the teaching movement's 1.25° entry freedom and 0.25° slot shake are within Playtner's cited figures, only the suggested width reports", () => {
    expect(rubyRules(teaching)).toEqual(["ESC-110:info:suggested-width"]);
    const info = validateMovement(teaching).find((i) => i.rule === "ESC-110" && i.id.includes("suggested-width"));
    // Half the teaching movement's 10° lever angle.
    expect(info?.message).toContain("5.00°");
  });

  it("entry freedom must be positive", () => {
    const m = updateEscapement(teaching, esc.id, { pallets: { ...pallets, rubyPinEntryFreedom: degrees(0) } });
    expect(rubyRules(m)).toContain("ESC-110:error:entry-freedom");
  });

  it("entry freedom must be less than the total lock (lock + run), or a premature strike could fully unlock the pallets", () => {
    // Teaching movement: lock 2° + run 0.5° = 2.5° total lock.
    const m = updateEscapement(teaching, esc.id, { pallets: { ...pallets, rubyPinEntryFreedom: degrees(2.5) } });
    const found = rubyRules(m);
    expect(found).toContain("ESC-110:error:entry-freedom-lock");
    const err = validateMovement(m).find((i) => i.rule === "ESC-110" && i.id.includes("entry-freedom-lock"));
    expect(err?.message).toContain("2.50°");
  });

  it("entry freedom outside the cited 1°-1¼° range (but under the total lock) is an advisory", () => {
    const m = updateEscapement(teaching, esc.id, { pallets: { ...pallets, rubyPinEntryFreedom: degrees(0.5) } });
    const found = rubyRules(m);
    expect(found).toContain("ESC-110:info:entry-freedom-advisory");
    expect(found.every((r) => !r.includes("error"))).toBe(true);
  });

  it("slot shake must be positive", () => {
    const m = updateEscapement(teaching, esc.id, { pallets: { ...pallets, rubyPinSlotShake: degrees(-0.1) } });
    expect(rubyRules(m)).toContain("ESC-110:error:slot-shake");
  });

  it("slot shake outside the cited ¼°-½° range is an advisory", () => {
    const m = updateEscapement(teaching, esc.id, { pallets: { ...pallets, rubyPinSlotShake: degrees(1) } });
    expect(rubyRules(m)).toContain("ESC-110:info:slot-shake-advisory");
  });

  it("nothing is derived for entry freedom or slot shake when they are not entered", () => {
    const m = updateEscapement(teaching, esc.id, { pallets: { ...pallets, rubyPinEntryFreedom: null, rubyPinSlotShake: null } });
    const found = rubyRules(m);
    expect(found).toEqual(["ESC-110:info:suggested-width"]);
  });
});
