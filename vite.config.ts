/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    // Respect the harness-assigned port (Vite doesn't read PORT by itself)
    port: Number(process.env.PORT) || 5173,
  },
  // Vitest configuration — explicit to prevent auto-discovery surprises
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png', 'logo-full.png', 'logo-mark.png', 'favicon.png', 'hero.png', '404.png'],
      manifest: {
        name: 'Expenso — Expense Tracker',
        short_name: 'Expenso',
        description:
          'Track expenses, budgets, UPI payments and financial goals — all in one place.',
        theme_color: '#0a0a0b',
        background_color: '#0a0a0b',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        // Android: lets users share a UPI SMS/notification straight into the app
        share_target: {
          action: '/upi-sync',
          method: 'GET',
          params: {
            title: 'title',
            text: 'text',
            url: 'url',
          },
        },
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // App shell + static assets cached for offline; Supabase calls stay network-only
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-styles' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
