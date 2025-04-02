import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api/llm': {
        target: 'http://localhost:11434',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/llm/, '/api/generate'),
      },
    },
  },
}) 