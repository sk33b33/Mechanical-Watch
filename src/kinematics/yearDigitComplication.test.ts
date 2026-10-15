import { describe, expect, it } from "vitest";
import { toDegrees } from "@/units/angle";
import type { YearDigitPlace } from "@/domain/yearDigitComplication";
import { digitsToAdvance, yearDigitStepAngle } from "./yearDigitComplication";

describe("yearDigitStepAngle", () => {
  it("is one tenth of a turn (36°)", () => {
    expect(toDegrees(yearDigitStepAngle())).toBeCloseTo(36, 9);
  });
});

describe("digitsToAdvance (decimal carry)", () => {
  const positions = (entries: readonly [YearDigitPlace, number][]): ReadonlyMap<YearDigitPlace, number> => new Map(entries);

  it("an ordinary year (ones not at 9) advances only the ones wheel", () => {
    const advancing = digitsToAdvance(positions([
      ["ONES", 3],
      ["TENS", 2],
      ["HUNDREDS", 0],
      ["THOUSANDS", 2],
    ]));
    expect(advancing).toEqual(new Set(["ONES"]));
  });

  it("ones at 9 carries into tens: both advance", () => {
    const advancing = digitsToAdvance(positions([
      ["ONES", 9],
      ["TENS", 2],
      ["HUNDREDS", 0],
      ["THOUSANDS", 2],
    ]));
    expect(advancing).toEqual(new Set(["ONES", "TENS"]));
  });

  it("ones and tens both at 9 carries all the way into hundreds", () => {
    const advancing = digitsToAdvance(positions([
      ["ONES", 9],
      ["TENS", 9],
      ["HUNDREDS", 0],
      ["THOUSANDS", 2],
    ]));
    expect(advancing).toEqual(new Set(["ONES", "TENS", "HUNDREDS"]));
  });

  it("ones, tens and hundreds all at 9 carries into thousands too (e.g. year ...999 -> ...000 with a rollover)", () => {
    const advancing = digitsToAdvance(positions([
      ["ONES", 9],
      ["TENS", 9],
      ["HUNDREDS", 9],
      ["THOUSANDS", 2],
    ]));
    expect(advancing).toEqual(new Set(["ONES", "TENS", "HUNDREDS", "THOUSANDS"]));
  });

  it("all four at 9 still only advances the four declared places (thousands wraps 9 -> 0, a declared edge case)", () => {
    const advancing = digitsToAdvance(positions([
      ["ONES", 9],
      ["TENS", 9],
      ["HUNDREDS", 9],
      ["THOUSANDS", 9],
    ]));
    expect(advancing).toEqual(new Set(["ONES", "TENS", "HUNDREDS", "THOUSANDS"]));
  });

  it("stops the carry chain at an undeclared place (a gap), rather than inventing a bridge", () => {
    // ones and hundreds declared, tens missing: carry from ones (at 9) cannot reach hundreds.
    const advancing = digitsToAdvance(positions([
      ["ONES", 9],
      ["HUNDREDS", 9],
    ]));
    expect(advancing).toEqual(new Set(["ONES"]));
  });

  it("with only ones declared, only ones ever advances, regardless of its own value", () => {
    expect(digitsToAdvance(positions([["ONES", 0]]))).toEqual(new Set(["ONES"]));
    expect(digitsToAdvance(positions([["ONES", 9]]))).toEqual(new Set(["ONES"]));
  });

  it("with no places declared, nothing advances", () => {
    expect(digitsToAdvance(new Map())).toEqual(new Set());
  });
});
