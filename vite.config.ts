import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildStaticCoursePages } from './scripts/course-page-renderer.mjs'

const projectRoot = dirname(fileURLToPath(import.meta.url))

/** Generate no-JavaScript lesson pages after the Vite assets are available. */
function staticCoursePagesPlugin() {
  return {
    name: 'static-course-pages',
    apply: 'build' as const,
    /** Render only explicitly allowlisted packages after the app CSS is emitted. */
    async closeBundle() {
      await buildStaticCoursePages({
        manifestPath: resolve(
          projectRoot,
          'content/public-course-manifest.json',
        ),
        contentRoot: resolve(projectRoot, 'content'),
        distRoot: resolve(projectRoot, 'dist'),
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), staticCoursePagesPlugin()],
})
