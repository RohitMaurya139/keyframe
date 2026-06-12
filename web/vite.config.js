import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Dev: vite on :5173 proxies API + media to the KEYFRAME server on :8080.
// Build: outputs to ../server/public/dist, served statically by Express.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../server/public/dist',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
      '/videos': 'http://localhost:8080',
    },
  },
})
