import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
    // 성능 최적화 설정
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // 프로덕션에서 console.log 제거
        drop_debugger: true
      }
    },
    // 청크 분할 최적화
    rollupOptions: {
      output: {
        manualChunks: {
          // React 관련 라이브러리 분리
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // UI 라이브러리 분리
          'vendor-ui': ['framer-motion', 'lucide-react', 'clsx'],
          // 데이터 관련 라이브러리 분리
          'vendor-data': ['zustand', '@tanstack/react-query', 'axios'],
          // 날짜 라이브러리 분리
          'vendor-date': ['date-fns', 'moment'],
          // 캘린더 분리
          'vendor-calendar': ['react-big-calendar']
        }
      }
    },
    // 청크 크기 경고 제한 상향
    chunkSizeWarningLimit: 1000,
    // 소스맵 비활성화 (프로덕션)
    sourcemap: false
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt', // 'autoUpdate' 대신 'prompt' 사용
      includeAssets: ['favicon.png', 'icon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: false, // Use the existing manifest.json in public folder
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        navigateFallback: null,
        directoryIndex: null,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\./i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: true
      }
    })
  ],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  preview: {
    allowedHosts: ['hvlab.app', 'localhost']
  }
});