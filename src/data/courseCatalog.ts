import { learningTrack } from './learningTrack'
import publicManifest from '../../content/public-course-manifest.json'

interface ModuleDefinition {
  id: string
  title: string
  phaseId: string
  outcome: string
}

export interface CourseLesson {
  id: string
  title: string
  content: string
  exercises: string[]
}

export interface CourseModule extends ModuleDefinition {
  lessons: CourseLesson[]
}

const moduleDefinitions: ModuleDefinition[] = [
  { id: 'M01', title: '开发循环与语言入门', phaseId: 'S1', outcome: '建立工具链认知，完成从需求判断到小程序验证的开发循环。' },
  { id: 'M02', title: '值、函数与控制流', phaseId: 'S1', outcome: '使用表达式、函数和边界检查实现可靠的小型计算逻辑。' },
  { id: 'M03', title: '结构化业务数据', phaseId: 'S1', outcome: '用结构体、枚举和模块边界表达业务数据与状态。' },
  { id: 'M04', title: '所有权与资源流动', phaseId: 'S2', outcome: '追踪值的 owner、move 与 Drop，设计清楚的资源边界。' },
  { id: 'M05', title: '引用、借用与切片', phaseId: 'S2', outcome: '用借用 API 表达访问权限，安全处理文本与 UTF-8 边界。' },
  { id: 'M06', title: '生命周期与返回设计', phaseId: 'S2', outcome: '判断引用关系，并在借用视图与拥有型结果之间作出选择。' },
  { id: 'M07', title: 'Trait 与泛型', phaseId: 'S3', outcome: '使用 trait 与泛型建立有边界、可替换的抽象。' },
  { id: 'M08', title: '集合、闭包与迭代', phaseId: 'S3', outcome: '在所有权约束下完成集合访问、转换和统计。' },
  { id: 'M09', title: '错误与边界建模', phaseId: 'S3', outcome: '传播上下文明确的错误，并区分库边界与应用边界。' },
  { id: 'M10', title: '可测试的 CLI 工程', phaseId: 'S4', outcome: '将业务逻辑、命令行、测试、依赖和文档组合成可交付工具。' },
  { id: 'M11', title: '智能指针与资源管理', phaseId: 'S4', outcome: '按所有权关系选择 Box、Rc、Arc、RefCell 与 Weak。' },
  { id: 'M12', title: '线程与同步', phaseId: 'S4', outcome: '安全分享状态，用锁和有界 channel 管理并行工作。' },
  { id: 'M13', title: 'Future 与运行时', phaseId: 'S5', outcome: '理解 Future、task 调度与同步阻塞的边界。' },
  { id: 'M14', title: '异步协作与背压', phaseId: 'S5', outcome: '收集任务结果，用队列和并发预算控制工作负载。' },
  { id: 'M15', title: '取消、退出与验证', phaseId: 'S5', outcome: '设计取消安全的任务、限时退出和可重复异步测试。' },
  { id: 'M16', title: '路由、请求与响应', phaseId: 'S6', outcome: '为 Axum API 建立清楚的 HTTP 契约与输入边界。' },
  { id: 'M17', title: '状态、中间件与边界', phaseId: 'S6', outcome: '组织应用状态、错误、Tower 中间件和可测试接口。' },
  { id: 'M18', title: 'SQLx 与持久化', phaseId: 'S6', outcome: '用 SQL、迁移、事务和索引维护持久化不变量。' },
  { id: 'M19', title: '身份、权限与输入边界', phaseId: 'S7', outcome: '验证身份与资源权限，守住秘密、输入和日志边界。' },
  { id: 'M20', title: '可靠接口与事件', phaseId: 'S7', outcome: '处理幂等、重试、事件订阅和后台任务恢复。' },
  { id: 'M21', title: '观测与故障定位', phaseId: 'S7', outcome: '以日志、指标、最小复现和回归证据定位故障。' },
  { id: 'M22', title: '构建与发布', phaseId: 'S8', outcome: '规划目标平台、秘密注入、部署、迁移与回滚。' },
  { id: 'M23', title: '性能与稳定性', phaseId: 'S8', outcome: '用测量、容量预算和恢复演练证明服务行为。' },
  { id: 'M24', title: '毕业交付与维护', phaseId: 'S8', outcome: '从需求与评审走到完整交付、运行手册和维护决策。' },
]

