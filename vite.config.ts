
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
        manifest: {
          name: '语音库存管理',
          short_name: '语音库存',
          description: '一款语音驱动的库存管理应用',
          theme_color: '#0f766e',
          background_color: '#ffffff',
          display: 'standalone',
          start_url: '/',
          icons: [
            {
              src: 'https://cdn-icons-png.flaticon.com/512/2897/2897785.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'https://cdn-icons-png.flaticon.com/512/2897/2897785.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        },
        workbox: {
          // IMPORTANT: Cache external resources (CDN) for offline use
          runtimeCaching: [
            {
              urlPattern: ({ url }) => url.href.includes('cdn-icons-png.flaticon.com'),
              handler: 'CacheFirst',
              options: {
                cacheName: 'icon-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              urlPattern: ({ url }) => url.href.includes('cdn.jsdelivr.net'),
              handler: 'CacheFirst',
              options: {
                cacheName: 'cdn-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            }
          ]
        }
      })
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY || ''),
      'process.env': {}
    },
    server: {
      host: '0.0.0.0',
      port: 5173
    }
  };
});
