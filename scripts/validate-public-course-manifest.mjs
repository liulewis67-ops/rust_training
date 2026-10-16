import { access, readFile } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const contentRoot = resolve(repositoryRoot, 'content')
const releaseRoot = resolve(contentRoot, 'releases')
const manifest = JSON.parse(
  await readFile(resolve(contentRoot, 'public-course-manifest.json'), 'utf8'),
)
const errors = []

function isInside(root, candidate) {
  const pathFromRoot = relative(root, candidate)
  return (
    pathFromRoot === '' ||
    (!pathFromRoot.startsWith(`..${sep}`) &&
      pathFromRoot !== '..' &&
      !isAbsolute(pathFromRoot))
  )
}

async function requireFile(path, description) {
  try {
    await access(path)
  } catch {
    errors.push(`${description}: file does not exist`)
  }
}

async function fileExists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function validateReleasedMarkdown(lessonId, path, description) {
  let markdown
  try {
    markdown = await readFile(path, 'utf8')
  } catch {
    errors.push(`${description}: file does not exist`)
    return
  }
  if (!new RegExp(`^#\\s+${lessonId}(?:[：:\\s]|$)`, 'm').test(markdown))
    errors.push(`${description}: missing matching lesson title`)
  if (/^#\s+.*(?:草稿|draft)/im.test(markdown))
    errors.push(`${description}: draft title cannot be published`)
  if (
    /R1|私有评测|隐藏测试|课程预写材料|^>\s*(?:状态|作者说明)[：:]/m.test(
      markdown,
    )
  )
    errors.push(`${description}: contains author or platform-only text`)
  for (const [, link] of markdown.matchAll(/\]\(([^)]+\.zip)(?:#[^)]*)?\)/gi)) {
    const assetName = link.split(/[\\/]/).pop()
    if (assetName)
      await requireFile(
        resolve(releaseRoot, assetName),
        `${description} asset ${assetName}`,
      )
  }
  return markdown
}

function requireUniqueStrings(values, name) {
  if (
    !Array.isArray(values) ||
    values.some((value) => typeof value !== 'string')
  ) {
    errors.push(`${name}: expected an array of strings`)
    return []
  }
  const unique = new Set(values)
  if (unique.size !== values.length) errors.push(`${name}: duplicate entries`)
  return values
}

const courseFiles = requireUniqueStrings(manifest.course_files, 'course_files')
const markdownLessons = requireUniqueStrings(
  manifest.markdown_lessons,
  'markdown_lessons',
)

for (const fileName of courseFiles) {
  if (
    isAbsolute(fileName) ||
    fileName.includes('..') ||
    fileName.includes('/') ||
    fileName.includes('\\')
  ) {
    errors.push(`course_files: unsafe package path "${fileName}"`)
    continue
  }
  const packagePath = resolve(contentRoot, fileName)
  await requireFile(packagePath, `course_files[${fileName}]`)
  let course
  try {
    course = JSON.parse(await readFile(packagePath, 'utf8'))
  } catch {
    errors.push(`course_files[${fileName}]: invalid JSON`)
    continue
  }
  if (course.visibility !== 'public')
    errors.push(`course_files[${fileName}]: package visibility is not public`)
  const sourceIds = new Set((course.sources ?? []).map((source) => source.id))
  const resourceIds = new Set(
    (course.resources ?? []).map((resource) => resource.id),
  )
  if (
    !(course.sources ?? []).every((source) =>
      ['approved', 'original'].includes(source.license_status),
    )
  )
    errors.push(
      `course_files[${fileName}]: source license review is incomplete`,
    )
  for (const resource of course.resources ?? []) {
    if (resource.visibility !== 'public')
      errors.push(
        `course_files[${fileName}]: resource ${resource.id} is not public`,
      )
    if (typeof resource.path !== 'string' || isAbsolute(resource.path)) {
      errors.push(
        `course_files[${fileName}]: resource ${resource.id} has an unsafe path`,
      )
      continue
    }
    const resourcePath = resolve(contentRoot, resource.path)
    if (!isInside(contentRoot, resourcePath)) {
      errors.push(
        `course_files[${fileName}]: resource ${resource.id} escapes content/`,
      )
      continue
    }
    await requireFile(
      resourcePath,
      `course_files[${fileName}] resource ${resource.id}`,
    )
  }
  const exerciseIds = new Set(
    (course.exercises ?? []).map((exercise) => exercise.id),
  )
  for (const lesson of course.lessons ?? []) {
    for (const sourceId of lesson.source_ids ?? []) {
      if (!sourceIds.has(sourceId))
        errors.push(`${lesson.id}: unknown source ${sourceId}`)
    }
    for (const resourceId of lesson.resource_ids ?? []) {
      if (!resourceIds.has(resourceId))
        errors.push(`${lesson.id}: unknown resource ${resourceId}`)
    }
    for (const exerciseId of lesson.exercise_ids ?? []) {
      if (!exerciseIds.has(exerciseId))
        errors.push(`${lesson.id}: unknown exercise ${exerciseId}`)
    }
  }
}

for (const lessonId of markdownLessons) {
  if (!/^M\d{2}-L\d{2}$/.test(lessonId)) {
    errors.push(`markdown_lessons: invalid lesson ID "${lessonId}"`)
    continue
  }
  const markdownPath = resolve(releaseRoot, `${lessonId.toLowerCase()}.md`)
  if (!isInside(releaseRoot, markdownPath)) {
    errors.push(`markdown_lessons: unsafe lesson path "${lessonId}"`)
    continue
  }
  const markdown = await validateReleasedMarkdown(
    lessonId,
    markdownPath,
    `markdown_lessons[${lessonId}]`,
  )
  if (markdown && !/^##\s+来源\s*$/m.test(markdown))
    errors.push(`${lessonId}: missing source section`)
  const exercisePath = resolve(
    releaseRoot,
    `${lessonId.toLowerCase()}-exercises.md`,
  )
  if (await fileExists(exercisePath))
    await validateReleasedMarkdown(
      lessonId,
      exercisePath,
      `markdown_lessons[${lessonId}] exercises`,
    )
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join('\n'))
  process.exitCode = 1
} else {
  console.log(
    `Valid public manifest: ${courseFiles.length} course package(s), ${markdownLessons.length} Markdown lesson(s)`,
  )
}
