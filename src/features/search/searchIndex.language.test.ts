import { expect, it } from 'vitest'
import { searchLessons } from './searchIndex'

it('keeps original text searchable when a translation is not published', async () => {
  const results = await searchLessons('ResourceLease', 'en')
  expect(results.some((result) => result.id === 'M04-L01')).toBe(true)
})

it('does not expose English catalog titles for unreleased lessons', async () => {
  const results = await searchLessons(
    'Cancellation Safety and Intermediate State',
    'en',
  )
  expect(results.some((result) => result.id === 'M15-L01')).toBe(false)
})
