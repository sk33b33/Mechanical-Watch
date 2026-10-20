import { describe, expect, it } from "vitest";
import { createTeachingMovement } from "@/app/teachingMovement";
import { createSimulationState } from "./simulationState";
import { starPosition } from "@/kinematics/dateComplication";
import { radians } from "@/units/angle";
import { YEAR_DIGIT_SLOT_COUNT } from "@/domain/yearDigitComplication";
import { calendarDateOf, leapYearWheelPosition, seasonWheelPosition, withCalendarDate } from "./calendarState";

describe("leapYearWheelPosition (ASM-0070)", () => {
  it("puts a year divisible by 4 on the last, 'Year 4 (leap)' position and counts up from the one after", () => {
    expect(leapYearWheelPosition(2024)).toBe(3);
    expect(leapYearWheelPosition(2025)).toBe(0);
    expect(leapYearWheelPosition(2026)).toBe(1);
    expect(leapYearWheelPosition(2027)).toBe(2);
    expect(leapYearWheelPosition(2028)).toBe(3);
  });
});

describe("seasonWheelPosition (ASM-0070)", () => {
  it("advances once per calendar quarter, January-March first", () => {
    expect([0, 1, 2, 3, 5, 6, 8, 9, 11].map(seasonWheelPosition)).toEqual([0, 0, 0, 1, 1, 2, 2, 3, 3]);
  });
});

describe("calendarDateOf", () => {
  it("reads year, 0-based month and day of month from a local Date", () => {
    expect(calendarDateOf(new Date(2026, 9, 20, 15, 30))).toEqual({ year: 2026, monthIndex: 9, day: 20 });
  });
});

describe("withCalendarDate (ASM-0070)", () => {
  const movement = createTeachingMovement();
  const initial = createSimulationState(movement);
  const set = withCalendarDate(initial, movement, { year: 2026, monthIndex: 9, day: 20 });
  const only = <T>(record: Record<string, T>): T => {
    const values = Object.values(record);
    if (values.length !== 1) throw new Error("expected exactly one in the teaching movement");
    return values[0] as T;
  };

  it("sets the date star to the 20th (position 19) and the month star to October (position 9)", () => {
    const date = only(movement.dateComplications);
    const month = only(movement.monthComplications);
    expect(starPosition(set.shaftAngle[date.starShaftId] ?? radians(0), date.starToothCount)).toBe(19);
    expect(starPosition(set.shaftAngle[month.starShaftId] ?? radians(0), 12)).toBe(9);
  });

  it("sets the leap-year wheel (2026 = Year 2, position 1) and the season wheel (October-December = position 3)", () => {
    const leap = only(movement.leapYearComplications);
    const season = only(movement.seasonComplications);
    expect(starPosition(set.shaftAngle[leap.wheelShaftId] ?? radians(0), 4)).toBe(1);
    expect(starPosition(set.shaftAngle[season.wheelShaftId] ?? radians(0), 4)).toBe(3);
  });

  it("sets each declared year-digit segment to its own digit of 2026", () => {
    const digits = Object.fromEntries(
      Object.values(movement.yearDigitComplications).map((d) => [d.digitPlace, starPosition(set.yearDigitAngle[d.id] ?? radians(0), YEAR_DIGIT_SLOT_COUNT)]),
    );
    expect(digits).toEqual({ THOUSANDS: 2, HUNDREDS: 0, TENS: 2, ONES: 6 });
  });

  it("leaves every other shaft and the clock untouched, and cancels an in-flight Geneva stroke", () => {
    const leap = only(movement.leapYearComplications);
    const mid = { ...initial, genevaStrokes: { [leap.wheelShaftId]: { startAngle: radians(0), elapsedSeconds: 0.1 } } };
    const after = withCalendarDate(mid, movement, { year: 2026, monthIndex: 9, day: 20 });
    expect(after.genevaStrokes[leap.wheelShaftId]).toBeUndefined();
    expect(after.time).toBe(initial.time);
    const calendarShafts = new Set([only(movement.dateComplications).starShaftId, only(movement.monthComplications).starShaftId, leap.wheelShaftId, only(movement.seasonComplications).wheelShaftId]);
    for (const [id, angle] of Object.entries(initial.shaftAngle)) {
      if (!calendarShafts.has(id as never)) expect(after.shaftAngle[id as keyof typeof after.shaftAngle]).toBe(angle);
    }
  });

  it("skips a day the date star has no tooth for, rather than wrapping it onto another day", () => {
    const date = only(movement.dateComplications);
    const small = { ...movement, dateComplications: { [date.id]: { ...date, starToothCount: 28 } } };
    const after = withCalendarDate(initial, small, { year: 2026, monthIndex: 0, day: 31 });
    expect(after.shaftAngle[date.starShaftId]).toBe(initial.shaftAngle[date.starShaftId]);
  });
});
