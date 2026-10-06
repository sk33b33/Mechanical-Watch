import type { EntityId } from "@/domain/ids";
import type { Movement } from "@/domain/movement";
import { addDateComplication, addDial, addEscapement, addFrame, addGear, addKeylessWorks, addLeapYearComplication, addMonthComplication, addMoonPhase, addShaft } from "@/domain/movement";
import type { Frame } from "@/domain/frame";
import type { Gear } from "@/domain/gear";
import type { Coupling } from "@/domain/coupling";
import type { Shaft, ShaftPlacement } from "@/domain/shaft";
import { fixedAt } from "@/domain/shaft";
import { shaftSupport } from "@/assembly/assemblyGeometry";
import { solvePlacement } from "@/kinematics/solvePlacement";
import { createTeachingMovement } from "@/app/teachingMovement";

/**
 * One step of the guided "build the teaching movement" walkthrough.
 *
 * `isComplete` is checked against the domain model (never UI state) after
 * every design change, per this app's "domain model is authoritative"
 * rule — a step is done when the design says so, not when a button was
 * merely clicked. `null` means the step only advances when the user
 * presses Next/Done.
 *
 * `targetSelector` is a CSS selector for the control the step wants the
 * user to use; the tutorial banner (tutorialBanner.ts) highlights whatever
 * currently matches it, in the main document only — a control popped out
 * into its own window (layout/panelWindows.ts) won't be highlighted
 * there, a stated limitation, not a silent gap.
 *
 * `createOverride`, where present, is what actually runs when the user
 * clicks/chooses the target control, in place of the normal "create an
 * empty part" action: it builds the part directly from the teaching
 * movement's own real values (name, tooth count, module, thickness,
 * position, …), so nothing needs retyping. Every value it uses comes from
 * `teachingMovement.ts` itself — nothing is invented here (CLAUDE.md).
 *
 * `selectFromStep`, where present, names an earlier step whose created
 * entity should be selected again before this step is shown, so the
 * right inspector section (and so the target control) is actually on
 * screen — e.g. re-selecting "Barrel drum" before meshing it with
 * "Centre pinion", after creating the pinion moved the selection away.
 */
export interface TutorialStep {
  id: string;
  title: string;
  instructions: string;
  targetSelector: string | null;
  isComplete: ((movement: Movement) => boolean) | null;
  selectFromStep?: string;
  createOverride?: (movement: Movement) => { movement: Movement; id: EntityId };
  /** Deselect the current part before showing this step, so the movement-level section (and its Drive field) is what's on screen. */
  deselect?: true;
}

function byName<T extends { name: string }>(record: Record<string, T>, name: string): T {
  const found = Object.values(record).find((e) => e.name === name);
  if (found === undefined) throw new Error(`teaching movement reference: no entity named "${name}"`);
  return found;
}

function only<T>(record: Record<string, T>): T {
  const [first] = Object.values(record);
  if (first === undefined) throw new Error("teaching movement reference: expected exactly one entity");
  return first;
}

function couplingOfKind(record: Record<string, Coupling>, kind: Coupling["kind"]): Coupling {
  const found = Object.values(record).find((c) => c.kind === kind);
  if (found === undefined) throw new Error(`teaching movement reference: no ${kind} coupling`);
  return found;
}

