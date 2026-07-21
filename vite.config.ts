import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages project sites are served from a subpath
// (https://<user>.github.io/<repo>/), not domain root, so the base path is
// configurable via BASE_PATH at build time — see the deploy workflow.
const base = process.env.BASE_PATH || '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Journal',
        short_name: 'Journal',
        description: 'A private, offline-first journal and notes app.',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          {
            src: `${base}icons/icon-192.png`,
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: `${base}icons/icon-512.png`,
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: `${base}icons/icon-maskable-512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // All app data lives in IndexedDB; the service worker only needs to
        // precache the built app shell so the UI itself works offline.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: `${base}index.html`,
        // Google's OAuth redirect appends ?code=...&state=... to this URL.
        // Workbox tests this denylist against `pathname + search` combined,
        // so an anchored `...html$` pattern (matching only the bare file
        // with no query string) silently fails to match the real redirect
        // and the SPA fallback below still intercepts it, serving the full
        // app instead of the tiny standalone callback page — breaking the
        // "Connect to Google Drive" flow (the popup never posts back to the
        // opener or closes itself). No `$` anchor here, deliberately.
        navigateFallbackDenylist: [/\/oauth-callback\.html/],
      },
    }),
  ],
})
