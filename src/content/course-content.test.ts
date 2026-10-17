import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
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
    external_prerequisites?: Array<{
      course_id: string
      version: string
      lesson_id: string
    }>
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

/** Create a valid standalone dependency pack with one stable lesson ID. */
async function dependencyFixture(
  courseId = 'rust-prerequisite',
  version = '2.1.0',
): Promise<CoursePackFixture> {
  const pack = await fixture()
  pack.course_id = courseId
  pack.version = version
  const lesson = lessonAt(pack, 0)
  lesson.id = `${courseId}-intro`
  lesson.prerequisites = []
  lesson.external_prerequisites = []
  return pack
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
  // Public course data needs no assessment reference; author validation can still link an optional pack.
  it('接受没有私有评测字段的公开课包并验证独立作者评测引用', async () => {
    const pack = await fixture()
    const privatePack = await privateFixture()
    expect(pack.exercises[0]?.private_assessment_id).toBeUndefined()
    expect(validateCoursePack(pack).errors).toEqual([])
    pack.exercises[0]!.private_assessment_id = 'borrowed-text-hidden-check'
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

  // Resolve an external prerequisite only against its exact course version and lesson ID.
  it('接受明确提供的匹配跨课包先修', async () => {
    const pack = await fixture()
    const dependency = await dependencyFixture()
    lessonAt(pack, 0).external_prerequisites = [
      {
        course_id: dependency.course_id,
        version: dependency.version,
        lesson_id: lessonAt(dependency, 0).id,
      },
    ]
    expect(
      validateCoursePack(pack, { dependencies: [dependency] }).errors,
    ).toEqual([])
  })

  // Missing package files, version drift, and unknown lesson IDs must fail closed.
  it('拒绝缺失或版本/单元不匹配的外部先修', async () => {
    const pack = await fixture()
    const dependency = await dependencyFixture()
    lessonAt(pack, 0).external_prerequisites = [
      {
        course_id: dependency.course_id,
        version: dependency.version,
        lesson_id: lessonAt(dependency, 0).id,
      },
    ]
    expect(validateCoursePack(pack).errors.join('\n')).toContain(
      'missing dependency course',
    )

    dependency.version = '2.2.0'
    expect(
      validateCoursePack(pack, { dependencies: [dependency] }).errors.join(
        '\n',
      ),
    ).toContain('missing dependency course')

    dependency.version = '2.1.0'
    const externalPrerequisite = lessonAt(pack, 0).external_prerequisites?.[0]
    if (!externalPrerequisite)
      throw new Error('Expected external prerequisite fixture')
    externalPrerequisite.lesson_id = 'missing-lesson'
    expect(
      validateCoursePack(pack, { dependencies: [dependency] }).errors.join(
        '\n',
      ),
    ).toContain('unknown lesson "missing-lesson"')
  })

  // External references require stable IDs and a SemVer course version; package aliases are unique.
  it('拒绝外部先修格式错误和重复依赖包', async () => {
    const pack = await fixture()
    const dependency = await dependencyFixture()
    lessonAt(pack, 0).external_prerequisites = [
      {
        course_id: dependency.course_id,
        version: 'latest',
        lesson_id: lessonAt(dependency, 0).id,
      },
    ]
    expect(
      validateCoursePack(pack, { dependencies: [dependency] }).errors.join(
        '\n',
      ),
    ).toContain(
      'external_prerequisites[0].version: does not match required format',
    )

    lessonAt(pack, 0).external_prerequisites = [
      {
        course_id: dependency.course_id,
        version: dependency.version,
        lesson_id: lessonAt(dependency, 0).id,
      },
    ]
    expect(
      validateCoursePack(pack, {
        dependencies: [dependency, { ...dependency }],
      }).errors.join('\n'),
    ).toContain('duplicate course package')
  })

  // A same-package external edge is invalid and cross-package cycles are rejected.
  it('拒绝自引用和跨课包先修循环', async () => {
    const pack = await fixture()
    const ownLesson = lessonAt(pack, 0)
    ownLesson.external_prerequisites = [
      {
        course_id: pack.course_id,
        version: pack.version,
        lesson_id: ownLesson.id,
      },
    ]
    expect(validateCoursePack(pack).errors.join('\n')).toContain(
      'use prerequisites for lessons in the same course package',
    )

    const dependency = await dependencyFixture()
    ownLesson.external_prerequisites = [
      {
        course_id: dependency.course_id,
        version: dependency.version,
        lesson_id: lessonAt(dependency, 0).id,
      },
    ]
    lessonAt(dependency, 0).external_prerequisites = [
      {
        course_id: pack.course_id,
        version: pack.version,
        lesson_id: ownLesson.id,
      },
    ]
    expect(
      validateCoursePack(pack, { dependencies: [dependency] }).errors.join(
        '\n',
      ),
    ).toContain('prerequisite cycle')
  })

  // The CLI loads every repeatable --dependency argument before validating the graph.
  it('CLI 可重复加载多个外部课包依赖', async () => {
    const pack = await fixture()
    const dependencyOne = await dependencyFixture(
      'rust-prerequisite-one',
      '1.0.0',
    )
    const dependencyTwo = await dependencyFixture(
      'rust-prerequisite-two',
      '2.0.0',
    )
    lessonAt(pack, 0).external_prerequisites = [
      {
        course_id: dependencyOne.course_id,
        version: dependencyOne.version,
        lesson_id: lessonAt(dependencyOne, 0).id,
      },
      {
        course_id: dependencyTwo.course_id,
        version: dependencyTwo.version,
        lesson_id: lessonAt(dependencyTwo, 0).id,
      },
    ]

    const directory = await mkdtemp(join(tmpdir(), 'course-dependencies-'))
    try {
      const packPath = join(directory, 'pack.json')
      const dependencyOnePath = join(directory, 'dependency-one.json')
      const dependencyTwoPath = join(directory, 'dependency-two.json')
      await Promise.all([
        writeFile(packPath, JSON.stringify(pack)),
        writeFile(dependencyOnePath, JSON.stringify(dependencyOne)),
        writeFile(dependencyTwoPath, JSON.stringify(dependencyTwo)),
      ])
      const result = spawnSync(
        process.execPath,
        [
          resolve(root, 'scripts/course-content.mjs'),
          'validate',
          packPath,
          '--dependency',
          dependencyOnePath,
          '--dependency',
          dependencyTwoPath,
        ],
        { cwd: root, encoding: 'utf8' },
      )
      expect(result.status).toBe(0)
      expect(result.stdout).toContain('Valid course pack:')

      const invalidArgument = spawnSync(
        process.execPath,
        [
          resolve(root, 'scripts/course-content.mjs'),
          'validate',
          packPath,
          '--dependency',
          '--unknown-option',
        ],
        { cwd: root, encoding: 'utf8' },
      )
      expect(invalidArgument.status).toBe(2)
      expect(invalidArgument.stderr).toContain('Usage:')
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
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
