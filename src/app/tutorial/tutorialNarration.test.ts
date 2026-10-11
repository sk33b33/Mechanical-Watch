import { describe, expect, it } from "vitest";
import { buildTtsRequest, pickPreferredVoiceIndex, REMOTE_VOICE_OPTIONS } from "./tutorialNarration";

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

describe("REMOTE_VOICE_OPTIONS", () => {
  it("has at least one option, each with a unique, non-empty id and label", () => {
    expect(REMOTE_VOICE_OPTIONS.length).toBeGreaterThan(0);
    const ids = REMOTE_VOICE_OPTIONS.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const voice of REMOTE_VOICE_OPTIONS) {
      expect(voice.id.length).toBeGreaterThan(0);
      expect(voice.label.length).toBeGreaterThan(0);
    }
  });
});

describe("buildTtsRequest", () => {
  it("POSTs JSON with the text and voice, authorizing with the anon key", () => {
    const { url, init } = buildTtsRequest({ url: "https://example.supabase.co/functions/v1/tts-proxy", anonKey: "anon-key-123" }, "Hello there", "en-US-GuyNeural");
    expect(url).toBe("https://example.supabase.co/functions/v1/tts-proxy");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers.Authorization).toBe("Bearer anon-key-123");
    expect(headers.apikey).toBe("anon-key-123");
    expect(JSON.parse(init.body as string)).toEqual({ text: "Hello there", voice: "en-US-GuyNeural" });
  });
});