const authoredMarkdown = {
  ...import.meta.glob('../../content/releases/m*.md', {
    eager: true,
    query: '?raw',
    import: 'default',
  }),
} as Record<string, string>
const publicLessonArchives = import.meta.glob('../../content/releases/*.zip', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>
const releasedMarkdownLessons = new Set<string>(
  publicManifest.markdown_lessons,
)

/** Resolve only ZIP files explicitly stored in the public lesson asset folder. */
export function resolveCourseAsset(destination: string): string | undefined {
  const fileName = destination.split(/[?#]/, 1)[0]?.split(/[\\/]/).pop()
  if (!fileName) return undefined
  const match = Object.entries(publicLessonArchives).find(([path]) => {
    return path.split('/').pop() === fileName
  })
  return match?.[1]
}

/** Keep author grading notes and private solution folders outside the learner catalog. */
function learnerFiles(moduleId: string, lessonId: string): { name: string; markdown: string }[] {
  const prefix = `${moduleId.toLowerCase()}-${lessonId.toLowerCase()}`
  const files = Object.entries(authoredMarkdown)
    .filter(([path]) => {
      const name = path.split('/').pop()?.toLowerCase() ?? ''
      return (
        name.startsWith(prefix) &&
        (name[prefix.length] === '-' || name[prefix.length] === '.') &&
        !name.includes('evaluation') &&
        !name.includes('rubric') &&
        !name.includes('course-draft') &&
        !name.includes('resource-check') &&
        name.endsWith('.md')
      )
    })
    .sort(([left], [right]) => {
      // Prefer the canonical root draft if its public copy has the same filename.
      return Number(left.includes('/public/')) - Number(right.includes('/public/')) || left.localeCompare(right)
    })
    .map(([path, markdown]) => ({
      name: path.split('/').pop()?.toLowerCase() ?? '',
      markdown,
    }))
  const seenNames = new Set<string>()
  return files.filter(({ name }) => {
    if (seenNames.has(name)) return false
    seenNames.add(name)
    return true
  })
}

/** Turn the authored lesson files into a stable six-lesson catalog for every module. */
export const courseModules: CourseModule[] = moduleDefinitions.map((module) => ({
  ...module,
  lessons: Array.from({ length: 6 }, (_, index) => {
    const id = `L${String(index + 1).padStart(2, '0')}`
    const released = releasedMarkdownLessons.has(`${module.id}-${id}`)
    const files = released ? learnerFiles(module.id, id) : []
    const body = files.find(({ name }) => !name.includes('exercises'))?.markdown ?? ''
    const heading = /^#\s+(?:M\d{2}-L\d{2}(?:[:：]\s*|\s+))?(.+)$/m.exec(body)
    return {
      id,
      title: heading?.[1]?.trim() ?? `第 ${index + 1} 节`,
      content: body,
      exercises: files
        .filter(({ name }) => name.includes('exercises'))
        .map(({ markdown }) => markdown),
    }
  }),
}))

/** Resolve a lesson using catalog IDs from a browser route. */
export function findCourseLesson(moduleId: string, lessonId: string): CourseLesson | undefined {
  return courseModules
    .find((module) => module.id.toLowerCase() === moduleId.toLowerCase())
    ?.lessons.find((lesson) => lesson.id.toLowerCase() === lessonId.toLowerCase())
}

/** Resolve a module row used by course reading breadcrumbs and navigation. */
export function findCourseModule(moduleId: string): CourseModule | undefined {
  return courseModules.find((module) => module.id.toLowerCase() === moduleId.toLowerCase())
}

export const coursePhases = learningTrack.phases
