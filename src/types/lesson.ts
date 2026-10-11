export type Difficulty = 'beginner' | 'intermediate' | 'advanced'
export type ExerciseType = 'multiple_choice' | 'code_prediction' | 'code_fix' | 'concept_question' | 'code_completion' | 'true_false' | 'architecture_question'

export interface MentalModel { before?: string; after?: string; description: string }
export interface CodeExample { language: 'rust' | 'java' | 'go'; label?: string; code: string }
export interface Exercise {
  id: string; type: ExerciseType; prompt: string; tags: string[]; options?: string[]; correctAnswer?: number
  referenceAnswer?: string; code?: string; explanation: string; rule: string; temptingWrong?: string; comparison?: string
}
export interface Lesson {
  id: string; order: number; title: string; category: string; difficulty: Difficulty; estimatedMinutes: number
  objective: string; explanation: string; mentalModel?: MentalModel; examples: CodeExample[]; exercises: Exercise[]
  comparisonQuestion?: Exercise; challenge?: Exercise; summary: string[]; prerequisites: string[]
}

export interface ExecutionResult { stdout: string; stderr: string; exitCode: number | null }
export interface CodeExecutor { execute(code: string): Promise<ExecutionResult> }
