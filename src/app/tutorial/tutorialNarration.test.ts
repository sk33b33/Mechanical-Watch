import { describe, expect, it } from "vitest";
import { pickPreferredVoiceIndex } from "./tutorialNarration";

describe("pickPreferredVoiceIndex", () => {
  it("returns null for an empty voice list", () => {
    expect(pickPreferredVoiceIndex([])).toBeNull();
  });

  it("prefers an English voice whose name advertises Natural/Neural synthesis", () => {
    const voices = [
      { name: "Microsoft David - English (United States)", lang: "en-US" },
      { name: "Microsoft Zira - German (Germany)", lang: "de-DE" },
      { name: "Microsoft AriaNeural - English (United States)", lang: "en-US" },
    ];
    expect(pickPreferredVoiceIndex(voices)).toBe(2);
  });

  it("is case-insensitive about 'Natural'/'Neural' in the voice name", () => {
    const voices = [
      { name: "Plain English voice", lang: "en-GB" },
      { name: "Some NATURAL English voice", lang: "en-GB" },
    ];
    expect(pickPreferredVoiceIndex(voices)).toBe(1);
  });

  it("falls back to any English voice when no high-quality one exists", () => {
    const voices = [
      { name: "Voice Un", lang: "fr-FR" },
      { name: "Voice Deux", lang: "en-AU" },
    ];
    expect(pickPreferredVoiceIndex(voices)).toBe(1);
  });

  it("matches language by prefix, not exact string (en-GB counts as English)", () => {
    const voices = [{ name: "British voice", lang: "en-GB" }];
    expect(pickPreferredVoiceIndex(voices)).toBe(0);
  });

  it("falls back to the first voice when nothing is English", () => {
    const voices = [
      { name: "Voix française", lang: "fr-FR" },
      { name: "Deutsche Stimme", lang: "de-DE" },
    ];
    expect(pickPreferredVoiceIndex(voices)).toBe(0);
  });
});
