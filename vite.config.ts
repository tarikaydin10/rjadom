import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Everything the app needs at runtime is served from its own origin: fonts, icons,
// code. The only outbound call is the weather endpoint, and its base URL is
// configurable so the deployment can point at a self-hosted Open-Meteo instance.
// `||` for the same reason as in the weather module: an unset repository
// variable arrives as an empty string, and the runtime cache rule would then be
// built for the wrong origin.
const weatherBase = process.env.VITE_WEATHER_BASE_URL || 'https://api.open-meteo.com';

export default defineConfig({
  // In development the API lives in the reference server next door; in
  // production both are behind the same hostname anyway.
  server: {
    proxy: { '/api': { target: process.env.VITE_DEV_API ?? 'http://localhost:8787', changeOrigin: true } },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['fonts/*.woff2', 'icons/*.png'],
      manifest: {
        id: '/',
        name: 'Rjadom · Рядом',
        short_name: 'Rjadom',
        description: 'Two people, two cities, one sky.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F4EFE6',
        theme_color: '#241F1B',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,ico}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Belt and braces: the forecast is also persisted in IndexedDB, but a
            // cached HTTP response lets a cold start render numbers before the
            // database opens.
            urlPattern: new RegExp('^' + weatherBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'rjadom-weather',
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 16, maxAgeSeconds: 60 * 60 * 24 * 3 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
