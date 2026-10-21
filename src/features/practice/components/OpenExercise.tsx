import type { JSX } from 'react'
import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { Exercise } from '../../../types/lesson'
import type { Attempt } from '../../learning'
import { useLanguage } from '../../preferences'

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
  const { t } = useLanguage()
  const [answer, setAnswer] = useState(
    typeof existing?.answer === 'string' ? existing.answer : '',
  )
  const [showReference, setShowReference] = useState(Boolean(existing))
  const [score, setScore] = useState<number | null>(existing?.selfScore ?? null)
  useEffect(() => {
    // Restore a server-merged answer after the account snapshot arrives.
    setAnswer(typeof existing?.answer === 'string' ? existing.answer : '')
    setShowReference(Boolean(existing))
    setScore(existing?.selfScore ?? null)
  }, [existing])
  const submitted = showReference
  return (
    <div className="open-answer">
      <textarea
        aria-label={t('你的答案', 'Your answer')}
        value={answer}
        onChange={(e) => {
          // 保留用户正在编辑的文本答案。
          return setAnswer(e.target.value)
        }}
        placeholder={t(
          '写下你的思路，或尝试补全代码…',
          'Write your reasoning or try completing the code…',
        )}
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
          {t('查看参考答案', 'Show reference answer')} <ChevronDown size={14} />
        </button>
      ) : (
        <div className="reference-answer">
          <span>{t('参考答案', 'Reference answer')}</span>
          <p>{exercise.referenceAnswer}</p>
          <small>{exercise.explanation}</small>
          <div className="self-score">
            <b>
              {t('你觉得自己掌握了吗？', 'How well do you understand this?')}
            </b>
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
                ? t(`已记录：${score}/5`, `Recorded: ${score}/5`)
                : t(
                    '自我评分 1–5，仅用于个人复习，不计入客观题正确率',
                    'Self rate from 1–5 for review; this does not affect quiz accuracy.',
                  )}
            </small>
          </div>
        </div>
      )}
      {existing && (
        <span className="saved-answer-note">
          {t('已恢复上次自评记录', 'Previous self rating restored')}
        </span>
      )}
    </div>
  )
}
