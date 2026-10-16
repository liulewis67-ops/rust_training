import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/** Build the same static app at the root or under the GitHub Pages repo path. */
export default defineConfig({
  base: process.env.PAGES_BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
  build: { assetsInlineLimit: 0 },
})
