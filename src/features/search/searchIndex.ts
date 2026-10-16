import coursePack from '../../../content/borrowed-text.course.json'
import publicManifest from '../../../content/public-course-manifest.json'
import sampleManifest from '../../../content/course-samples.json'
import runnableExample from '../../../content/samples/first-word-runnable.rs?raw'
import fragmentExample from '../../../content/samples/first-word-fragment.rs?raw'
import compileFailExample from '../../../content/samples/borrow-conflict-compile-fail.rs?raw'
import { lessons } from '../catalog'
import { courseModules } from '../../data/courseCatalog'
import type { Lesson } from '../../types/lesson'

interface SearchDocument {
  id: string
  title: string
  section: string
  href: string
  body: string[]
  aliases: string[]
}

export interface SearchResult {
  id: string
  title: string
  section: string
  href: string
  excerpt: string
}

interface CourseLesson {
  id: string
  title: string
  objectives: string[]
  terms?: Array<{ term: string; definition: string }>
  source_ids: string[]
  resource_ids: string[]
  example_ids: string[]
  exercise_ids: string[]
  blocks: Array<{ text: string }>
}

interface PublicCourse {
  course_id: string
  visibility: string
  lessons: CourseLesson[]
  exercises: Array<{ id: string; prompt: string; hints?: string[] }>
  sources: Array<{ id: string; license_status: string }>
  resources: Array<{ id: string; visibility: string }>
}

const courseBundles: Array<{ fileName: string; course: PublicCourse }> = [
  { fileName: 'borrowed-text.course.json', course: coursePack as PublicCourse },
]
const sampleCode: Record<string, string> = {
  'first-word-runnable': runnableExample,
  'first-word-fragment': fragmentExample,
  'borrow-conflict-compile-fail': compileFailExample,
}
const publicSampleCode = new Map(
  // Sample kinds selected here are the same public kinds used by static course rendering.
  sampleManifest.examples
    .filter((example) =>
      ['runnable', 'fragment', 'compile_fail'].includes(example.kind),
    )
    .flatMap((example) => {
      const code = sampleCode[example.id]
      return code ? [[example.id, code]] : []
    }),
)

/** Normalize Unicode width and case so Chinese, Latin terms, and error codes compare consistently. */
function normalizeQuery(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase('zh-CN')
}

/** Convert an existing public lesson to a search record without indexing answer keys. */
function createLessonDocument(lesson: Lesson): SearchDocument {
  // Answer keys and feedback payloads are omitted; only visible prompts and lesson text are indexed.
  const body = [
    lesson.objective,
    lesson.explanation,
    lesson.mentalModel?.description,
    lesson.mentalModel?.before,
    lesson.mentalModel?.after,
    ...lesson.examples.map((example) => example.code),
    ...lesson.exercises.map((exercise) => exercise.prompt),
    lesson.comparisonQuestion?.prompt,
    lesson.challenge?.prompt,
    ...lesson.summary,
    ...lesson.exercises.flatMap((exercise) => exercise.tags),
    ...(lesson.challenge?.tags ?? []),
  ].filter((part): part is string => Boolean(part))

  // E0382 is the compiler's moved-value diagnostic; connect it to the lesson that teaches move.
  const aliases =
    lesson.id === 'ownership' ? ['E0382', 'use of moved value'] : []
  if (aliases.length) body.push('E0382：值被移动后再次使用')

  return {
    id: lesson.id,
    title: lesson.title,
    section: lesson.category,
    href: `#/lesson/${encodeURIComponent(lesson.id)}`,
    body,
    aliases,
  }
}

/** Check every publication boundary before any course-pack text enters the search index. */
function isPublishableCourse(
  course: PublicCourse,
  listedFiles: readonly string[],
  fileName: string,
): boolean {
  if (!listedFiles.includes(fileName) || course.visibility !== 'public')
    return false
  // A source or resource that is not explicitly public blocks every lesson in that package.
  if (
    !course.sources.every((source) =>
      ['approved', 'original'].includes(source.license_status),
    )
  )
    return false
  if (!course.resources.every((resource) => resource.visibility === 'public'))
    return false

  const sourceIds = new Set(course.sources.map((source) => source.id))
  const resourceIds = new Set(course.resources.map((resource) => resource.id))
  return course.lessons.every((lesson) => {
    return (
      lesson.source_ids.every((id) => sourceIds.has(id)) &&
      lesson.resource_ids.every((id) => resourceIds.has(id))
    )
  })
}

