import type { Exercise } from '../types/lesson'

const KEY = 'rust-backend-training:v1'
export interface Attempt { exerciseId: string; lessonId: string; correct: boolean; selfScore?: number; answer: string | number; at: string }
export interface Progress { completed: string[]; currentLesson: string; attempts: Attempt[]; weakness: Record<string, number>; streak: number; lastStudyDate: string | null }
const initial: Progress = { completed: [], currentLesson: 'ownership', attempts: [], weakness: {}, streak: 0, lastStudyDate: null }
export function loadProgress(): Progress {
  try {
    const saved = localStorage.getItem(KEY)
    if (!saved) return initial
    const parsed = JSON.parse(saved) as Partial<Progress>
    return { ...initial, ...parsed, completed: parsed.completed ?? [], attempts: parsed.attempts ?? [], weakness: parsed.weakness ?? {} }
  } catch { return initial }
}
export function saveProgress(progress: Progress) { localStorage.setItem(KEY, JSON.stringify(progress)) }
export function recordActivity(progress: Progress): Pick<Progress, 'streak' | 'lastStudyDate'> {
  const today = new Date().toLocaleDateString('en-CA')
  if (progress.lastStudyDate === today) return { streak: progress.streak, lastStudyDate: today }
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-CA')
  return { streak: progress.lastStudyDate === yesterday ? progress.streak + 1 : 1, lastStudyDate: today }
}
export function allExercises(exercises: Exercise[], comparison?: Exercise, challenge?: Exercise) { return [...exercises, ...(comparison ? [comparison] : []), ...(challenge ? [challenge] : [])] }
