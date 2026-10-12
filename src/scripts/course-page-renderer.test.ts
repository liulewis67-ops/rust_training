import { expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import {
  buildStaticCoursePages,
  isCoursePublishable,
  renderStaticLessonPage,
} from '../../scripts/course-page-renderer.mjs'

const approvedCourse = {
  course_id: 'safe-course',
  version: '1.2.0',
  title: '静态课程标题',
  visibility: 'public',
  locale: 'zh-CN',
  environment: { rust_version: '1.95.0' },
  lessons: [
    {
      id: 'safe-lesson',
      version: '1.2.0',
      title: '切片与借用',
      objectives: ['说明生命周期关系'],
      prerequisites: ['rust-basics'],
      source_ids: ['original-notes'],
      resource_ids: [],
      example_ids: ['safe-example'],
      exercise_ids: ['safe-exercise'],
      blocks: [
        {
          type: 'markdown',
          text: '正文 **安全内容** <script>alert(1)</script>',
        },
      ],
    },
  ],
  exercises: [
    {
      id: 'safe-exercise',
      prompt: '解释借用关系',
      hints: ['观察输入和返回值'],
      private_assessment_id: 'must-not-be-rendered',
    },
  ],
  sources: [
    {
      id: 'original-notes',
      url: 'https://example.com/source',
      author: '课程作者',
      revision: '原始内容 v1',
      accessed_at: '2026-10-12',
      license_status: 'original',
    },
  ],
  resources: [],
}

// Only public content with reviewed source licenses may enter a static cache.
it('rejects private, unreviewed, or private-resource packages', async () => {
  expect(isCoursePublishable(approvedCourse)).toBe(true)
  expect(
    isCoursePublishable({ ...approvedCourse, visibility: 'private' }),
  ).toBe(false)
  expect(
    isCoursePublishable({
      ...approvedCourse,
      sources: [
        { ...approvedCourse.sources[0], license_status: 'review_required' },
      ],
    }),
  ).toBe(false)
  expect(
    isCoursePublishable({
      ...approvedCourse,
      resources: [{ id: 'private', visibility: 'private' }],
    }),
  ).toBe(false)

  const existingPack = JSON.parse(
    await readFile(
      resolve(import.meta.dirname, '../../content/borrowed-text.course.json'),
      'utf8',
    ),
  )
  expect(isCoursePublishable(existingPack)).toBe(false)
})

// Static pages expose only public lesson data, escape unsafe content, and need no JavaScript.
it('renders a cacheable lesson without private feedback or executable markup', () => {
  const html = renderStaticLessonPage({
    course: approvedCourse,
    lesson: approvedCourse.lessons[0],
    examples: [{ id: 'safe-example', title: '安全示例', code: 'fn main() {}' }],
    stylesheetHref: '/assets/app.css',
  })

  expect(html).toContain('safe-course · v1.2.0')
  expect(html).toContain('rust-basics')
  expect(html).toContain('fn main() {}')
  expect(html).toContain('https://example.com/source')
  expect(html).not.toContain('<script')
  expect(html).not.toContain('alert(1)')
  expect(html).not.toContain('must-not-be-rendered')
})

// Unsafe schemes stay as plain labels, while safe text formatting remains readable.
it('filters unsafe Markdown links and escapes authored HTML', () => {
  const html = renderStaticLessonPage({
    course: approvedCourse,
    lesson: {
      ...approvedCourse.lessons[0],
      blocks: [
        {
          type: 'markdown',
          text: '[bad](javascript:alert(1)) [safe](https://example.com) **strong** <img src=x onerror=alert(2)>',
        },
      ],
    },
    examples: [],
    stylesheetHref: '/assets/app.css',
  })

  expect(html).toContain('<strong>')
  expect(html).toContain('>bad</span>')
  expect(html).toContain('href="https://example.com/"')
  expect(html).not.toContain('<img')
  expect(html).not.toContain('onerror=')
})

// The build step emits a cacheable route without JavaScript for explicitly approved packages.
it('generates a no-script static route from an allowlisted course package', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'course-pages-test-'))
  const contentRoot = resolve(root, 'content')
  const distRoot = resolve(root, 'dist')
  await mkdir(resolve(contentRoot, 'samples'), { recursive: true })
  await mkdir(distRoot, { recursive: true })
  try {
    await writeFile(
      resolve(contentRoot, 'public-course-manifest.json'),
      JSON.stringify({ course_files: ['approved.json'] }),
    )
    await writeFile(
      resolve(contentRoot, 'approved.json'),
      JSON.stringify(approvedCourse),
    )
    await writeFile(
      resolve(contentRoot, 'course-samples.json'),
      JSON.stringify({
        examples: [{ id: 'safe-example', kind: 'runnable', source: 'main.rs' }],
      }),
    )
    await writeFile(resolve(contentRoot, 'samples/main.rs'), 'fn main() {}')
    await writeFile(
      resolve(distRoot, 'index.html'),
      '<link rel="stylesheet" href="/assets/app.css"><script src="/assets/app.js"></script>',
    )

    const result = await buildStaticCoursePages({
      manifestPath: resolve(contentRoot, 'public-course-manifest.json'),
      contentRoot,
      distRoot,
    })
    const page = await readFile(
      resolve(distRoot, 'lessons/safe-lesson/index.html'),
      'utf8',
    )

    expect(result).toEqual({ generatedPages: 1, skippedCourses: [] })
    expect(page).toContain('正文 <strong>安全内容</strong>')
    expect(page).not.toMatch(/<script\b/i)
    expect(page).not.toContain('app.js')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
