import type { JSX } from 'react'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { Exercise } from '../../../types/lesson'
import type { Attempt } from '../../learning'

/** 展示开放练习与参考答案，单独记录自评来源。 */
export function OpenExercise({
  exercise,
  existing,
  onSubmit,
}: {
  exercise: Exercise
  existing?: Attempt
  onSubmit: (
    exercise: Exercise,
    answer: string | number,
    correct: boolean,
    score?: number,
  ) => void
}): JSX.Element {
  const [answer, setAnswer] = useState(
    typeof existing?.answer === 'string' ? existing.answer : '',
  )
  const [showReference, setShowReference] = useState(Boolean(existing))
  const [score, setScore] = useState<number | null>(existing?.selfScore ?? null)
  const submitted = showReference
  return (
    <div className="open-answer">
      <textarea
        aria-label="你的答案"
        value={answer}
        onChange={(e) => {
          // 保留用户正在编辑的文本答案。
          return setAnswer(e.target.value)
        }}
        placeholder="写下你的思路，或尝试补全代码…"
        rows={3}
        disabled={submitted}
      />
      {!submitted ? (
        <button
          className="secondary-button reference-button"
          onClick={() => {
            // 展开参考解并进入自评环节。
            return setShowReference(true)
          }}
        >
          查看参考答案 <ChevronDown size={14} />
        </button>
      ) : (
        <div className="reference-answer">
          <span>参考答案</span>
          <p>{exercise.referenceAnswer}</p>
          <small>{exercise.explanation}</small>
          <div className="self-score">
            <b>你觉得自己掌握了吗？</b>
            <div>
              {[1, 2, 3, 4, 5].map((n) => {
                // 渲染五级自评选项并标明当前评分。
                return (
                  <button
                    key={n}
                    className={score === n ? 'chosen' : ''}
                    onClick={() => {
                      // 提交个人评分；三分阈值只用于复习建议。

                      setScore(n)
                      onSubmit(exercise, answer, n >= 3, n)
                    }}
                  >
                    {n}
                  </button>
                )
              })}
            </div>
            <small>
              {score
                ? `已记录：${score}/5`
                : '自我评分 1–5，仅用于个人复习，不计入客观题正确率'}
            </small>
          </div>
        </div>
      )}
      {existing && (
        <span className="saved-answer-note">已恢复上次自评记录</span>
      )}
    </div>
  )
}
