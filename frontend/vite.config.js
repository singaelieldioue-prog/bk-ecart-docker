import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-xlsx': ['xlsx'],
          'vendor-jszip': ['jszip'],
          'vendor-react': ['react', 'react-dom'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
})
