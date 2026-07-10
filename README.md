# To do
- Where can I see this data in drive
- Get working on phone - when running on clone it says autherisation blovked by google and it keeps popping up repeatedly opening loads of tabs
- Seems there may be a bug with repeated asks for auth on the web still as well

# Journal

A private, offline-first journal and notes PWA. React + TypeScript + Vite, data stored locally
in IndexedDB, optionally backed up to your own Google Drive. Installs to the home screen on iOS,
Android, and desktop, and works fully offline.

## Features

- **Calendar journal** — monthly view, today highlighted, days with entries marked and their
  title shown directly on the day cell, unlimited text, inline images, autosave, full-text
  search.
- **Notes** — separate from the calendar, unlimited notes, checklists, drag-to-reorder, autosave.
- **Privacy** — all data lives in IndexedDB on your device. Cloud backup is a single JSON file
  stored in a hidden, app-only Google Drive folder that only this app (signed in as you) can see.
- **Continuous Drive sync** — Every save (an entry autosaving, a note being created/edited/
  deleted/reordered) triggers a Drive sync in the background.
- **PWA** — installable on iOS/Android/desktop, works fully offline, dark grayscale UI optimized
  for one-handed mobile use.

## Tech stack

| Layer | Choice |
|---|---|
| UI | React 19, TypeScript, Tailwind CSS 4 |
| Build | Vite 8, `vite-plugin-pwa` |
| Local storage | IndexedDB via [Dexie.js](https://dexie.org) |
| Cloud backup | Google Drive `appDataFolder` (hidden, app-private) |
| Testing | Vitest, React Testing Library |

## Architecture

```
src/
  db/         Dexie schema + typed repositories (entries, notes, images, tombstones)
  sync/       Google OAuth, Drive REST client, backup serializer, merge/sync manager,
              fire-and-forget sync trigger, sync error pub/sub
  features/
    calendar/ Monthly grid, day cells (showing entry titles), entry-marker live query
    entry/    Per-day editor: title, body, autosave, inline images
    notes/    Persistent notes: CRUD, checklist, drag-to-reorder
    search/   Full-text search across entries
  components/ Reusable UI primitives (Button, Modal, ConfirmDialog, icons, SyncErrorBanner, ...)
  utils/      Date helpers, base64 codec, file download helper
```

Data flow is one-directional and offline-first: the UI **always** reads from and writes to
IndexedDB. Google Drive sync is a background backup/restore layer on top — it is never the
primary read path, so the app is 100% functional with no network connection.

### Sync model

Google Drive sync uses the `drive.appdata` OAuth scope — a hidden, per-app folder that is
invisible in the user's normal Drive UI and inaccessible to any other app. Sync is a simple
last-write-wins merge per record (`updatedAt` timestamp), which is appropriate for one person
using a couple of personal devices. Deletions are tracked with local tombstone records so an
older backup from another device can never resurrect something you deleted. This is **not** a
general-purpose multi-writer CRDT — if you need that, it's a natural place to extend the project
(see `src/sync/syncManager.ts`).

**There is no manual "sync now" button.** `src/sync/triggerSync.ts` is called after every
mutating action — an entry autosaving, tapping back on an entry, deleting an entry, adding/
removing a photo, and creating/editing/deleting/reordering a note — plus once on app load and
whenever the device regains a network connection (`src/sync/useBackgroundSync.ts`). Each call is
fire-and-forget so the UI never blocks on network I/O.

Because Google's OAuth popup generally needs a real user gesture behind it, the very first sync
attempt after opening the app is what triggers the Google sign-in popup — it rides along with
whatever action you were already taking (e.g. typing your first entry). There's no separate
"connect to Drive" step.

Sync failures of any kind — a missing/invalid `VITE_GOOGLE_CLIENT_ID`, a closed sign-in popup, a
network error, a Drive API error — are never swallowed. They're reported through
`src/sync/syncBus.ts` and rendered as a persistent red banner (`src/components/SyncErrorBanner.tsx`)
fixed to the top of the screen, which stays up until you dismiss it or a later sync succeeds.

Calls to `triggerSync()` are coalesced (`src/sync/triggerSync.ts`), and Drive token requests are
deduplicated (`src/sync/googleAuth.ts`'s `pendingTokenRequest`), so several actions firing in
quick succession — e.g. app load plus the first autosave — always share one in-flight sync and
one Google sign-in popup rather than each opening its own. Without that, the sign-in popup could
appear to reopen/reload repeatedly, since each concurrent sync attempt would independently try to
open its own popup.

## Getting started

### Prerequisites

- Node.js 20+
- A Google Cloud project (only needed for Drive backup — the app works fully offline without it)

### Install

```bash
npm install
cp .env.example .env
```

### Google Drive setup (optional, for cloud backup)

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and create a new project
   (or reuse one).
2. **APIs & Services → Library** — enable the **Google Drive API**.
3. **APIs & Services → OAuth consent screen** — configure it as **External**, keep it in
   **Testing** mode (fine for personal use; add your own Google account under "Test users").
   Publishing/verification is only required if you want *other* people to sign in.
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**.
   - Authorized JavaScript origins: add `http://localhost:5173` for local dev, plus your
     production URL once deployed.
5. Copy the generated **Client ID** into `.env`:
   ```
   VITE_GOOGLE_CLIENT_ID=xxxxxxxxxx.apps.googleusercontent.com
   ```
   This is an OAuth client ID, not a secret — it's safe to ship in the client bundle and is
   validated by Google against your configured origins. **No API key or client secret is
   required** for this flow.

### Run

```bash
npm run dev
```

### Test, lint, typecheck

```bash
npm test          # Vitest unit tests
npm run typecheck # tsc --noEmit
npm run lint      # ESLint
```

### Build

```bash
npm run build      # outputs to dist/, including the service worker + manifest
npm run preview    # serve the production build locally
```

### Regenerating app icons

The PWA icons are generated from the vector sources in `scripts/`:

```bash
npm run generate-icons
```

## Deployment

The app is a static site — build it and host `dist/` anywhere that serves static files over
HTTPS (required for service workers and for Google OAuth in production): Vercel, Netlify,
Cloudflare Pages, GitHub Pages, etc. HashRouter is used for routing, so no server-side rewrite
rules are needed for client-side routes on any of these.

### GitHub Pages (free, no server to manage)

`.github/workflows/deploy.yml` builds and deploys to GitHub Pages automatically on every push to
`main`. One-time setup:

1. **Settings → Pages → Source: GitHub Actions** (in your GitHub repo).
2. **Settings → Secrets and variables → Actions → New repository secret**: name it
   `VITE_GOOGLE_CLIENT_ID`, value is the same OAuth client ID from your `.env` (safe to store as
   a secret even though it isn't sensitive — it just keeps it out of the workflow file).
3. In Google Cloud Console, add `https://<your-username>.github.io` (no path, no trailing slash)
   to the OAuth client's **Authorized JavaScript origins**.
4. Push to `main`. The workflow builds with `BASE_PATH=/<repo-name>/` (GitHub Pages project sites
   are served from a subpath, e.g. `https://<your-username>.github.io/journal/`) and deploys
   `dist/` — see `vite.config.ts` for how `BASE_PATH` threads through the Vite base, the PWA
   manifest, and the service worker's precache/navigation fallback.
5. Your app is live at `https://<your-username>.github.io/<repo-name>/`. Open that URL on your
   phone's browser and follow **Installing on a device** below.

### Other hosts (Vercel, Netlify, Cloudflare Pages, ...)

1. Set the `VITE_GOOGLE_CLIENT_ID` environment variable in your host's build settings. Unless
   the host serves your site from a subpath, you don't need `BASE_PATH` — it defaults to `/`.
2. Add your production URL to the OAuth client's **Authorized JavaScript origins** in Google
   Cloud Console.
3. Deploy `dist/` (`npm run build`).

## Installing on a device

- **iOS (Safari)**: open the site → Share → **Add to Home Screen**.
- **Android (Chrome)**: open the site → menu (⋮) → **Install app** / **Add to Home screen**.
- **Desktop (Chrome/Edge)**: an install icon appears in the address bar.

Once installed, the app runs standalone (no browser chrome) and works fully offline.

## Data & privacy

This app deliberately has **no login and no passphrase** — it's built for one person (the
account owner) who doesn't want a barrier between themselves and their journal. That trade-off
only makes sense because of how the pieces fit together:

- All journal entries, notes, and images are stored locally in IndexedDB, unencrypted. Nothing
  leaves your device unless you explicitly connect Google Drive sync.
- Cloud backup is a single **plain JSON file**, not encrypted. It's written to Google Drive's
  `appDataFolder` — a hidden, per-app storage area that is invisible in the normal Drive UI and
  that only this specific OAuth client can read or write, and only when signed in as the Drive
  account owner. No other app or person can browse into it.
- Google sign-in uses the `drive.appdata` OAuth scope via Google Identity Services. The only
  credential involved is a public **OAuth client ID** (`VITE_GOOGLE_CLIENT_ID`) — not a secret.
  It's meant to ship inside the client bundle and is validated by Google against the app's
  registered origins, not by being kept hidden. There is no client secret, API key, or password
  anywhere in this app or its config.
- **Repository safety**: because there's no client secret or personal data of any kind in the
  source, this repo is safe to keep public, clone, or fork as-is. `.env` (your own client ID) is
  git-ignored; `.env.example` documents the one env var needed and explains why it's not
  sensitive. Anyone who clones the repo gets working *code*, not access to *your* data — they'd
  still need their own Google Cloud OAuth client and their own Google account to run it, and
  could never read your Drive's `appDataFolder` regardless.
- The actual boundary protecting your data is your Google account login itself, not anything in
  this codebase — if that's an acceptable trade-off for you (skipping a passphrase in exchange
  for trusting your Google account's own security), this setup requires nothing further.

## Known limitations / future extensions

- Sync is last-write-wins per record — fine for personal use across a few devices, not a
  general multi-writer conflict-free merge.
- No server-side component; Google Drive `appDataFolder` is the only supported cloud backend.
  Swapping in another backend (e.g. Supabase) means implementing an equivalent of
  `src/sync/driveClient.ts` and `src/sync/googleAuth.ts`.
- No export/import and no settings screen by design — the Drive backup *is* the backup. If you
  ever need to get data out in bulk, the entries/notes/images are plain rows in IndexedDB
  (`src/db/schema.ts`) and the `BackupData` shape (`src/sync/backupSerializer.ts`) is a
  straightforward JSON document — reintroducing an export feature later is a small, isolated
  addition, not a redesign.
- No automated end-to-end browser test suite yet (unit/integration tests cover the data and
  sync-merge logic — see `npm test`).

## License

Add a license of your choice (e.g. MIT) before making this repository public.
