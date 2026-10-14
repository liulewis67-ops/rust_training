import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { lessons } from '../data/lessons'
import {
  validateCoursePack,
  validateLegacyCourseMap,
} from '../../scripts/course-content.mjs'

interface CoursePackFixture {
  course_id: string
  version: string
  environment: Record<string, string>
  lessons: Array<{
    id: string
    title: string
    prerequisites: string[]
    source_ids: string[]
    resource_ids: string[]
    exercise_ids: string[]
    example_ids: string[]
    [key: string]: unknown
  }>
  exercises: Array<Record<string, unknown>>
  sources: Array<Record<string, unknown>>
  resources: Array<Record<string, unknown>>
}

interface SampleManifestFixture {
  examples: Array<{ id: string }>
}

const root = resolve(import.meta.dirname, '../..')
const fixturePath = resolve(root, 'content/borrowed-text.course.json')
const privateFixturePath = resolve(
  root,
  'content/borrowed-text.assessment.json',
)

/** 加载示例公开课包，供结构和语义验证场景复用。 */
async function fixture(): Promise<CoursePackFixture> {
  return JSON.parse(await readFile(fixturePath, 'utf8')) as CoursePackFixture
}

/** 加载与公开课程分开的私有评测样例。 */
async function privateFixture(): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(privateFixturePath, 'utf8')) as Record<
    string,
    unknown
  >
}

/** 加载样例清单，供课程与代码示例引用一致性检查使用。 */
async function sampleFixture(): Promise<SampleManifestFixture> {
  return JSON.parse(
    await readFile(resolve(root, 'content/course-samples.json'), 'utf8'),
  ) as SampleManifestFixture
}

/** 读取验收样例中已知存在的课程，避免在测试中使用非空断言。 */
function lessonAt(
  pack: CoursePackFixture,
  index: number,
): CoursePackFixture['lessons'][number] {
  const lesson = pack.lessons[index]
  if (!lesson) throw new Error(`Expected fixture lesson at index ${index}`)
  return lesson
}

// Group schema, reference-graph and visibility checks for the course-pack contract.
describe('课程包结构校验', () => {
  // Use one valid public pack and a separately stored private assessment pack as the baseline.
  it('接受完整课包并保留公开/私有资源边界', async () => {
    const pack = await fixture()
    const privatePack = await privateFixture()
    expect(validateCoursePack(pack, { privatePack }).errors).toEqual([])
  })

  // Course metadata and referenced code examples must claim the same compiler environment.
  it('拒绝与样例清单工具链或 Edition 不一致的课包', async () => {
    const pack = await fixture()
    const samples = await sampleFixture()
    expect(validateCoursePack(pack, { samples }).errors).toEqual([])

    pack.environment.rust_version = '1.90.0'
    pack.environment.edition = '2021'
    expect(validateCoursePack(pack, { samples }).errors).toEqual([
      'course.environment.rust_version: must match sample manifest rust_version ("1.95.0")',
      'course.environment.edition: must match sample manifest edition ("2024")',
    ])
  })

  // Public lesson example IDs must resolve against the independently verified sample manifest.
  it('拒绝课程指向不存在的代码样例', async () => {
    const pack = await fixture()
    const samples = await sampleFixture()
    expect(validateCoursePack(pack, { samples }).errors).toEqual([])
    lessonAt(pack, 0).example_ids.push('missing-example')
    expect(validateCoursePack(pack, { samples }).errors.join('\n')).toContain(
      'lessons[0].example_ids[3]',
    )
  })

  // Combine independent shape failures to confirm diagnostics point to the exact field.
  it('对缺字段、重复稳定 ID 和错误字段给出路径', async () => {
    const pack = await fixture()
    delete pack.environment.rust_version
    pack.exercises[0].type = 'unknown-question-type'
    pack.lessons.push({ ...lessonAt(pack, 0), title: '' })
    const errors = validateCoursePack(pack).errors.join('\n')
    expect(errors).toContain('environment.rust_version')
    expect(errors).toContain('course.exercises[0].type')
    expect(errors).toContain('lessons[1].id')
    expect(errors).toContain('lessons[1].title')
  })

  // Break each reference category and add a two-node prerequisite cycle.
  it('拒绝不存在的先修、来源和资源引用以及先修循环', async () => {
    const pack = await fixture()
    const lesson = lessonAt(pack, 0)
    lesson.prerequisites = ['missing-lesson']
    lesson.source_ids = ['missing-source']
    lesson.resource_ids = ['private-answer']
    const privatePack = await privateFixture()
    const errors = validateCoursePack(pack, { privatePack }).errors.join('\n')
    expect(errors).toContain('lessons[0].prerequisites[0]')
    expect(errors).toContain('lessons[0].source_ids[0]')
    expect(errors).toContain('lessons[0].resource_ids[0]')

    const nextLesson = {
      ...lesson,
      id: 'borrowed-text-second-token',
      prerequisites: [lesson.id],
      exercise_ids: [],
    }
    pack.lessons.push(nextLesson)
    lesson.prerequisites = [nextLesson.id]
    expect(validateCoursePack(pack).errors.join('\n')).toContain('cycle')
  })

  // Verify that secret answers and private paths cannot enter public resources.
  it('禁止公开包包含私有答案或将私有资源标为公开', async () => {
    const pack = await fixture()
    pack.lessons[0].reference_answer = 'secret'
    pack.resources.push({
      id: 'secret',
      visibility: 'public',
      path: 'private/secret.md',
      media_type: 'text/markdown',
    })
    const errors = validateCoursePack(pack).errors.join('\n')
    expect(errors).toContain('reference_answer')
    expect(errors).toContain('resources[1].path')
  })
})

// Keep every prototype route ID mapped while the new course schema evolves.
describe('旧课程标识映射', () => {
  // The combined application catalog already includes the advanced lesson array.
  it('覆盖并保留原型中的全部36个稳定ID', async () => {
    const mapping = JSON.parse(
      await readFile(resolve(root, 'content/legacy-course-map.json'), 'utf8'),
    ) as Record<string, string>
    // Read the combined catalog, which already includes the advanced lesson array.
    const prototypeIds = lessons.map((lesson) => lesson.id)
    expect(prototypeIds).toHaveLength(36)
    expect(Object.keys(mapping).sort()).toEqual([...prototypeIds].sort())
    expect(Object.values(mapping)).toEqual(prototypeIds)
    expect(validateLegacyCourseMap(mapping, prototypeIds).errors).toEqual([])
  })
})
