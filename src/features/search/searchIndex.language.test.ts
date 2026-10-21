import { expect, it } from 'vitest'
import { searchLessons } from './searchIndex'

it('finds an authored lesson by its English catalog title', async () => {
  const results = await searchLessons(
    'Cancellation Safety and Intermediate State',
    'en',
  )
  expect(results[0]?.id).toBe('M15-L01')
  expect(results[0]?.title).toBe('Cancellation Safety and Intermediate State')
})

it('indexes translated lesson prose in English mode', async () => {
  const results = await searchLessons('engineering trade-off', 'en')
  expect(results.some((result) => result.id === 'M01-L01')).toBe(true)
  expect(results.find((result) => result.id === 'M01-L01')?.excerpt).toMatch(
    /Choosing a language/i,
  )
})
