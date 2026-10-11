import type { KeyValueStore } from "@/persistence/autosave";

const ENABLED_STORAGE_KEY = "mw3d.tutorialNarration";
const VOICE_STORAGE_KEY = "mw3d.tutorialNarrationVoice";

export interface VoiceInfo {
  readonly name: string;
  readonly lang: string;
}

/**
 * Picks the best available *browser* voice for narrating tutorial text —
 * the fallback path, used when the Supabase edge-tts proxy
 * (`REMOTE_VOICE_OPTIONS` below) is not configured or a request to it
 * fails: an English voice whose own name advertises a higher-quality
 * synthesis engine ("Natural"/"Neural", the naming Windows/Edge use for
 * their own online voices) over a plain English voice over any other
 * language, falling back to whatever the platform offers first. Pure and
 * DOM-free so it can be unit tested directly — `SpeechSynthesisVoice`
 * itself only exists with a real `window.speechSynthesis` (untested here,
 * confirmed live instead, the same already-accepted limitation this
 * project's canvas-texture code has).
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

export interface RemoteVoiceOption {
  /** The exact Microsoft edge-tts voice name (e.g. passed straight through to the proxy). */
  readonly id: string;
  readonly label: string;
}

/**
 * A small, curated subset of Microsoft's own named Edge/Azure neural
 * voices (real, standard voice names Microsoft's service recognises
 * directly — not a custom or cloned voice; see
 * `supabase/functions/tts-proxy/README.md` for why a custom/cloned voice
 * needs a different, paid service instead). Curated rather than the full
 * list (Microsoft's own service offers well over 100) to keep the picker
 * usable; every one of these is a widely documented, stable voice name.
 */
export const REMOTE_VOICE_OPTIONS: readonly RemoteVoiceOption[] = [
  { id: "en-US-GuyNeural", label: "Guy — US male" },
  { id: "en-US-DavisNeural", label: "Davis — US male, deeper" },
  { id: "en-US-AriaNeural", label: "Aria — US female" },
  { id: "en-GB-RyanNeural", label: "Ryan — British male" },
  { id: "en-GB-SoniaNeural", label: "Sonia — British female" },
  { id: "en-AU-WilliamNeural", label: "William — Australian male" },
];

const DEFAULT_REMOTE_VOICE_ID = REMOTE_VOICE_OPTIONS[0]?.id ?? "en-US-GuyNeural";

/** Reads the two Vite env vars that configure the Supabase edge-tts proxy; both must be set. */
function remoteConfig(): { url: string; anonKey: string } | null {
  const url = import.meta.env.VITE_SUPABASE_TTS_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_TTS_ANON_KEY;
  if (url === undefined || url.length === 0 || anonKey === undefined || anonKey.length === 0) return null;
  return { url, anonKey };
}

