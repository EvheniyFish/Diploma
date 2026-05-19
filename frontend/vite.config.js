import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/sim': 'http://localhost:3001',
      '/healthz': 'http://localhost:3000',
    }
  },
  resolve: {
    alias: { '@': '/src' }
  }
})
