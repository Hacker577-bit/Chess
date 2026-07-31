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
        // Cache-first for ALL static assets → zero network after first load
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,ttf,json,webp}'],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination !== '',
            handler: 'CacheFirst',
            options: {
              cacheName: 'chess-static',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ]
});