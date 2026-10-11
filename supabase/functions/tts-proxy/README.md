# tts-proxy

A Supabase Edge Function that proxies Microsoft's "edge-tts" service, so
the Mechanical Watch tutorial can narrate with real Microsoft neural
voices (free, no API key) from any browser — not just Microsoft Edge.
See `index.ts`'s own comment for why this needs a server at all.

**This is meant to live in its own, separate Supabase project**, isolated
from any other project (a web portal, etc.) you may already run. A new
project has its own database, auth and functions — nothing here ever
reads or writes anything belonging to another project.

## Deploy

1. Create a new Supabase project at [supabase.com](https://supabase.com)
   (New Project → give it its own name, e.g. `mechanical-watch-tts`, and
   its own database password). Don't reuse an existing project.
2. Install the Supabase CLI if you don't have it:
   `npm install -g supabase`
3. From this repo's root, log in and link to the new project:
   ```
   supabase login
   supabase link --project-ref <your-new-project-ref>
   ```
   (The project ref is in the project's own URL/Settings → General.)
4. Deploy just this function:
   ```
   supabase functions deploy tts-proxy
   ```
5. In the new project's dashboard → Settings → API, copy the **Project
   URL** and the **anon public** key.
6. In this repo, copy `.env.example` to `.env.local` and fill in:
   ```
   VITE_SUPABASE_TTS_URL=https://<your-project-ref>.functions.supabase.co/tts-proxy
   VITE_SUPABASE_TTS_ANON_KEY=<the anon public key>
   ```
7. Rebuild/restart the dev server. The tutorial's narration now calls
   this function first, with the browser's own built-in speech synthesis
   as an automatic fallback if the call fails or these env vars are
   unset — the app works either way, this is purely additive.

## Notes

- **This proxies an unofficial API.** `edge-tts`/`edge-tts-universal`
  reverse-engineer Microsoft's own Edge "Read Aloud" service; Microsoft
  could change or block it without notice. If it stops working, the app
  silently falls back to the browser's own voices — nothing breaks, it
  just stops using the nicer ones.
- **Access control**: Supabase's default per-function check requires the
  project's own anon key in the `Authorization` header — the same key
  `VITE_SUPABASE_TTS_ANON_KEY` above supplies. That key is meant to be
  public/embeddable in client code (same as any Supabase browser app), so
  this is a mild deterrent against casual scraping, not a real secret.
- **Cost**: Microsoft's service itself is free. Supabase Edge Functions
  have a generous free tier (500K invocations/month as of this writing);
  a tutorial narrating a few dozen short steps per session is nowhere
  close to that.
