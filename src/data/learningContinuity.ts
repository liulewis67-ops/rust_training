import curriculum from '../../content/course-continuity.json'
import type { Language } from '../lib/language'

export type LocalizedText = { zh: string; en: string }
export type ContinuityStep = {
  id: string
  label: LocalizedText
  problem: LocalizedText
  decision: LocalizedText
  artifact: LocalizedText
  evidence: LocalizedText
}
export type ContinuityModule = {
  id: string
  goal: LocalizedText
  steps: ContinuityStep[]
}

/** One 54-step learning dependency chain, not a claim of a shared Cargo workspace. */
export const learningContinuity = curriculum.modules as ContinuityModule[]

export function findContinuity(moduleId: string): ContinuityModule | undefined {
  return learningContinuity.find((m) => m.id.toLowerCase() === moduleId.toLowerCase())
}

export function locateContinuity(
  moduleId: string,
  lessonId: string,
): { module: ContinuityModule; step: ContinuityStep; index: number } | undefined {
  const module = findContinuity(moduleId)
  if (!module) return undefined
  const index = module.steps.findIndex((s) => s.id === `${module.id}-${lessonId.toUpperCase()}`)
  return index < 0 ? undefined : { module, step: module.steps[index], index }
}

export function adjacentContinuity(moduleId: string, lessonId: string): {
  previous?: ContinuityStep
  next?: ContinuityStep
} {
  const all = learningContinuity.flatMap((m) => m.steps)
  const index = all.findIndex((s) => s.id === `${moduleId.toUpperCase()}-${lessonId.toUpperCase()}`)
  if (index < 0) return {}
  return { previous: all[index - 1], next: all[index + 1] }
}

export function continuityLabel(text: LocalizedText, language: Language): string {
  return text[language]
}