/** Convert a reviewed course package into records containing only its public searchable fields. */
function createCourseDocuments(course: PublicCourse): SearchDocument[] {
  const exerciseById = new Map(
    course.exercises.map((exercise) => [exercise.id, exercise]),
  )

  return course.lessons.map((lesson) => {
    // Each field below is rendered by the static reader; assessment records are never traversed.
    const body = [
      ...lesson.objectives,
      ...(lesson.terms ?? []).flatMap((term) => [term.term, term.definition]),
      ...lesson.blocks.map((block) => block.text),
      ...lesson.example_ids.flatMap((id) => {
        const code = publicSampleCode.get(id)
        return code ? [code] : []
      }),
      ...lesson.exercise_ids.flatMap((id) => {
        const exercise = exerciseById.get(id)
        return exercise ? [exercise.prompt, ...(exercise.hints ?? [])] : []
      }),
    ].filter(Boolean)

    return {
      id: lesson.id,
      title: lesson.title,
      section: course.course_id,
      href: `#/public-lessons/${encodeURIComponent(lesson.id)}`,
      body,
      aliases: [],
    }
  })
}

/** Build the searchable set from app lessons and the explicit public course manifest. */
function createSearchDocuments(): SearchDocument[] {
  const legacyDocuments = lessons.map(createLessonDocument)
  const authoredCourseDocuments = courseModules.flatMap((module) =>
    module.lessons
      .filter((lesson) => lesson.content.trim())
      .map((lesson) => ({
        id: `${module.id}-${lesson.id}`,
        title: lesson.title,
        section: `${module.id} · ${module.title}`,
        href: `#/courses/${module.id.toLowerCase()}/${lesson.id.toLowerCase()}`,
        body: [lesson.content, ...lesson.exercises].filter(Boolean),
        aliases: [],
      })),
  )
  const listedFiles = publicManifest.course_files
  const missingBundles = listedFiles.filter((fileName) => {
    // Refuse to ship a published package until its public search fields are explicitly wired.
    return !courseBundles.some((bundle) => bundle.fileName === fileName)
  })
  if (missingBundles.length)
    throw new Error(
      `Search index missing public packages: ${missingBundles.join(', ')}`,
    )
  const publishedDocuments = courseBundles.flatMap(({ fileName, course }) => {
    if (!isPublishableCourse(course, listedFiles, fileName)) return []
    return createCourseDocuments(course)
  })
  return [...legacyDocuments, ...authoredCourseDocuments, ...publishedDocuments]
}

const searchDocuments = createSearchDocuments()

/** Find public lessons by title, body, Rust terms, and searchable error-code aliases. */
export function searchLessons(query: string): SearchResult[] {
  const normalized = normalizeQuery(query)
  if (!normalized) return []

  return searchDocuments
    .map((document) => {
      const titleMatch = normalizeQuery(document.title).includes(normalized)
      const aliasMatch = document.aliases.some((alias) =>
        normalizeQuery(alias).includes(normalized),
      )
      const matchingBody = document.body.find((part) =>
        normalizeQuery(part).includes(normalized),
      )
      if (!titleMatch && !aliasMatch && !matchingBody) return undefined

      const excerpt =
        aliasMatch && normalized.includes('e0382')
          ? 'E0382：值被移动后再次使用'
          : (matchingBody ?? document.title)
      return {
        result: {
          id: document.id,
          title: document.title,
          section: document.section,
          href: document.href,
          excerpt: excerpt.replace(/\s+/g, ' ').trim().slice(0, 180),
        },
        rank: titleMatch ? 0 : aliasMatch ? 1 : 2,
      }
    })
    .filter((match): match is { result: SearchResult; rank: number } =>
      Boolean(match),
    )
    .sort(
      (left, right) =>
        left.rank - right.rank ||
        left.result.title.localeCompare(right.result.title, 'zh-CN'),
    )
    .map((match) => match.result)
}
