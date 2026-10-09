import type { KeyValueStore } from "@/persistence/autosave";

const STORAGE_KEY = "mw3d.tutorialNarration";

export interface VoiceInfo {
  readonly name: string;
  readonly lang: string;
}

/**
 * Picks the best available voice for narrating tutorial text: an English
 * voice whose own name advertises a higher-quality synthesis engine
 * ("Natural"/"Neural", the naming Windows/Edge use for their own online
 * voices) over a plain English voice over any other language, falling back
 * to whatever the platform offers first. Pure and DOM-free so it can be
 * unit tested directly — `SpeechSynthesisVoice` itself only exists with a
 * real `window.speechSynthesis` (untested here, confirmed live instead,
 * the same already-accepted limitation this project's canvas-texture code
 * has).
 */
export function pickPreferredVoiceIndex(voices: readonly VoiceInfo[]): number | null {
  if (voices.length === 0) return null;
  const isEnglish = (v: VoiceInfo): boolean => v.lang.toLowerCase().startsWith("en");
  const isHighQuality = (v: VoiceInfo): boolean => /natural|neural/i.test(v.name);
  const englishHighQuality = voices.findIndex((v) => isEnglish(v) && isHighQuality(v));
  if (englishHighQuality !== -1) return englishHighQuality;
  const english = voices.findIndex(isEnglish);
  if (english !== -1) return english;
  return 0;
}

export interface TutorialNarrator {
  /** False if this browser has no speech synthesis at all (narration is then always a no-op). */
  readonly supported: boolean;
  isEnabled(): boolean;
  setEnabled(enabled: boolean): void;
  /** Speaks `text`, replacing anything already being spoken. A no-op when unsupported or disabled. */
  speak(text: string): void;
  stop(): void;
}

function readStoredEnabled(storage: KeyValueStore | null): boolean {
  if (storage === null) return true;
  try {
    return storage.getItem(STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
}

function writeStoredEnabled(storage: KeyValueStore | null, enabled: boolean): void {
  if (storage === null) return;
  try {
    storage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // Storage unavailable (private mode, quota, ...) — the preference just doesn't persist.
  }
}

/**
 * Wraps the browser's own built-in speech synthesis (`window.speechSynthesis`)
 * for the tutorial's step-by-step narration. Deliberately not Microsoft's
 * edge-tts service: that requires a WebSocket header browsers cannot set
 * themselves, so it only works called from within Edge itself, and reaching
 * it from any other browser needs a server this project does not have.
 * `SpeechSynthesis` is built into every modern browser, needs no network
 * call and no new infrastructure, and on Windows/Edge already exposes the
 * same high-quality online voices `pickPreferredVoiceIndex` prefers.
 * Defaults to enabled (starting the tutorial is itself an explicit user
 * action); persists the user's own mute choice in `storage`, the same
 * `KeyValueStore` autosave already uses.
 */
export function createTutorialNarrator(storage: KeyValueStore | null): TutorialNarrator {
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  let enabled = readStoredEnabled(storage);
  let cachedVoices: SpeechSynthesisVoice[] = [];

  function refreshVoices(): void {
    if (!supported) return;
    cachedVoices = window.speechSynthesis.getVoices();
  }

  if (supported) {
    refreshVoices();
    // Voice lists load asynchronously in some browsers; this just refreshes the cache for the
    // *next* speak() call, not the current one (a sensible first utterance still plays either way).
    window.speechSynthesis.addEventListener("voiceschanged", refreshVoices);
  }

  return {
    supported,
    isEnabled: () => enabled,
    setEnabled(next: boolean): void {
      enabled = next;
      writeStoredEnabled(storage, next);
      if (!next && supported) window.speechSynthesis.cancel();
    },
    speak(text: string): void {
      if (!supported || !enabled) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const index = pickPreferredVoiceIndex(cachedVoices.map((v) => ({ name: v.name, lang: v.lang })));
      const voice = index === null ? undefined : cachedVoices[index];
      if (voice !== undefined) utterance.voice = voice;
      window.speechSynthesis.speak(utterance);
    },
    stop(): void {
      if (supported) window.speechSynthesis.cancel();
    },
  };
}