/** Builds the ~51-step walkthrough from a real teaching movement (createTeachingMovement()), read once at module load. */
function buildTeachingMovementSteps(): TutorialStep[] {
  const ref = createTeachingMovement();
  const placement = solvePlacement(ref);

  /**
   * A FIXED position taken from the real design's own solved layout.
   * Seven of these arbors (barrel, third, fourth, escape, minute wheel,
   * crown wheel, setting wheel) are placed by MESH_POLAR in
   * teachingMovement.ts itself, which needs their mesh to exist first;
   * using the solved coordinate directly here keeps "add the arbor" a
   * single action instead of "add it, then come back once it's meshed to
   * set its placement". A stated simplification: the numbers are real,
   * the constraint mechanism creating them is not replicated here.
   */
  function solvedFixed(shaft: Shaft): ShaftPlacement {
    const pos = placement.shaftPositions.get(shaft.id);
    if (pos === undefined) throw new Error(`teaching movement reference: no solved position for "${shaft.name}"`);
    return fixedAt(pos.x, pos.y);
  }

  function frameStep(id: string, title: string, refFrame: Frame): TutorialStep {
    const buttonLabel = refFrame.kind === "MAINPLATE" ? "+ Mainplate" : "+ Bridge";
    return {
      id,
      title,
      instructions: `Click “${buttonLabel}” in the component tree to add “${refFrame.name}”, with its real outline and thickness already filled in.`,
      targetSelector: `[data-tutorial="add-${refFrame.kind === "MAINPLATE" ? "mainplate" : "bridge"}"]`,
      isComplete: (m) => m.frames[refFrame.id] !== undefined,
      createOverride: (m) => ({ movement: addFrame(m, refFrame), id: refFrame.id }),
    };
  }

  function arborStep(id: string, title: string, instructions: string, refShaft: Shaft, placementOverride: ShaftPlacement, selectFromStep?: string): TutorialStep {
    const withPlacement: Shaft = { ...refShaft, placement: placementOverride };
    return {
      id,
      title,
      instructions,
      targetSelector: '[data-tutorial="add-arbor"]',
      isComplete: (m) => m.shafts[refShaft.id] !== undefined,
      ...(selectFromStep === undefined ? {} : { selectFromStep }),
      createOverride: (m) => ({ movement: addShaft(m, withPlacement), id: withPlacement.id }),
    };
  }

  function gearStep(id: string, title: string, instructions: string, refGear: Gear, selectFromStep?: string): TutorialStep {
    return {
      id,
      title,
      instructions,
      targetSelector: '[data-tutorial="add-gear"]',
      isComplete: (m) => m.gears[refGear.id] !== undefined,
      ...(selectFromStep === undefined ? {} : { selectFromStep }),
      createOverride: (m) => ({ movement: addGear(m, refGear), id: refGear.id }),
    };
  }

  function meshStep(id: string, title: string, driving: Gear, driven: Gear, selectFromStep?: string): TutorialStep {
    return {
      id,
      title,
      instructions: `Select “${driving.name}”, then use “Mesh with” in its inspector to choose “${driven.name}” — the only gear on another arbor at this point.`,
      targetSelector: '[data-field="Mesh with"]',
      isComplete: (m) => Object.values(m.gearMeshes).some((gm) => gm.drivingGearId === driving.id && gm.drivenGearId === driven.id),
      ...(selectFromStep === undefined ? {} : { selectFromStep }),
    };
  }

  const mainplate = byName(ref.frames, "Mainplate");
  const trainBridge = byName(ref.frames, "Train bridge");
  const balanceCock = byName(ref.frames, "Balance cock");

  const barrel = byName(ref.shafts, "Barrel");
  const centre = byName(ref.shafts, "Centre arbor");
  const third = byName(ref.shafts, "Third arbor");
  const fourth = byName(ref.shafts, "Fourth arbor");
  const escape = byName(ref.shafts, "Escape arbor");
  const cannon = byName(ref.shafts, "Cannon pinion");
  const minuteWheelShaft = byName(ref.shafts, "Minute wheel");
  const hourWheelShaft = byName(ref.shafts, "Hour wheel");
  const barrelArbor = byName(ref.shafts, "Barrel arbor");
  const palletArbor = byName(ref.shafts, "Pallet arbor");
  const balanceStaff = byName(ref.shafts, "Balance staff");
  const crownWheelArbor = byName(ref.shafts, "Crown wheel");
  const settingWheelArbor = byName(ref.shafts, "Setting wheel");

  const barrelDrum = byName(ref.gears, "Barrel drum");
  const centrePinion = byName(ref.gears, "Centre pinion");
  const centreWheel = byName(ref.gears, "Centre wheel");
  const thirdPinion = byName(ref.gears, "Third pinion");
  const thirdWheel = byName(ref.gears, "Third wheel");
  const fourthPinion = byName(ref.gears, "Fourth pinion");
  const fourthWheel = byName(ref.gears, "Fourth wheel");
  const escapePinion = byName(ref.gears, "Escape pinion");
  const cannonPinionGear = Object.values(ref.gears).find((g) => g.name === "Cannon pinion" && g.shaftId === cannon.id);
  if (cannonPinionGear === undefined) throw new Error("teaching movement reference: no cannon pinion gear");
  const minuteWheelGear = Object.values(ref.gears).find((g) => g.name === "Minute wheel" && g.toothCount === 30);
  if (minuteWheelGear === undefined) throw new Error("teaching movement reference: no minute wheel gear");
  const minutePinion = byName(ref.gears, "Minute pinion");
  const hourWheelGear = Object.values(ref.gears).find((g) => g.name === "Hour wheel" && g.shaftId === hourWheelShaft.id);
  if (hourWheelGear === undefined) throw new Error("teaching movement reference: no hour wheel gear");
  const ratchetWheel = byName(ref.gears, "Ratchet wheel");
  const crownWheelGear = Object.values(ref.gears).find((g) => g.name === "Crown wheel" && g.shaftId === crownWheelArbor.id);
  if (crownWheelGear === undefined) throw new Error("teaching movement reference: no crown wheel gear");
  const settingWheelGear = Object.values(ref.gears).find((g) => g.name === "Setting wheel" && g.shaftId === settingWheelArbor.id);
  if (settingWheelGear === undefined) throw new Error("teaching movement reference: no setting wheel gear");

  const moonPinionGear = byName(ref.gears, "Moon pinion");
  const moonReductionArbor = byName(ref.shafts, "Moon reduction arbor");
  const moonWheel1 = byName(ref.gears, "Moon wheel 1");
  const moonPinion2 = byName(ref.gears, "Moon pinion 2");
  const moonDiscArbor = byName(ref.shafts, "Moon disc arbor");
  const moonWheel2 = byName(ref.gears, "Moon wheel 2");

  const twentyFourHourPinionGear = byName(ref.gears, "24-hour pinion");
  const twentyFourHourArbor = byName(ref.shafts, "24-hour arbor");
  const twentyFourHourWheel = byName(ref.gears, "24-hour wheel");
  const dateStarArbor = byName(ref.shafts, "Date star");
  const monthStarArbor = byName(ref.shafts, "Month star");
  const leapYearWheelArbor = byName(ref.shafts, "Leap-year wheel");

  const mainspring = couplingOfKind(ref.couplings, "MAINSPRING");
  const keylessWorks = only(ref.keylessWorks);
  const dial = only(ref.dials);
  const escapement = only(ref.escapements);
  const moonPhase = only(ref.moonPhases);
  const dateComplication = only(ref.dateComplications);
  const monthComplication = only(ref.monthComplications);
  const leapYearComplication = only(ref.leapYearComplications);

  return [
    {
      id: "start-empty",
      title: "Start from nothing",
      instructions:
        "Every design starts as data, not a template. Open the “New…” menu in the toolbar and choose “Empty movement”.",
      targetSelector: '[data-testid="new-design"]',
      isComplete: (m) => Object.keys(m.frames).length === 0 && Object.keys(m.shafts).length === 0,
    },

    frameStep("add-mainplate", "Add the mainplate", mainplate),
    frameStep("add-train-bridge", "Add the train bridge", trainBridge),

    arborStep("add-barrel", "Add the barrel", "Click “+ Arbor”. Its position comes from the real design.", barrel, solvedFixed(barrel)),
    gearStep("add-barrel-drum", "Give the barrel its drum", "Click “Add gear” for the barrel drum: 72 teeth, 0.12 mm module.", barrelDrum),
    arborStep("add-centre-arbor", "Add the centre arbor", "Click “+ Arbor” for the centre arbor.", centre, solvedFixed(centre)),
    gearStep("add-centre-pinion", "Give it a pinion", "Click “Add gear” for the centre pinion: 12 teeth.", centrePinion),
    meshStep("mesh-barrel-centre", "Mesh the barrel drum with the centre pinion", barrelDrum, centrePinion, "add-barrel-drum"),
    gearStep("add-centre-wheel", "Add the centre wheel", "Back on the centre arbor, click “Add gear” again for the centre wheel: 80 teeth.", centreWheel, "add-centre-arbor"),

    arborStep("add-third-arbor", "Add the third arbor", "Click “+ Arbor” for the third arbor.", third, solvedFixed(third)),
    gearStep("add-third-pinion", "Give it a pinion", "Click “Add gear” for the third pinion: 10 teeth.", thirdPinion),
    meshStep("mesh-centre-third", "Mesh the centre wheel with the third pinion", centreWheel, thirdPinion, "add-centre-wheel"),
    gearStep("add-third-wheel", "Add the third wheel", "Back on the third arbor, click “Add gear” again: 75 teeth.", thirdWheel, "add-third-arbor"),

    arborStep("add-fourth-arbor", "Add the fourth arbor", "Click “+ Arbor” for the fourth arbor — it carries the seconds hand.", fourth, solvedFixed(fourth)),
    gearStep("add-fourth-pinion", "Give it a pinion", "Click “Add gear” for the fourth pinion: 10 teeth.", fourthPinion),
    meshStep("mesh-third-fourth", "Mesh the third wheel with the fourth pinion", thirdWheel, fourthPinion, "add-third-wheel"),
    gearStep("add-fourth-wheel", "Add the fourth wheel", "Back on the fourth arbor, click “Add gear” again: 80 teeth.", fourthWheel, "add-fourth-arbor"),

    arborStep("add-escape-arbor", "Add the escape arbor", "Click “+ Arbor” for the escape arbor.", escape, solvedFixed(escape)),
    gearStep("add-escape-pinion", "Give it a pinion", "Click “Add gear” for the escape pinion: 8 teeth.", escapePinion),
    meshStep("mesh-fourth-escape", "Mesh the fourth wheel with the escape pinion", fourthWheel, escapePinion, "add-fourth-wheel"),

    arborStep(
      "add-cannon-arbor",
      "Add the cannon pinion's arbor",
      "The going train ends at the escape pinion. Now the motion works (hands): click “+ Arbor” for the cannon pinion arbor — it rides on the centre arbor's axis and carries the minutes hand.",
      cannon,
      cannon.placement,
    ),
    gearStep("add-cannon-gear", "Give it a gear", "Click “Add gear” for the cannon pinion's own gear: 10 teeth.", cannonPinionGear),
    arborStep("add-minute-wheel-arbor", "Add the minute wheel's arbor", "Click “+ Arbor” for the minute wheel (on a stud in the mainplate).", minuteWheelShaft, solvedFixed(minuteWheelShaft)),
    gearStep("add-minute-wheel-gear", "Add its 30-tooth gear", "Click “Add gear”: 30 teeth.", minuteWheelGear),
    meshStep("mesh-cannon-minute", "Mesh the cannon pinion with the minute wheel", cannonPinionGear, minuteWheelGear, "add-cannon-gear"),
    gearStep("add-minute-pinion", "Add its 8-tooth pinion", "Back on the minute wheel arbor, click “Add gear” again: 8 teeth.", minutePinion, "add-minute-wheel-arbor"),
    arborStep("add-hour-wheel-arbor", "Add the hour wheel's arbor", "Click “+ Arbor” for the hour wheel — also coaxial with the centre arbor.", hourWheelShaft, hourWheelShaft.placement),
    gearStep("add-hour-wheel-gear", "Give it a gear", "Click “Add gear”: 32 teeth.", hourWheelGear),
    meshStep("mesh-minute-hour", "Mesh the minute pinion with the hour wheel", minutePinion, hourWheelGear, "add-minute-pinion"),

    arborStep(
      "add-barrel-arbor",
      "Add the barrel arbor",
      "Now the keyless works. Click “+ Arbor” for the barrel arbor — coaxial with the barrel, and joined to it by a mainspring later.",
      barrelArbor,
      barrelArbor.placement,
    ),
    gearStep("add-ratchet-wheel", "Add the ratchet wheel", "Click “Add gear” for the ratchet wheel: 40 teeth.", ratchetWheel),
    arborStep("add-crown-wheel-arbor", "Add the crown wheel's arbor", "Click “+ Arbor” for the crown wheel (on the stem line, above it).", crownWheelArbor, solvedFixed(crownWheelArbor)),
    gearStep("add-crown-wheel", "Give it a gear", "Click “Add gear” for the crown wheel: 20 teeth.", crownWheelGear),
    meshStep("mesh-crown-ratchet", "Mesh the crown wheel with the ratchet wheel", crownWheelGear, ratchetWheel),
    arborStep("add-setting-wheel-arbor", "Add the setting wheel's arbor", "Click “+ Arbor” for the setting wheel (on the stem line, below it).", settingWheelArbor, solvedFixed(settingWheelArbor)),
    gearStep("add-setting-wheel", "Give it a gear", "Click “Add gear” for the setting wheel: 16 teeth.", settingWheelGear),
    meshStep("mesh-setting-minute", "Mesh the setting wheel with the minute wheel", settingWheelGear, minuteWheelGear),

    arborStep("add-pallet-arbor", "Add the pallet arbor", "The escapement's arbors, without the escapement itself yet. Click “+ Arbor” for the pallet arbor.", palletArbor, palletArbor.placement),
    arborStep("add-balance-staff", "Add the balance staff", "Click “+ Arbor” for the balance staff.", balanceStaff, balanceStaff.placement),

    {
      id: "add-balance-cock",
      title: "Add the balance cock",
      instructions: "The pallet arbor and balance staff need a bridge of their own, beyond the train bridge. Click “+ Bridge” again for the balance cock.",
      targetSelector: '[data-tutorial="add-bridge"]',
      isComplete: (m) => m.frames[balanceCock.id] !== undefined,
      createOverride: (m) => ({ movement: addFrame(m, balanceCock), id: balanceCock.id }),
    },

    {
      id: "add-bearings",
      title: "Add bearings",
      instructions:
        "Every one of the seven pivoted arbors (barrel, centre, third, fourth, escape, pallet arbor, balance staff) needs a lower and an upper bearing. Select each in turn and use “Add in frame…”: lower in the Mainplate, upper in the Train bridge — except the pallet arbor and balance staff, whose upper bearing goes in the Balance cock. Bore diameters stay empty here, same as the real design (they were never measured for it either).",
      targetSelector: null,
      isComplete: (m) => {
        const pivoted = [barrel, centre, third, fourth, escape, palletArbor, balanceStaff];
        return pivoted.every((s) => {
          const support = shaftSupport(m, s.id);
          return support.lower !== null && support.upper !== null;
        });
      },
    },

    {
      id: "add-clutch",
      title: "Add the cannon pinion's friction clutch",
      instructions:
        "The cannon pinion needs to slip against the centre arbor while the hands are set. Select the cannon pinion arbor, then use “Add clutch to” — the centre arbor is the only coaxial candidate.",
      targetSelector: '[data-field="Add clutch to"]',
      selectFromStep: "add-cannon-arbor",
      isComplete: (m) =>
        Object.values(m.couplings).some(
          (c) => c.kind === "FRICTION_CLUTCH" && ((c.shaftAId === cannon.id && c.shaftBId === centre.id) || (c.shaftAId === centre.id && c.shaftBId === cannon.id)),
        ),
    },

    {
      id: "add-mainspring",
      title: "Add the mainspring",
      instructions:
        "Select the barrel arbor, then use “This arbor winds” to declare the mainspring to the barrel — with its real data (6.5 usable turns, 10 → 6 N·mm) filled in.",
      targetSelector: '[data-field="This arbor winds"]',
      selectFromStep: "add-barrel-arbor",
      isComplete: (m) => m.couplings[mainspring.id] !== undefined,
      createOverride: (m) => ({ movement: { ...m, couplings: { ...m.couplings, [mainspring.id]: mainspring } }, id: mainspring.id }),
    },

    {
      id: "add-keyless-works",
      title: "Add the keyless works",
      instructions:
        "Click “+ Keyless works” — the stem direction, height, winding and sliding pinions, and which gears they engage all come preloaded from the real design.",
      targetSelector: '[data-tutorial="add-keyless-works"]',
      isComplete: (m) => m.keylessWorks[keylessWorks.id] !== undefined,
      createOverride: (m) => ({ movement: addKeylessWorks(m, keylessWorks), id: keylessWorks.id }),
    },
    {
      id: "add-dial",
      title: "Add the dial",
      instructions: "Click “+ Dial” — centred on the centre arbor, with its real diameter and face height.",
      targetSelector: '[data-tutorial="add-dial"]',
      isComplete: (m) => m.dials[dial.id] !== undefined,
      createOverride: (m) => ({ movement: addDial(m, dial), id: dial.id }),
    },
    {
      id: "add-escapement",
      title: "Add the escapement",
      instructions:
        "Click “+ Escapement” — the escape wheel, pallet geometry and balance (inertia, hairspring stiffness, amplitude) all come from the real design, referencing the escape arbor, pallet arbor and balance staff already on the movement.",
      targetSelector: '[data-tutorial="add-escapement"]',
      isComplete: (m) => m.escapements[escapement.id] !== undefined,
      createOverride: (m) => ({ movement: addEscapement(m, escapement), id: escapement.id }),
    },

    gearStep("add-moon-pinion", "Add the moonphase drive pinion", "Back on the hour wheel arbor, click “Add gear” again: an 8-tooth pinion that drives the moonphase reduction.", moonPinionGear, "add-hour-wheel-arbor"),
    arborStep("add-moon-reduction-arbor", "Add the moonphase reduction arbor", "Click “+ Arbor” for a new arbor, 6 o'clock from the hour wheel.", moonReductionArbor, solvedFixed(moonReductionArbor)),
    gearStep("add-moon-wheel-1", "Give it an 87-tooth wheel", "Click “Add gear”: 87 teeth.", moonWheel1),
    meshStep("mesh-hour-moon1", "Mesh the moonphase pinion with the first reduction wheel", moonPinionGear, moonWheel1, "add-moon-pinion"),
    gearStep("add-moon-pinion-2", "Add its own 8-tooth pinion", "Back on the reduction arbor, click “Add gear” again: an 8-tooth pinion carrying the drive onward.", moonPinion2, "add-moon-reduction-arbor"),
    arborStep("add-moon-disc-arbor", "Add the moonphase disc's arbor", "Click “+ Arbor” — this one carries the disc itself.", moonDiscArbor, solvedFixed(moonDiscArbor)),
    gearStep("add-moon-wheel-2", "Give it the final 87-tooth wheel", "Click “Add gear”: 87 teeth. Two 8:87 stages give about 1/118 of the hour wheel's own speed (ASM-0047).", moonWheel2),
    meshStep("mesh-moon1-moon2", "Mesh the second pinion with the final wheel", moonPinion2, moonWheel2, "add-moon-pinion-2"),
    {
      id: "add-moon-phase",
      title: "Add the moonphase disc",
      instructions:
        "Click “+ Moon phase” — diameter, thickness, face height and the double moon-image layout all come from the real design, mounted on the arbor you just built. No jumper/cam mechanism: it turns continuously with the gear train (ASM-0047).",
      targetSelector: '[data-tutorial="add-moon-phase"]',
      isComplete: (m) => m.moonPhases[moonPhase.id] !== undefined,
      createOverride: (m) => ({ movement: addMoonPhase(m, moonPhase), id: moonPhase.id }),
    },

    gearStep("add-twenty-four-hour-pinion", "Add the date mechanism's drive pinion", "Back on the hour wheel arbor once more, click “Add gear”: an 8-tooth pinion — the “24-hour wheel” SRC-0042 describes.", twentyFourHourPinionGear, "add-hour-wheel-arbor"),
    arborStep("add-twenty-four-hour-arbor", "Add the 24-hour arbor", "Click “+ Arbor” for a new arbor, 9 o'clock from the hour wheel.", twentyFourHourArbor, solvedFixed(twentyFourHourArbor)),
    gearStep("add-twenty-four-hour-wheel", "Give it a 16-tooth wheel", "Click “Add gear”: 16 teeth — 2:1 off the hour wheel, so this arbor turns once every 24 hours (SRC-0042).", twentyFourHourWheel),
    meshStep("mesh-hour-twenty-four-hour", "Mesh the drive pinion with the 24-hour wheel", twentyFourHourPinionGear, twentyFourHourWheel, "add-twenty-four-hour-pinion"),
    arborStep("add-date-star-arbor", "Add the date star's own arbor", "Click “+ Arbor” — its position is declared, not derived: the star is not meshed with anything (ASM-0048).", dateStarArbor, solvedFixed(dateStarArbor)),
    {
      id: "add-date",
      title: "Add the date complication",
      instructions:
        "Click “+ Date” — the drive and star arbors, star tooth count (31) and dimensions all come from the real design. This is the genuinely new part: the star advances by one step per 24-hour-wheel revolution, never continuously and never backward (ASM-0048).",
      targetSelector: '[data-tutorial="add-date"]',
      isComplete: (m) => m.dateComplications[dateComplication.id] !== undefined,
      createOverride: (m) => ({ movement: addDateComplication(m, dateComplication), id: dateComplication.id }),
    },

    arborStep("add-month-star-arbor", "Add the month star's own arbor", "Click “+ Arbor” — like the date star, its position is declared, not derived: it is not meshed with anything either (ASM-0049).", monthStarArbor, solvedFixed(monthStarArbor)),
    {
      id: "add-month",
      title: "Add the month complication",
      instructions:
        "Click “+ Month” — the referenced date complication, star arbor and dimensions all come from the real design. Unlike every part so far, this one has no drive train of its own: it is turned entirely by the date complication's own jumps, enlarged just enough at each month's end to skip the days the current month does not have (ASM-0049).",
      targetSelector: '[data-tutorial="add-month"]',
      isComplete: (m) => m.monthComplications[monthComplication.id] !== undefined,
      createOverride: (m) => ({ movement: addMonthComplication(m, monthComplication), id: monthComplication.id }),
    },

    arborStep("add-leap-year-wheel-arbor", "Add the leap-year wheel's own arbor", "Click “+ Arbor” — like the date and month stars, its position is declared, not derived: it is not meshed with anything either (ASM-0050).", leapYearWheelArbor, solvedFixed(leapYearWheelArbor)),
    {
      id: "add-leap-year",
      title: "Add the leap-year complication",
      instructions:
        "Click “+ Leap year” — the referenced month complication, wheel arbor and dimensions all come from the real design. Like the month complication, this one has no drive train of its own: it advances by one Geneva-mechanism index step each time the month star wraps from December back to January (ASM-0050).",
      targetSelector: '[data-tutorial="add-leap-year"]',
      isComplete: (m) => m.leapYearComplications[leapYearComplication.id] !== undefined,
      createOverride: (m) => ({ movement: addLeapYearComplication(m, leapYearComplication), id: leapYearComplication.id }),
    },

    {
      id: "set-balance-drive",
      title: "Let the balance govern the rate",
      instructions:
        "One last thing before checking validation: the inspector now shows the movement itself. Set “Drive” to “Governed by the balance”, the same as the real design.",
      targetSelector: '[data-field="Drive"]',
      deselect: true,
      isComplete: (m) => m.drive?.kind === "BALANCE",
    },

    {
      id: "check-validation",
      title: "Check validation",
      instructions:
        "Open the Validation panel. What's left — bore diameters, shoulder spans, the balance's Q, escapement efficiency — is exactly what the real teaching movement also leaves unknown; nothing here was silently filled in. That's the whole loop: add a part, fill it in (or preload it), check what's still open.",
      targetSelector: null,
      isComplete: null,
    },
  ];
}

/**
 * Covers the whole teaching movement: going train, motion works, keyless
 * works, mainspring, dial, escapement, moonphase disc and the date
 * complication — everything createTeachingMovement() builds. Extending it
 * further (a second design, or a from-scratch design
 * with genuinely invented — i.e. user-declared-as-they-go — dimensions)
 * follows the same pattern.
 */
export const TUTORIAL_STEPS: TutorialStep[] = buildTeachingMovementSteps();
