import coursePack from '../../content/borrowed-text.course.json'
import publicManifest from '../../content/public-course-manifest.json'
import notes from '../../content/public/borrowed-text/notes.md?raw'
import runnableExample from '../../content/samples/first-word-runnable.rs?raw'
import fragmentExample from '../../content/samples/first-word-fragment.rs?raw'
import compileFailExample from '../../content/samples/borrow-conflict-compile-fail.rs?raw'

export interface PublicCourseLesson {
  id: string
  title: string
  objectives: string[]
  terms: Array<{ term: string; definition: string }>
  resource_ids: string[]
  example_ids: string[]
  exercise_ids: string[]
  blocks: Array<{ text: string }>
}

interface PublicCoursePack {
  course_id: string
  title: string
  visibility: string
  lessons: PublicCourseLesson[]
  exercises: Array<{ id: string; lesson_id: string; prompt: string; hints: string[] }>
  sources: Array<{ license_status: string }>
  resources: Array<{ id: string; path: string; visibility: string }>
}

const course = coursePack as PublicCoursePack
const exampleCode: Record<string, string> = {
  'first-word-runnable': runnableExample,
  'first-word-fragment': fragmentExample,
  'borrow-conflict-compile-fail': compileFailExample,
}

/** Return only a course pack explicitly published in the manifest and with approved sources. */
export function findPublicCourseLesson(id: string): PublicCourseLesson | undefined {
  if (
    !publicManifest.course_files.includes('borrowed-text.course.json') ||
    course.visibility !== 'public' ||
    !course.sources.every((source) => ['approved', 'original'].includes(source.license_status)) ||
    !course.resources.every((resource) => resource.visibility === 'public')
  ) return undefined
  return course.lessons.find((lesson) => lesson.id === id)
}

export function getPublicCourse(): PublicCoursePack {
  return course
}

export function listPublicCourseLessons(): PublicCourseLesson[] {
  return course.lessons.filter((lesson) => Boolean(findPublicCourseLesson(lesson.id)))
}

export function getPublicExercise(id: string) {
  return course.exercises.find((exercise) => exercise.id === id)
}

export function getPublicResource(id: string): string | undefined {
  const resource = course.resources.find((item) => item.id === id)
  return resource?.path === 'public/borrowed-text/notes.md' && resource.visibility === 'public'
    ? notes
    : undefined
}

export function getPublicExample(id: string): string | undefined {
  return exampleCode[id]
}
