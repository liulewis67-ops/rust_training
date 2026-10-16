import { useState, type JSX } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { lessons } from '../features/catalog'
import { createProgress, recordAttempt } from '../features/learning/model'
import type { Exercise, Lesson } from '../types/lesson'
import { ReviewPage } from './ReviewPage'

const first = {
  ...lessons[0].exercises[0],
  id: 'first',
  prompt: '第一道复习题',
  tags: ['first'],
  options: ['正确', '错误'],
  correctAnswer: 0,
}
const second = {
  ...first,
  id: 'second',
  prompt: '第二道复习题',
  tags: ['second'],
}
const lesson: Lesson = {
  ...lessons[0],
  exercises: [first, second],
  comparisonQuestion: undefined,
  challenge: undefined,
}

/** 用实际学习规则驱动复习界面，检查题库缩小时是否丢失剩余题目。 */
function ReviewHarness(): JSX.Element {
  const [progress, setProgress] = useState({
    ...createProgress(),
    completed: [lesson.id],
    weakness: { first: 1, second: 1 },
  })
  /** 按原课程记录答案，让答对标签从待复习题库消失。 */
  function submit(
    source: Lesson,
    exercise: Exercise,
    answer: string | number,
    correct: boolean,
  ): void {
    setProgress((current) => {
      // 使用生产更新规则，避免测试重复实现题库变化。
      const updated = recordAttempt(
        current,
        source.id,
        exercise,
        answer,
        correct,
      )
      return {
        ...updated,
        weakness: {
          first: updated.weakness.first,
          second: updated.weakness.second,
        },
      }
    })
  }
  /** 本场景仅验证题库收缩，不执行页面导航。 */
  function navigate(): void {
    /* 导航不参与该回归场景。 */
  }
  return (
    <ReviewPage
      progress={progress}
      lessons={[lesson]}
      onAttempt={submit}
      onNavigate={navigate}
      onOpenCatalog={navigate}
    />
  )
}

// 释放界面与随机数模拟，保持其它测试独立。
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

// 位于最后一题时，答对使题库缩短，应显示剩余题而不是错误空状态。
it('题库收缩后仍显示剩余复习题', async () => {
  vi.spyOn(Math, 'random').mockReturnValue(0.99)
  const user = userEvent.setup()
  render(<ReviewHarness />)
  await user.click(screen.getByRole('button', { name: '随机抽题' }))
  expect(screen.getByRole('heading', { name: '第二道复习题' })).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'A 正确' }))
  await user.click(screen.getByRole('button', { name: /提交答案/ }))
  expect(screen.getByRole('heading', { name: '第一道复习题' })).toBeTruthy()
  expect(screen.queryByText('暂时没有待复习的互动题')).toBeNull()
})
