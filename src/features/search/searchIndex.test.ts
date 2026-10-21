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

it('indexes newly released M08 collection and iterator lessons after lazy loading', async () => {
  const result = (await searchLessons('iter_mut')).find(
    (lesson) => lesson.id === 'M08-L03',
  )

  expect(result?.href).toBe('#/courses/m08/l03')
})

it('indexes newly released M09 custom error lessons after lazy loading', async () => {
  const result = (await searchLessons('Error::source')).find(
    (lesson) => lesson.id === 'M09-L02',
  )

  expect(result?.href).toBe('#/courses/m09/l02')
})

it('indexes newly released M10 workspace lessons after lazy loading', async () => {
  const result = (await searchLessons('Cargo workspace')).find(
    (lesson) => lesson.id === 'M10-L01',
  )

  expect(result?.href).toBe('#/courses/m10/l01')
})

it('indexes newly released M11 smart pointer lessons after lazy loading', async () => {
  const result = (await searchLessons('Weak::upgrade')).find(
    (lesson) => lesson.id === 'M11-L04',
  )

  expect(result?.href).toBe('#/courses/m11/l04')
})

it('indexes newly released M12 concurrency lessons after lazy loading', async () => {
  const result = (await searchLessons('并行日志统计')).find(
    (lesson) => lesson.id === 'M12-L05',
  )

  expect(result?.href).toBe('#/courses/m12/l05')
})

it('indexes newly released M13 async runtime lessons after lazy loading', async () => {
  const result = (await searchLessons('spawn_blocking')).find(
    (lesson) => lesson.id === 'M13-L04',
  )

  expect(result?.href).toBe('#/courses/m13/l04')
})

it('indexes newly released M14 task results lessons after lazy loading', async () => {
  const result = (await searchLessons('JoinError')).find(
    (lesson) => lesson.id === 'M14-L01',
  )

  expect(result?.href).toBe('#/courses/m14/l01')
})

it('indexes newly released M15 shutdown lessons after lazy loading', async () => {
  const result = (await searchLessons('优雅停机')).find(
    (lesson) => lesson.id === 'M15-L03',
  )

  expect(result?.href).toBe('#/courses/m15/l03')
})

it('indexes the released Axum HTTP contract lesson after lazy loading', async () => {
  const result = (await searchLessons('Allow')).find(
    (lesson) => lesson.id === 'M16-L01',
  )
  expect(result).toBeTruthy()
})

it('indexes the released request context lesson after lazy loading', async () => {
  const result = (await searchLessons('X-Request-ID')).find(
    (lesson) => lesson.id === 'M17-L05',
  )
  expect(result).toBeTruthy()
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
