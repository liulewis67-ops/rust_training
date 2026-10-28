import { expect, it } from 'vitest'
import { searchLessons } from './searchIndex'

// The public index should find Chinese text, Rust error codes, and Rust API terms at their lessons.
it('finds public course sections for Chinese, E0382, and State queries', async () => {
  expect(
    (await searchLessons('借用')).some((result) => result.id === 'borrowing'),
  ).toBe(true)
  expect(
    (await searchLessons('E0382')).some((result) => result.id === 'ownership'),
  ).toBe(true)
  expect(
    (await searchLessons('State')).some((result) => result.id === 'app-state'),
  ).toBe(true)
})

// No-result queries return an empty collection that the page can pair with recovery links.
it('returns an empty list when no public section matches', async () => {
  expect(await searchLessons('no-such-rust-topic')).toEqual([])
})

it('indexes newly released M03 lesson text after lazy loading', async () => {
  const result = (await searchLessons('AlertStatus')).find(
    (lesson) => lesson.id === 'M03-L06',
  )

  expect(result?.href).toBe('#/courses/m03/l06')
})

it('indexes newly released M04 ownership lessons after lazy loading', async () => {
  const result = (await searchLessons('ResourceLease')).find(
    (lesson) => lesson.id === 'M04-L01',
  )

  expect(result?.href).toBe('#/courses/m04/l01')
})

it('indexes newly released M05 borrowing lessons after lazy loading', async () => {
  const result = (await searchLessons('split_whitespace')).find(
    (lesson) => lesson.id === 'M05-L03',
  )

  expect(result?.href).toBe('#/courses/m05/l03')
})

it('indexes newly released M06 lifetime lessons after lazy loading', async () => {
  const result = (await searchLessons('Cow::Borrowed')).find(
    (lesson) => lesson.id === 'M06-L06',
  )

  expect(result?.href).toBe('#/courses/m06/l06')
})

it('indexes newly released M07 trait lessons after lazy loading', async () => {
  const result = (await searchLessons('EntryParser')).find(
    (lesson) => lesson.id === 'M07-L05',
  )

  expect(result?.href).toBe('#/courses/m07/l05')
})

it('does not publish planned M08–M24 lessons through search', async () => {
  const results = await searchLessons('iter_mut')
  expect(results.some((result) => result.id === 'M08-L03')).toBe(false)
  expect((await searchLessons('JoinError')).some((result) => result.id === 'M14-L01')).toBe(false)
})

// Ranking prefers exact lesson titles and result fields never expose answer payloads.
it('ranks the matching title and returns only navigation-safe result data', async () => {
  const results = await searchLessons('AppState')

  expect(results[0]?.id).toBe('app-state')
  expect(results[0]?.href).toBe('#/lesson/app-state')
  expect(JSON.stringify(results)).not.toContain('referenceAnswer')
  expect(JSON.stringify(results)).not.toContain('correctAnswer')
})

// Only the approved course manifest contributes static lesson pages; private assessment IDs remain absent.
it('indexes explicitly published static pages without private assessment identifiers', async () => {
  const results = await searchLessons('切片')
  const staticLesson = results.find(
    (result) => result.id === 'borrowed-text-first-token',
  )

  expect(staticLesson?.href).toBe('#/public-lessons/borrowed-text-first-token')
  expect(await searchLessons('borrowed-text-hidden-check')).toEqual([])
})
