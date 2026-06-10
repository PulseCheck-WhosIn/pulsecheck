# PulseCheck

**Who's In. Who's Drifting. Who Needs You.**

Member retention intelligence for boutique fitness gyms.

## Setup

1. Open `config.js` and paste your Supabase anon key:
```js
window.PULSECHECK_CONFIG = {
  SUPABASE_URL:  "https://vqhlstrvkrujahhinpbu.supabase.co",
  SUPABASE_ANON: "your-anon-key-here",  // ← paste here
  GYM_ID:        "a0000000-0000-0000-0000-000000000001",
  GYM_NAME:      "Fitstop Sippy Downs",
};
```

2. Push to GitHub → Cloudflare Pages auto-deploys.

## Files

- `index.html` — entry point, loads React + Babel from CDN
- `config.js` — Supabase credentials (keep private / use env vars in prod)
- `app.jsx` — main dashboard (members, today's actions, suspensions, departures)
- `auth.jsx` — login, signup, invite system

## Deployment

Connect this GitHub repo to Cloudflare Pages:
- Build command: (none — static files)
- Output directory: `/` (root)
- Environment variable: Add `SUPABASE_ANON_KEY` for production

## Login

- Owner: `sippydowns@fitstop.com`
- Invite coaches via Settings → Users

## Tech

- React 18 (CDN, no build step)
- Supabase (auth + database)
- Cloudflare Pages (hosting)
