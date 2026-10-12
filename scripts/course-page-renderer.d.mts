interface StaticLesson {
  id: string
  title: string
  version: string
  objectives: string[]
  terms?: Array<{ term: string; definition: string }>
  prerequisites: string[]
  source_ids: string[]
  resource_ids: string[]
  example_ids: string[]
  exercise_ids: string[]
  blocks: Array<{ type: string; text: string }>
}

interface StaticCourse {
  course_id: string
  version: string
  title: string
  locale?: string
  visibility: string
  environment: { rust_version: string }
  lessons: StaticLesson[]
  exercises: Array<{ id: string; prompt: string; hints?: string[] }>
  sources: Array<{
    id: string
    url: string
    author: string
    revision: string
    license_status: string
  }>
  resources: Array<{ id: string; visibility: string }>
}

export function isCoursePublishable(course: unknown): boolean

export function renderStaticLessonPage(input: {
  course: StaticCourse
  lesson: StaticLesson
  examples: Array<{ id: string; title: string; code: string }>
  stylesheetHref: string
}): string

export function buildStaticCoursePages(input: {
  manifestPath: string
  contentRoot: string
  distRoot: string
}): Promise<{ generatedPages: number; skippedCourses: string[] }>
