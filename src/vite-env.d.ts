/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase Edge Function URL proxying edge-tts (supabase/functions/tts-proxy). Optional — narration falls back to the browser's own speech synthesis when unset. */
  readonly VITE_SUPABASE_TTS_URL?: string;
  /** The same Supabase project's anon public key, sent as the function's required Authorization header. */
  readonly VITE_SUPABASE_TTS_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
