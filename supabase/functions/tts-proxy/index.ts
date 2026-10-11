// Supabase Edge Function (Deno runtime) — proxies Microsoft's own "edge-tts" service.
//
// Why this exists at all: edge-tts's WebSocket requires a header
// (Sec-WebSocket-Version) that browser JavaScript is not allowed to set, so
// calling it directly from the Mechanical Watch app (a static, backend-free
// Vite build) only works in Microsoft Edge itself. Deno has no such
// restriction — it controls its own WebSocket headers — so this function
// can call the real service from any browser.
//
// Deployed to its own, separate Supabase project (see supabase/functions/
// tts-proxy/README.md): this never touches another project's database,
// auth or other functions, by construction.
//
// Supabase's default per-function JWT check (the project's own anon key,
// sent as the Authorization header) is the only access control here —
// disable it (`--no-verify-jwt`) only if you understand that makes this an
// open, unauthenticated proxy to Microsoft's service.

import { IsomorphicEdgeTTS } from "npm:edge-tts-universal@1.4.0";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_TEXT_LENGTH = 2000; // Generous for one tutorial step; guards against accidental/abusive huge requests.

interface TtsRequestBody {
  text?: unknown;
  voice?: unknown;
  rate?: unknown;
  pitch?: unknown;
  volume?: unknown;
}

function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return errorResponse("Use POST", 405);

  let body: TtsRequestBody;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Request body must be JSON", 400);
  }

  const { text, voice, rate, pitch, volume } = body;
  if (typeof text !== "string" || text.trim().length === 0) {
    return errorResponse("`text` is required and must be a non-empty string", 400);
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return errorResponse(`\`text\` must be ${String(MAX_TEXT_LENGTH)} characters or fewer`, 400);
  }
  if (voice !== undefined && typeof voice !== "string") {
    return errorResponse("`voice` must be a string when provided", 400);
  }
  for (const [name, value] of [["rate", rate], ["pitch", pitch], ["volume", volume]] as const) {
    if (value !== undefined && typeof value !== "string") {
      return errorResponse(`\`${name}\` must be a string when provided`, 400);
    }
  }

  try {
    const tts = new IsomorphicEdgeTTS(text, typeof voice === "string" ? voice : undefined, {
      ...(typeof rate === "string" ? { rate } : {}),
      ...(typeof pitch === "string" ? { pitch } : {}),
      ...(typeof volume === "string" ? { volume } : {}),
    });
    const result = await tts.synthesize();
    const audioBuffer = await result.audio.arrayBuffer();
    return new Response(audioBuffer, {
      headers: {
        ...CORS_HEADERS,
        "Content-Type": result.audio.type.length > 0 ? result.audio.type : "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    // Microsoft's own service is unofficial/unversioned from this package's point of view — a
    // failure here (timeout, protocol change, bad voice name, rate limit) is expected
    // occasionally. The client (tutorialNarration.ts) falls back to the browser's own speech
    // synthesis when this call fails, so this is reported, not retried here.
    console.error("edge-tts synthesis failed:", error);
    return errorResponse(error instanceof Error ? error.message : "Synthesis failed", 502);
  }
});