/** The exact fetch request for one synthesis call — split out so it is unit-testable without performing real network IO. */
export function buildTtsRequest(config: { url: string; anonKey: string }, text: string, voiceId: string): { url: string; init: RequestInit } {
  return {
    url: config.url,
    init: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.anonKey}`,
        apikey: config.anonKey,
      },
      body: JSON.stringify({ text, voice: voiceId }),
    },
  };
}

export interface TutorialNarrator {
  /** False if this browser has no speech synthesis at all — the fallback path is then always a no-op too. */
  readonly supported: boolean;
  /** True once both `VITE_SUPABASE_TTS_URL` and `VITE_SUPABASE_TTS_ANON_KEY` are set. */
  readonly remoteConfigured: boolean;
  isEnabled(): boolean;
  setEnabled(enabled: boolean): void;
  getVoiceId(): string;
  setVoiceId(voiceId: string): void;
  /** Speaks `text`, replacing anything already being spoken. A no-op when disabled, or when neither the remote proxy nor local synthesis is available. */
  speak(text: string): void;
  stop(): void;
}

function readStoredEnabled(storage: KeyValueStore | null): boolean {
  if (storage === null) return true;
  try {
    return storage.getItem(ENABLED_STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
}

function writeStoredEnabled(storage: KeyValueStore | null, enabled: boolean): void {
  if (storage === null) return;
  try {
    storage.setItem(ENABLED_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // Storage unavailable (private mode, quota, ...) — the preference just doesn't persist.
  }
}

function readStoredVoiceId(storage: KeyValueStore | null): string {
  if (storage === null) return DEFAULT_REMOTE_VOICE_ID;
  try {
    const stored = storage.getItem(VOICE_STORAGE_KEY);
    return stored !== null && REMOTE_VOICE_OPTIONS.some((v) => v.id === stored) ? stored : DEFAULT_REMOTE_VOICE_ID;
  } catch {
    return DEFAULT_REMOTE_VOICE_ID;
  }
}

function writeStoredVoiceId(storage: KeyValueStore | null, voiceId: string): void {
  if (storage === null) return;
  try {
    storage.setItem(VOICE_STORAGE_KEY, voiceId);
  } catch {
    // Storage unavailable — the preference just doesn't persist.
  }
}

/**
 * Narrates each tutorial step aloud. Prefers the Supabase edge-tts proxy
 * (real Microsoft neural voices, picked from `REMOTE_VOICE_OPTIONS`) when
 * configured, falling back automatically to the browser's own built-in
 * `speechSynthesis` — on every request, not just once — whenever the
 * proxy is unconfigured, the request fails, or it times out (it proxies
 * an unofficial, unversioned API — see the proxy's own README). Either
 * way this needs no new backend baked into the app itself: the proxy is
 * an optional, separately-deployed add-on (env-var configured), not a
 * dependency the app requires to run.
 */
export function createTutorialNarrator(storage: KeyValueStore | null): TutorialNarrator {
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const remote = remoteConfig();
  let enabled = readStoredEnabled(storage);
  let voiceId = readStoredVoiceId(storage);
  let cachedVoices: SpeechSynthesisVoice[] = [];
  let requestToken = 0;
  let audioEl: HTMLAudioElement | null = null;

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

  function speakLocally(text: string): void {
    if (!supported) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const index = pickPreferredVoiceIndex(cachedVoices.map((v) => ({ name: v.name, lang: v.lang })));
    const voice = index === null ? undefined : cachedVoices[index];
    if (voice !== undefined) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  }

  function stopAudioElement(): void {
    if (audioEl === null) return;
    audioEl.pause();
    if (audioEl.src.startsWith("blob:")) URL.revokeObjectURL(audioEl.src);
    audioEl = null;
  }

  async function speakRemotely(text: string, token: number): Promise<void> {
    if (remote === null) {
      speakLocally(text);
      return;
    }
    try {
      const { url, init } = buildTtsRequest(remote, text, voiceId);
      const controller = new AbortController();
      const timeout = setTimeout(() => { controller.abort(); }, 8000);
      const response = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timeout);
      if (token !== requestToken) return; // A newer speak() call has already superseded this one.
      if (!response.ok) throw new Error(`tts-proxy responded ${String(response.status)}`);
      const blob = await response.blob();
      if (token !== requestToken) return;
      stopAudioElement();
      const audio = new Audio(URL.createObjectURL(blob));
      audioEl = audio;
      await audio.play();
    } catch (error) {
      if (token !== requestToken) return;
      console.warn("edge-tts proxy unavailable, falling back to the browser's own voices:", error);
      speakLocally(text);
    }
  }

  return {
    supported,
    remoteConfigured: remote !== null,
    isEnabled: () => enabled,
    setEnabled(next: boolean): void {
      enabled = next;
      writeStoredEnabled(storage, next);
      if (!next) this.stop();
    },
    getVoiceId: () => voiceId,
    setVoiceId(next: string): void {
      voiceId = next;
      writeStoredVoiceId(storage, next);
    },
    speak(text: string): void {
      if (!enabled || (!supported && remote === null)) return;
      requestToken += 1;
      const token = requestToken;
      if (remote !== null) {
        void speakRemotely(text, token);
      } else {
        speakLocally(text);
      }
    },
    stop(): void {
      requestToken += 1; // Invalidate any in-flight remote request so its response is ignored.
      stopAudioElement();
      if (supported) window.speechSynthesis.cancel();
    },
  };
}
