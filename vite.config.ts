import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  server: {
    allowedHosts: ['.monkeycode-ai.live']
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',          // SW activates automatically on first visit
      injectRegister: 'auto',
      includeAssets: ['hero.png', 'icon-192.png', 'icon-512.png', '*.svg'],
      manifest: {
        name: 'Chess — Play, Learn & Practice',
        short_name: 'Chess',
        description: 'Play chess offline against a bot or a friend, with lessons, openings, endgames and move-by-move analysis.',
        theme_color: '#0e0f12',
        background_color: '#0e0f12',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        // Content-hashed static assets are precached by generateSW with revision
        // hashes; runtime caching only needs to cover navigation + media.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,ttf,json,webp}'],
        runtimeCaching: [
          {
            // Pages: always try the network first so users get the latest build.
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'chess-pages',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            // Images/fonts: cache-first is fine, they are immutable-ish.
            urlPattern: ({ request }) => request.destination === 'image' || request.destination === 'font',
            handler: 'CacheFirst',
            options: {
              cacheName: 'chess-static',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ]
});