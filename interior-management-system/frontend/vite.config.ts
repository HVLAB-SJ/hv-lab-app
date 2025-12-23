import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => ({
  base: '/',
  // Firebase 배포 시 환경변수 설정
  define: mode === 'production' ? {
    'import.meta.env.VITE_API_URL': JSON.stringify('https://asia-northeast3-hv-lab-app.cloudfunctions.net/api'),
    'import.meta.env.VITE_SOCKET_URL': JSON.stringify(''), // Cloud Functions doesn't support WebSocket
  } : {},
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
    // 성능 최적화 설정 (esbuild가 terser보다 10-100배 빠름)
    minify: 'esbuild',
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
            // Cloud Functions API
            urlPattern: /^https:\/\/.*cloudfunctions\.net/i,
            handler: 'NetworkOnly',
            options: {
              cacheName: 'api-cache-v2'
            }
          },
          {
            // Railway API (legacy)
            urlPattern: /^https:\/\/api\./i,
            handler: 'NetworkOnly',
            options: {
              cacheName: 'api-cache-legacy'
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
}));