import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages 配信時のパス（リポジトリ名に合わせる）
// 例: https://<user>.github.io/shindanv27/
export default defineConfig({
  base: '/shindanv27/',
  plugins: [
    react(),
    // PWA（オフライン動作）: 現行版の Service Worker を置き換える
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: '樹木診断・点検システム v27',
        short_name: '樹木診断v27',
        description: '樹木の活力度・健全度診断と点検記録の管理',
        theme_color: '#2e7d32',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '.',
        icons: [
          {
            src: 'pwa-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        // 地図タイルはネット必須なのでキャッシュ対象から除外し、
        // アプリ本体（JS/CSS/HTML）のみプリキャッシュする
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024
      }
    })
  ]
});
