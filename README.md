# To do
- Remove env file

# Journal

A private, offline-first journal and notes PWA. React + TypeScript + Vite, data stored locally
in IndexedDB, optionally backed up to your own Google Drive. Installs to the home screen on iOS,
Android, and desktop, and works fully offline.

## Features

- **Calendar journal** — monthly view, today highlighted, days with entries marked and their
  title shown directly on the day cell, unlimited text, inline images, autosave, full-text
  search.
- **Notes** — separate from the calendar, unlimited notes, checklists, drag-to-reorder, autosave,
  version history (undo an accidental edit or full deletion of a note's text).
- **Privacy** — all data lives in IndexedDB on your device. Cloud backup is a single, visible
  JSON file (`journal-backup.json`) in the root of your own Google Drive — you can open it,
  download it, or inspect it any time. The app can only ever see files it created itself, never
  your other Drive files.
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
| Cloud backup | Google Drive, `drive.file` scope (visible file, app-created only) |
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

Google Drive sync uses the `drive.file` OAuth scope — the app can only see/write files it
created itself (the single `journal-backup.json` it writes to the root of your Drive), never any
of your other files. Unlike the hidden `appDataFolder` this app used earlier, that backup file is
a completely normal, visible file: find it in "My Drive", open it, download it, or move it — it's
just JSON. Sync itself is a simple last-write-wins merge per record (`updatedAt` timestamp),
which is appropriate for one person using a couple of personal devices. Deletions are tracked
with local tombstone records so an older backup from another device can never resurrect
something you deleted. This is **not** a general-purpose multi-writer CRDT — if you need that,
it's a natural place to extend the project (see `src/sync/syncManager.ts`).

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
open its own popup. There's also a 30-second cooldown on retrying a *failing* sign-in
(`AUTH_FAILURE_COOLDOWN_MS`), so a misconfigured client ID or blocked popup doesn't turn into a
retry storm as you keep typing.

**Weekly snapshots**: on top of the live backup file, `syncManager.ts`'s `maybeCreateWeeklySnapshot`
writes a separate, never-overwritten dated copy (`journal-backup-YYYY-MM-DD.json`, also a normal
visible file in your Drive root) roughly once every 7 days, keeping the most recent 12 (~3
months) and pruning older ones automatically. This exists because Drive's own revision history
for the live file isn't a reliable enough safety net on its own — a bad sync or an accidental
overwrite could still be unrecoverable if it went unnoticed past Drive's ~30-day/handful-of-
revisions retention window for API-updated files. These snapshots are entirely independent of
that: recovering from one just means opening it in Drive and comparing/restoring it manually,
since there's no in-app UI for this (deliberately — it's meant to be a rare, manual last resort,
not another feature surface).

**Offline mode**: `triggerSync()` checks `navigator.onLine` before attempting anything — while
offline, edits keep autosaving to IndexedDB exactly as normal, but no Drive request (and no
Google sign-in prompt) is attempted, and a calm banner (`src/components/OfflineBanner.tsx`, not
the red error one) says so. `useBackgroundSync`'s `online` event listener fires a catch-up sync
the moment connectivity returns, so nothing needs to be manually retried or queued.

### Note version history

Every note keeps a short local history of its own past content
(`src/db/notes.repo.ts`: `noteVersions` table), so an accidental edit — or selecting all the text
in a note and deleting it — can be undone from the note editor's history icon. A snapshot of a
note's *previous* state is taken before each write, throttled to at most once a minute per note
(so a normal editing session with autosave firing every ~600ms doesn't burn through the kept
versions before anything worth restoring happens), keeping the most recent 20 snapshots. This
history is local-only — deliberately not part of `BackupData`/Drive sync — since it's a
personal-device undo safety net, not data that needs to roam across devices.

