import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/church-presenter/',
  build: { target: 'es2022', sourcemap: false },
  plugins: [
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['church-mark.svg'],
      manifest: {
        name: 'Church Presenter',
        short_name: 'Presenter',
        description: 'Offline countdown timer and two-line lyrics presenter for church services.',
        theme_color: '#063f32',
        background_color: '#f7f2e7',
        display: 'standalone',
        start_url: './#/',
        scope: './',
        icons: [
          { src: 'church-mark.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'church-mark-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff,woff2}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    include: ['src/tests/**/*.test.ts'],
  },
});
