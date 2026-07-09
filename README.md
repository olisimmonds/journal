# Journal

A private, offline-first journal and notes PWA. React + TypeScript + Vite, data stored locally
in IndexedDB, optionally backed up — end-to-end encrypted — to your own Google Drive. Installs
to the home screen on iOS, Android, and desktop, and works fully offline.

## Features

- **Calendar journal** — monthly view, today highlighted, days with entries marked, unlimited
  text, inline images, autosave, optional per-day title, full-text search.
- **Notes** — separate from the calendar, unlimited notes, checklists, drag-to-reorder, autosave.
- **Privacy** — all data lives in IndexedDB on your device. Cloud backup is a single file,
  encrypted client-side with AES-256-GCM before it ever leaves the device, stored in a hidden
  Google Drive folder your app alone can see.
- **Backup & migration** — export everything as JSON (full re-importable backup), Markdown
  (zipped, with images), or PDF. No lock-in.
- **PWA** — installable on iOS/Android/desktop, works fully offline, dark grayscale UI optimized
  for one-handed mobile use.

## Tech stack

| Layer | Choice |
|---|---|
| UI | React 19, TypeScript, Tailwind CSS 4 |
| Build | Vite 8, `vite-plugin-pwa` |
| Local storage | IndexedDB via [Dexie.js](https://dexie.org) |
| Encryption | Web Crypto API — PBKDF2 key derivation, AES-256-GCM |
| Cloud backup | Google Drive `appDataFolder` (hidden, app-private) |
| Testing | Vitest, React Testing Library |

## Architecture

```
src/
  db/         Dexie schema + typed repositories (entries, notes, images, tombstones)
  crypto/     Passphrase → key derivation, AES-GCM encrypt/decrypt, session key cache
  sync/       Google OAuth, Drive REST client, backup serializer, merge/sync manager
  features/
    calendar/ Monthly grid, day cells, entry-marker live query
    entry/    Per-day editor: title, body, autosave, inline images
    notes/    Persistent notes: CRUD, checklist, drag-to-reorder
    search/   Full-text search across entries
    settings/ Passphrase gate, security controls
    backup/   JSON/Markdown/PDF export + JSON import, Drive sync UI
  components/ Reusable UI primitives (Button, Modal, ConfirmDialog, icons, ...)
  utils/      Date helpers, file download helper
```

Data flow is one-directional and offline-first: the UI **always** reads from and writes to
IndexedDB. Google Drive sync is a background backup/restore layer on top — it is never the
primary read path, so the app is 100% functional with no network connection.

### Encryption model

1. On first run, you choose a passphrase. It's run through PBKDF2 (150,000 iterations, SHA-256)
   with a random salt to derive an AES-256-GCM key.
2. The passphrase itself is **never stored or transmitted**. Only the derived key lives in memory
   for the current browser session; a random salt and a small verification value are kept in
   `localStorage` so a re-entered passphrase can be checked without ever persisting the
   passphrase or key.
3. Before every Google Drive sync, the entire local database (entries, images, notes) is
   serialized to JSON and encrypted with that key. Only the encrypted blob (plus the salt, which
   is not secret) is uploaded.
4. **If you lose your passphrase, the Drive backup is unrecoverable by design.** Local data on
   your current device is unaffected — losing the passphrase only blocks decrypting a *remote*
   backup.

### Sync model

Google Drive sync uses the `drive.appdata` OAuth scope — a hidden, per-app folder that is
invisible in the user's normal Drive UI and inaccessible to any other app. Sync is a simple
last-write-wins merge per record (`updatedAt` timestamp), which is appropriate for one person
using a couple of personal devices. Deletions are tracked with local tombstone records so an
older backup from another device can never resurrect something you deleted. This is **not** a
general-purpose multi-writer CRDT — if you need that, it's a natural place to extend the project
(see `src/sync/syncManager.ts`).

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
Cloudflare Pages, GitHub Pages, etc.

1. Set the `VITE_GOOGLE_CLIENT_ID` environment variable in your host's build settings.
2. Add your production URL to the OAuth client's **Authorized JavaScript origins** in Google
   Cloud Console.
3. Deploy `dist/`. HashRouter is used for routing, so no server-side rewrite rules are needed for
   client-side routes.

## Installing on a device

- **iOS (Safari)**: open the site → Share → **Add to Home Screen**.
- **Android (Chrome)**: open the site → menu (⋮) → **Install app** / **Add to Home screen**.
- **Desktop (Chrome/Edge)**: an install icon appears in the address bar.

Once installed, the app runs standalone (no browser chrome) and works fully offline.

## Data & privacy

- All journal entries, notes, and images are stored locally in IndexedDB. Nothing leaves your
  device unless you explicitly connect Google Drive sync.
- Cloud backups are encrypted client-side before upload; Google (and this app's developers) never
  see your plaintext data.
- You can export everything at any time — see **Settings → Backup & export**:
  - **JSON** — the complete, re-importable backup (entries, images, notes, metadata).
  - **Markdown** — a zip of human-readable `.md` files plus your original images.
  - **PDF** — a single printable/readable document.
- Repository safety: no secrets are ever committed. `.env` is git-ignored; `.env.example`
  documents the one public OAuth client ID the app needs. This repository is safe to make
  public.

## Known limitations / future extensions

- Sync is last-write-wins per record — fine for personal use across a few devices, not a
  general multi-writer conflict-free merge.
- No server-side component; Google Drive `appDataFolder` is the only supported cloud backend.
  Swapping in another backend (e.g. Supabase) means implementing an equivalent of
  `src/sync/driveClient.ts` and `src/sync/googleAuth.ts`.
- No automated end-to-end browser test suite yet (unit/integration tests cover the data,
  crypto, and sync-merge logic — see `npm test`).

## License

Add a license of your choice (e.g. MIT) before making this repository public.
