import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'

const PUBLIC_SAMPLE_KINDS = new Set(['runnable', 'fragment', 'compile_fail'])

/** Escape authored text and attributes before placing them in static HTML. */
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[character]
  })
}

/** Remove raw HTML blocks and tags before parsing the supported Markdown subset. */
function stripRawHtml(markdown) {
  return markdown
    .replace(/<!--([\s\S]*?)-->/g, '')
    .replace(
      /<(script|style|iframe|object|embed|svg|math)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
      '',
    )
    .replace(/<\/?[a-z][^>]*>/gi, '')
}

/** Allow only absolute HTTPS destinations from reviewed course text. */
function safeHttpsHref(destination) {
  try {
    const url = new URL(destination)
    return url.protocol === 'https:' ? url.href : undefined
  } catch {
    return undefined
  }
}

/** Render bold, emphasis, code and HTTPS links without evaluating HTML. */
function renderInline(markdown) {
  const tokenPattern = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g
  return markdown
    .split(tokenPattern)
    .map((part) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return `<strong>${escapeHtml(part.slice(2, -2))}</strong>`
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return `<code>${escapeHtml(part.slice(1, -1))}</code>`
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return `<em>${escapeHtml(part.slice(1, -1))}</em>`
      }
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part)
      if (linkMatch) {
        const [, label, destination] = linkMatch
        const href = safeHttpsHref(destination)
        return href
          ? `<a href="${escapeHtml(href)}" rel="noopener noreferrer">${escapeHtml(label)}</a>`
          : `<span>${escapeHtml(label)}</span>`
      }
      return escapeHtml(part)
    })
    .join('')
}

