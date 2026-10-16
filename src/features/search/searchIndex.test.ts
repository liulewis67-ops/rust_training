import { expect, it } from 'vitest'
import { searchLessons } from './searchIndex'

// The public index should find Chinese text, Rust error codes, and Rust API terms at their lessons.
it('finds public course sections for Chinese, E0382, and State queries', () => {
  expect(
    searchLessons('借用').some((result) => result.id === 'borrowing'),
  ).toBe(true)
  expect(
    searchLessons('E0382').some((result) => result.id === 'ownership'),
  ).toBe(true)
  expect(
    searchLessons('State').some((result) => result.id === 'app-state'),
  ).toBe(true)
})

// No-result queries return an empty collection that the page can pair with recovery links.
it('returns an empty list when no public section matches', () => {
  expect(searchLessons('no-such-rust-topic')).toEqual([])
})

// Ranking prefers exact lesson titles and result fields never expose answer payloads.
it('ranks the matching title and returns only navigation-safe result data', () => {
  const results = searchLessons('AppState')

  expect(results[0]?.id).toBe('app-state')
  expect(results[0]?.href).toBe('#/lesson/app-state')
  expect(JSON.stringify(results)).not.toContain('referenceAnswer')
  expect(JSON.stringify(results)).not.toContain('correctAnswer')
})

// Only the approved course manifest contributes static lesson pages; private assessment IDs remain absent.
it('indexes explicitly published static pages without private assessment identifiers', () => {
  const results = searchLessons('切片')
  const staticLesson = results.find(
    (result) => result.id === 'borrowed-text-first-token',
  )

  expect(staticLesson?.href).toBe('#/public-lessons/borrowed-text-first-token')
  expect(searchLessons('borrowed-text-hidden-check')).toEqual([])
})
