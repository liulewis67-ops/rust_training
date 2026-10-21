import type { Language } from '../lib/language'
import type { Exercise, Lesson } from '../types/lesson'
import legacyTextEn from './legacyText.en.json'
import { lessons } from './lessons'

const translations = legacyTextEn as Record<string, string>
const translate = (value: string): string => translations[value] ?? value
const codeComments: Record<string, string> = {
  'request 在这里已失效': 'The request binding is no longer usable here.',
  '两者都有效': 'Both values remain usable.',
  '字面量也是 &str': 'A string literal has type &str.',
  'session 已 move': 'The session value has been moved.',
  '尽早释放锁': 'Release the lock as soon as possible.',
  '尚未执行完成': 'The future has not completed yet.',
  '若 operation 被丢弃，已提交的 checkpoint 仍可供恢复。':
    'If the operation is dropped, the persisted checkpoint remains available for recovery.',
  '结束后连接回池': 'The connection returns to the pool when the transaction ends.',
  '每个 session 一个有界 mailbox；manager 按 ID 路由命令。':
    'Each session has a bounded mailbox; the manager routes commands by ID.',
}
function localizeCode(value: string): string {
  return value.replace(/(\/\/[ \t]*)([^\n]*[\p{Script=Han}][^\n]*)/gu, (_match, prefix: string, comment: string) => {
    return `${prefix}${codeComments[comment] ?? comment}`
  })
}

function localizeExercise(exercise: Exercise): Exercise {
  return {
    ...exercise,
    prompt: translate(exercise.prompt),
    options: exercise.options?.map(translate),
    explanation: translate(exercise.explanation),
    rule: translate(exercise.rule),
    temptingWrong: exercise.temptingWrong && translate(exercise.temptingWrong),
    comparison: exercise.comparison && translate(exercise.comparison),
    referenceAnswer:
      exercise.referenceAnswer &&
      (exercise.type === 'code_fix' || exercise.type === 'code_completion'
        ? localizeCode(exercise.referenceAnswer)
        : translate(exercise.referenceAnswer)),
    code: exercise.code && localizeCode(exercise.code),
  }
}

let englishLessons: Lesson[] | undefined

/** Keep lesson and exercise IDs stable while changing learner-facing copy. */
export function getLessons(language: Language = 'zh'): Lesson[] {
  if (language === 'zh') return lessons
  englishLessons ??= lessons.map((lesson) => ({
    ...lesson,
    title: translate(lesson.title),
    objective: translate(lesson.objective),
    explanation: translate(lesson.explanation),
    mentalModel: lesson.mentalModel && {
      description: translate(lesson.mentalModel.description),
      before: lesson.mentalModel.before && translate(lesson.mentalModel.before),
      after: lesson.mentalModel.after && translate(lesson.mentalModel.after),
    },
    examples: lesson.examples.map((example) => ({
      ...example,
      label: example.label && translate(example.label),
      code: localizeCode(example.code),
    })),
    exercises: lesson.exercises.map(localizeExercise),
    comparisonQuestion: lesson.comparisonQuestion && localizeExercise(lesson.comparisonQuestion),
    challenge: lesson.challenge && {
      ...localizeExercise(lesson.challenge),
      prompt: lesson.challenge.id.endsWith('-apply')
        ? `Explain in your own words: ${translate(lesson.objective)} Identify one failure boundary in a production system.`
        : translate(lesson.challenge.prompt),
    },
    summary: lesson.summary.map(translate),
  }))
  return englishLessons
}
