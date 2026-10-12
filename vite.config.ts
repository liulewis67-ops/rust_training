import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { createHash } from 'node:crypto'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildStaticCoursePages } from './scripts/course-page-renderer.mjs'

const projectRoot = dirname(fileURLToPath(import.meta.url))

/** List built site files using URL paths for the service worker's offline cache. */
async function listBuildFiles(root: string, current = root): Promise<string[]> {
  const entries = await readdir(current, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      // Recurse into generated lesson routes so static pages also reopen offline.
      const path = resolve(current, entry.name)
      if (entry.isDirectory()) return listBuildFiles(root, path)
      if (!entry.isFile() || entry.name === 'sw.js') return []
      return [`/${relative(root, path).split(sep).join('/')}`]
    }),
  )
  return nested.flat()
}

/** Cache the built app shell and static lessons so local drafts can reopen offline. */
function staticCoursePagesPlugin() {
  return {
    name: 'static-course-pages-and-offline-shell',
    apply: 'build' as const,
    /** Write a versioned cache manifest after static lesson pages have been generated. */
    async closeBundle() {
      const distRoot = resolve(projectRoot, 'dist')
      // Finish static generation before collecting the offline page manifest.
      await buildStaticCoursePages({
        manifestPath: resolve(
          projectRoot,
          'content/public-course-manifest.json',
        ),
        contentRoot: resolve(projectRoot, 'content'),
        distRoot,
      })
      const files = await listBuildFiles(distRoot)
      const cacheDigest = createHash('sha256')
      for (const file of files) {
        // Include generated HTML and assets so every content change replaces the prior cache.
        cacheDigest.update(file)
        cacheDigest.update(await readFile(resolve(distRoot, file.slice(1))))
      }
      const cacheName = `rust-path-shell-${cacheDigest.digest('hex').slice(0, 16)}`
      const source = `const CACHE_NAME = '${cacheName}'
const PRECACHE_URLS = ${JSON.stringify(['/'].concat(files))}

self.addEventListener('install', (event) => {
  // Do not activate until the shell and its static lesson pages are cached.
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  // Keep only the current content-addressed shell cache.
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('rust-path-shell-') && key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()))
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return
  event.respondWith(caches.match(request).then((cached) => {
    if (cached) return cached
    if (request.mode === 'navigate') return caches.match('/').then((shell) => shell || fetch(request))
    return fetch(request)
  }))
})
`
      await writeFile(resolve(distRoot, 'sw.js'), source, 'utf8')
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), staticCoursePagesPlugin()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:3000',
    },
  },
})