/** Render safe paragraphs from Markdown authored in a public course pack. */
function renderMarkdown(markdown) {
  return stripRawHtml(markdown)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${renderInline(paragraph)}</p>`)
    .join('\n')
}

/** Reject private content, unresolved sources and unreviewed source licenses. */
export function isCoursePublishable(course) {
  if (!course || course.visibility !== 'public') return false
  const sourceIds = new Set(course.sources?.map((source) => source.id) ?? [])
  const resourceById = new Map(
    (course.resources ?? []).map((resource) => [resource.id, resource]),
  )
  const hasPublicSources = (course.sources ?? []).every((source) => {
    return ['approved', 'original'].includes(source.license_status)
  })
  const hasPublicResources = (course.resources ?? []).every((resource) => {
    return resource.visibility === 'public'
  })
  const hasResolvedReferences = (course.lessons ?? []).every((lesson) => {
    return (
      lesson.source_ids.every((id) => sourceIds.has(id)) &&
      lesson.resource_ids.every((id) => resourceById.has(id))
    )
  })
  return hasPublicSources && hasPublicResources && hasResolvedReferences
}

/** Build one static lesson page using only fields declared public by its course pack. */
export function renderStaticLessonPage({
  course,
  lesson,
  examples,
  stylesheetHref,
}) {
  if (!isCoursePublishable(course)) {
    throw new Error(
      `Course ${course?.course_id ?? 'unknown'} is not publishable`,
    )
  }
  if (!course.lessons.some((entry) => entry.id === lesson.id)) {
    throw new Error(
      `Lesson ${lesson.id} is not part of course ${course.course_id}`,
    )
  }
  if (!/^\/assets\/[a-zA-Z0-9._/-]+\.css$/.test(stylesheetHref)) {
    throw new Error('Static course stylesheet must be a local built CSS asset')
  }
  const sources = new Map(course.sources.map((source) => [source.id, source]))
  const exercises = new Map(
    course.exercises.map((exercise) => [exercise.id, exercise]),
  )
  const selectedExamples = new Set(lesson.example_ids)
  const selectedExercises = new Set(lesson.exercise_ids)
  const selectedSources = lesson.source_ids.map((id) => sources.get(id))
  if (selectedSources.some((source) => !source)) {
    throw new Error(`Lesson ${lesson.id} references a missing source`)
  }

  const body = lesson.blocks
    .map((block) => renderMarkdown(block.text))
    .join('\n')
  const termSection = lesson.terms?.length
    ? `<section class="static-course-section"><h2>术语</h2><dl>${lesson.terms.map((term) => `<dt>${escapeHtml(term.term)}</dt><dd>${escapeHtml(term.definition)}</dd>`).join('\n')}</dl></section>`
    : ''
  const exampleSections = examples
    .filter((example) => selectedExamples.has(example.id))
    .map((example) => {
      return `<section class="static-course-example"><h3>${escapeHtml(example.title)}</h3><pre><code>${escapeHtml(example.code)}</code></pre></section>`
    })
    .join('\n')
  const exerciseSections = [...selectedExercises]
    .map((id) => exercises.get(id))
    .filter(Boolean)
    .map((exercise) => {
      const hints = exercise.hints?.length
        ? `<details><summary>分层提示</summary><ol>${exercise.hints.map((hint) => `<li>${escapeHtml(hint)}</li>`).join('')}</ol></details>`
        : ''
      return `<section class="static-course-exercise"><h3>练习</h3><p>${escapeHtml(exercise.prompt)}</p>${hints}</section>`
    })
    .join('\n')
  const sourceList = selectedSources
    .map((source) => {
      const href = safeHttpsHref(source.url)
      if (!href) throw new Error(`Course source ${source.id} must use HTTPS`)
      return `<li><a href="${escapeHtml(href)}" rel="noopener noreferrer">${escapeHtml(source.author)}</a><span>${escapeHtml(source.revision)}</span></li>`
    })
    .join('\n')
  const prerequisites = lesson.prerequisites.length
    ? lesson.prerequisites.map(escapeHtml).join('、')
    : '无'

  return `<!doctype html>
<html lang="${escapeHtml(course.locale ?? 'zh-CN')}">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="${escapeHtml(lesson.objectives.join('；'))}">
    <link rel="stylesheet" href="${escapeHtml(stylesheetHref)}">
    <title>${escapeHtml(lesson.title)} · ${escapeHtml(course.title)}</title>
  </head>
  <body>
    <main class="static-course-page">
      <a class="static-course-home" href="/">返回首页</a>
      <header class="static-course-heading">
        <p>${escapeHtml(course.course_id)} · v${escapeHtml(course.version)} · ${escapeHtml(course.environment.rust_version)}</p>
        <h1>${escapeHtml(lesson.title)}</h1>
        <p>${escapeHtml(lesson.objectives.join('；'))}</p>
        <dl><dt>课程版本</dt><dd>${escapeHtml(course.version)}</dd><dt>先修</dt><dd>${prerequisites}</dd></dl>
      </header>
      <section class="static-course-section"><h2>课程正文</h2>${body}</section>
      ${termSection}
      ${exampleSections ? `<section class="static-course-section"><h2>代码示例</h2>${exampleSections}</section>` : ''}
      ${exerciseSections ? `<section class="static-course-section">${exerciseSections}</section>` : ''}
      ${sourceList ? `<section class="static-course-section"><h2>来源</h2><ul>${sourceList}</ul></section>` : ''}
    </main>
  </body>
</html>
`
}

/** Resolve a manifest path and refuse any file outside its designated content root. */
function resolveInside(root, relativePath) {
  if (typeof relativePath !== 'string' || isAbsolute(relativePath)) {
    throw new Error('Course build paths must be relative')
  }
  const resolvedRoot = resolve(root)
  const resolvedPath = resolve(resolvedRoot, relativePath)
  const pathFromRoot = relative(resolvedRoot, resolvedPath)
  if (
    pathFromRoot === '..' ||
    pathFromRoot.startsWith(`..${sep}`) ||
    isAbsolute(pathFromRoot)
  ) {
    throw new Error(`Course build path escapes its root: ${relativePath}`)
  }
  return resolvedPath
}

/** Generate static pages only for course files explicitly cleared for public release. */
export async function buildStaticCoursePages({
  manifestPath,
  contentRoot,
  distRoot,
}) {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  if (!Array.isArray(manifest.course_files)) {
    throw new Error('Public course manifest must contain a course_files array')
  }
  if (manifest.course_files.length === 0) {
    return { generatedPages: 0, skippedCourses: [] }
  }

  const indexHtml = await readFile(resolve(distRoot, 'index.html'), 'utf8')
  const stylesheetHref = /href="(\/assets\/[^\"]+\.css)"/.exec(indexHtml)?.[1]
  if (!stylesheetHref)
    throw new Error('Built application stylesheet was not found')
  const sampleManifest = JSON.parse(
    await readFile(resolve(contentRoot, 'course-samples.json'), 'utf8'),
  )
  const sampleById = new Map(
    sampleManifest.examples
      .filter((example) => PUBLIC_SAMPLE_KINDS.has(example.kind))
      .map((example) => [example.id, example]),
  )
  let generatedPages = 0

  for (const courseFile of manifest.course_files) {
    const coursePath = resolveInside(contentRoot, courseFile)
    const course = JSON.parse(await readFile(coursePath, 'utf8'))
    if (!isCoursePublishable(course)) {
      throw new Error(
        `Refusing to publish unreviewed course ${course.course_id}`,
      )
    }
    const examples = []
    for (const lesson of course.lessons) {
      for (const exampleId of lesson.example_ids) {
        const sample = sampleById.get(exampleId)
        if (!sample) {
          throw new Error(`No public sample source for example ${exampleId}`)
        }
        const samplePath = resolveInside(
          resolve(contentRoot, 'samples'),
          sample.source,
        )
        examples.push({
          id: sample.id,
          title:
            sample.kind === 'runnable'
              ? '完整可运行示例'
              : sample.kind === 'fragment'
                ? '教学片段（不可运行）'
                : `预期编译失败 · ${sample.expected_error_code}`,
          code: await readFile(samplePath, 'utf8'),
        })
      }
    }
    for (const lesson of course.lessons) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(lesson.id)) {
        throw new Error(`Invalid static lesson ID: ${lesson.id}`)
      }
      const outputPath = resolve(distRoot, 'lessons', lesson.id, 'index.html')
      await mkdir(resolve(distRoot, 'lessons', lesson.id), { recursive: true })
      await writeFile(
        outputPath,
        renderStaticLessonPage({ course, lesson, examples, stylesheetHref }),
        'utf8',
      )
      generatedPages += 1
    }
  }
  return { generatedPages, skippedCourses: [] }
}
