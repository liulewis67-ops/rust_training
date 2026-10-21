import { expect, it } from 'vitest'
import { getLessons } from './localizedLessons'

it('shows English lesson and exercise prose without changing IDs or answer positions', () => {
  const chinese = getLessons('zh')
  const english = getLessons('en')
  expect(english.map((lesson) => lesson.id)).toEqual(chinese.map((lesson) => lesson.id))
  expect(english.flatMap((lesson) => lesson.exercises.map((exercise) => exercise.id))).toEqual(
    chinese.flatMap((lesson) => lesson.exercises.map((exercise) => exercise.id)),
  )
  expect(english.flatMap((lesson) => lesson.exercises.map((exercise) => exercise.correctAnswer))).toEqual(
    chinese.flatMap((lesson) => lesson.exercises.map((exercise) => exercise.correctAnswer)),
  )
  const visibleText = english.flatMap((lesson) => [
    lesson.title,
    lesson.objective,
    lesson.explanation,
    lesson.mentalModel?.description,
    lesson.mentalModel?.before,
    lesson.mentalModel?.after,
    ...lesson.examples.map((example) => example.label),
    ...lesson.summary,
    ...lesson.exercises.flatMap((exercise) => [
      exercise.prompt,
      ...(exercise.options ?? []),
      exercise.explanation,
      exercise.rule,
      exercise.temptingWrong,
      exercise.comparison,
      ...(exercise.type === 'code_fix' || exercise.type === 'code_completion'
        ? []
        : [exercise.referenceAnswer]),
    ]),
    lesson.comparisonQuestion?.prompt,
    lesson.comparisonQuestion?.explanation,
    lesson.comparisonQuestion?.referenceAnswer,
    lesson.challenge?.prompt,
    lesson.challenge?.explanation,
    lesson.challenge?.referenceAnswer,
  ])
  expect(visibleText.filter((text) => text && /\p{Script=Han}/u.test(text))).toEqual([])
  const codeComments = english.flatMap((lesson) => [
    ...lesson.examples.map((example) => example.code),
    ...lesson.exercises.map((exercise) => exercise.code),
  ]).flatMap((code) => [...(code ?? '').matchAll(/\/\/[^\n]*/g)].map((match) => match[0]))
  expect(codeComments.filter((comment) => /\p{Script=Han}/u.test(comment))).toEqual([])
})