**Re-authenticating on the same device**: `googleAuth.ts` uses a direct OAuth Authorization Code
+ PKCE flow, not Google Identity Services' token-client. The first-ever connection (via the
"Connect" button that appears in the sync banner) opens a Google consent popup and, critically,
receives a genuine **refresh token**, stored locally in IndexedDB (`db.authTokens`, never synced
to Drive). Every subsequent access token — including the hourly renewal — is minted silently from
that refresh token via a plain `fetch` to Google's token endpoint, with no popup and no iframe.
Unlike the old silent-iframe renewal, this isn't affected by browsers blocking third-party
cookies (a real problem for iOS PWAs specifically), so it works the same everywhere. The
interactive popup should only ever be needed once — or again later if you explicitly disconnect,
or revoke the app's access from your Google Account's
[Third-party access settings](https://myaccount.google.com/permissions).

This flow needs a client secret, which — unusually for a browser app — is deliberately shipped in
the client bundle (`VITE_GOOGLE_CLIENT_SECRET`), since there's no backend to hold it out of
reach. See **Data & privacy** below for why that trade-off is acceptable here.

Because opening the consent popup requires a genuine user click (browsers block popups opened
from a `setTimeout`/background callback), the very first connection is **not** automatic the way
sync itself is — the sync banner shows a "Connect" button the first time (and "Reconnect" if a
working connection later breaks), and that's the only manual step in the whole app.

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
3. **APIs & Services → OAuth consent screen**:
   - Configure it as **External**, add your own Google account under **Test users** first so you
     can try the flow before publishing.
   - **Publish the app** (button near the top of the consent screen page — moves it from
     "Testing" to "In production"). This step matters more than it looks: Google expires refresh
     tokens after 7 days for apps left in **Testing** status, which would silently bring back the
     "sign in every so often" problem this setup is meant to fix. Publishing removes that limit.
   - Because the app stays unverified (verification is only required for apps with many users),
     Google shows a one-time **"Google hasn't verified this app"** warning during sign-in — click
     **Advanced → Go to (your app name) (unsafe)** to proceed. This is expected and safe for an
     app only you use; it's a warning about scale of trust, not a sign anything is actually wrong.
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**.
   - Authorized JavaScript origins: add `http://localhost:5173` for local dev, plus your
     production URL once deployed.
   - **Authorized redirect URIs** — add the exact same origins with `oauth-callback.html`
     appended: `http://localhost:5173/oauth-callback.html` for local dev, and
     `https://<your-production-url>/oauth-callback.html` (include the repo subpath if using
     GitHub Pages, e.g. `https://<user>.github.io/journal/oauth-callback.html`). This must match
     exactly — Google rejects any mismatch, including trailing slashes.
5. Copy the generated **Client ID** and **Client secret** into `.env`:
   ```
   VITE_GOOGLE_CLIENT_ID=xxxxxxxxxx.apps.googleusercontent.com
   VITE_GOOGLE_CLIENT_SECRET=xxxxxxxxxx
   ```
   The client ID is not sensitive. The client secret normally would be — but this app embeds it
   in the client bundle anyway so it can obtain a real refresh token without a backend server to
   hold it safely. See **Data & privacy** below for why that's an acceptable trade-off here, and
   only here (a single-user app with the narrow `drive.file` scope).

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
- Cloud backup is a single **plain JSON file** (`journal-backup.json`), not encrypted, written to
  the root of your own Google Drive — a normal, visible file you can open, download, or move at
  any time. The OAuth scope (`drive.file`) means the app can only ever read or write files it
  created itself; it has no access to any other file in your Drive.
- Google sign-in uses the `drive.file` OAuth scope via a direct Authorization Code + PKCE flow
  (`src/sync/googleAuth.ts`). Unlike a typical setup, this app **does** embed an OAuth **client
  secret** (`VITE_GOOGLE_CLIENT_SECRET`) in the client bundle — normally a serious mistake, since
  anyone could extract it from the built JS. It's a deliberate, informed trade-off here, not an
  oversight:
  - The only thing the secret (plus a stolen refresh token) could ever do is read/write the one
    `journal-backup.json` file this app created — the `drive.file` scope makes the rest of your
    Drive permanently inaccessible to it, regardless of who holds the secret.
  - This app has exactly one real user (you). There's no multi-tenant blast radius — someone
    extracting the secret from the public repo still needs *your* refresh token (which never
    leaves your own device's IndexedDB) to do anything with it.
  - The alternative — a backend service to hold the secret — means paying for and maintaining a
    server for a single-user hobby app, which is a worse trade for this project than accepting the
    limited exposure above.
  - If this reasoning stops applying to you (multiple people relying on the same Drive data, or a
    scope broader than `drive.file`), don't reuse this pattern — put the secret behind a real
    backend instead (see the alternative in the auth conversation this was built from, or search
    "OAuth backend-for-frontend").
- **Repository safety**: `.env` (your client ID *and* client secret) is git-ignored;
  `.env.example` documents both variables and explains this trade-off. Anyone who clones the repo
  gets working *code*, not access to *your* data or *your* Google account — they'd need their own
  Google Cloud OAuth client (with its own secret) to run it at all, and even someone who obtained
  your specific secret would still need your refresh token (device-local, never committed or
  synced) to touch anything, and even then only the one file this app created.
- The actual boundary protecting your data is your Google account login itself, not anything in
  this codebase — if that's an acceptable trade-off for you (skipping a passphrase in exchange
  for trusting your Google account's own security), this setup requires nothing further.

## Known limitations / future extensions

- Sync is last-write-wins per record — fine for personal use across a few devices, not a
  general multi-writer conflict-free merge.
- No server-side component; Google Drive is the only supported cloud backend. Swapping in
  another backend (e.g. Supabase) means implementing an equivalent of `src/sync/driveClient.ts`
  and `src/sync/googleAuth.ts`.
- No export/import and no settings screen by design — the Drive backup *is* the backup, and it's
  a plain visible JSON file (`journal-backup.json` in the root of your Drive) you can already
  open or download directly with no in-app feature needed. The `BackupData` shape is defined in
  `src/sync/backupSerializer.ts` if you want to script something against it.
- The interactive Google consent popup requires a real user click, so the very first connection
  (or reconnecting after an explicit disconnect/revoke) can't happen automatically the way sync
  itself does — it's the one manual step in the app, via the "Connect" button in the sync banner.
- On iOS, opening the consent popup from an installed home-screen PWA can be less reliable than
  from a normal Safari tab (iOS sometimes routes `window.open` to a separate Safari instance,
  which can affect the popup-closes-itself handshake). If the "Connect" button seems stuck, try
  it from a regular browser tab first, then use the installed app afterwards — reconnecting is a
  rare event either way.
- No automated end-to-end browser test suite yet (unit/integration tests cover the data and
  sync-merge logic — see `npm test`).

## License

Add a license of your choice (e.g. MIT) before making this repository public.
