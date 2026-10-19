import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

const appVersion = readFileSync(new URL('../VERSION', import.meta.url), 'utf8').trim()

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [react()],
  server: {
    host: '0.0.0.0',  // Listen on all network interfaces (LAN)
    port: 5173,
  },
  preview: {
    host: '0.0.0.0',  // Listen on all network interfaces (LAN)
    port: 4173,
  },
})
