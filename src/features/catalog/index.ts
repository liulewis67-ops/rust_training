import type { Exercise } from '../../types/lesson'
export { lessons, categories } from '../../data/lessons'

/** 汇总课程内原型练习，保留原题序。 */
export function allExercises(
  exercises: Exercise[],
  comparison?: Exercise,
  challenge?: Exercise,
): Exercise[] {
  return [
    ...exercises,
    ...(comparison ? [comparison] : []),
    ...(challenge ? [challenge] : []),
  ]
}

/** 将原型知识点 ID 映射为标签，未知标签保留原文。 */
export function tagLabel(tag: string): string {
  return (
    (
      {
        ownership: '所有权',
        borrowing: '借用',
        'mutable-borrowing': '可变借用',
        lifetime: '生命周期',
        traits: 'Trait',
        generics: '泛型',
        'dynamic-dispatch': '动态分发',
        'error-handling': '错误处理',
        result: 'Result',
        concurrency: '并发',
        async: '异步',
        tokio: 'Tokio',
        database: '数据库',
        'agent-runtime': 'Agent Runtime',
        'java-go': '跨语言对比',
        'copy-clone': 'Copy / Clone',
        'resource-lifecycle': '资源生命周期',
        'string-slice': '&str / String',
        'memory-safety': '内存安全',
        'api-design': 'API 设计',
        web: 'Web 后端',
      } as Record<string, string>
    )[tag] ?? tag
  )
}

export const difficultyLabel = {
  beginner: '入门',
  intermediate: '进阶',
  advanced: '高级',
}
