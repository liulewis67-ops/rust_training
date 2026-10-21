import type { JSX } from 'react'
import { useEffect, useState } from 'react'
import { ArrowRight, CheckCircle2, XCircle } from 'lucide-react'
import type { Exercise } from '../../../types/lesson'
import type { Attempt } from '../../learning'
import { Feedback } from './Feedback'
import { useLanguage } from '../../preferences'

/** 展示客观选择题并恢复已有本地作答；提交前允许修改选项。 */
export function ChoiceExercise({
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
  ) => void
}): JSX.Element {
  const { t } = useLanguage()
  const [selected, setSelected] = useState<number | null>(
    typeof existing?.answer === 'number' ? existing.answer : null,
  )
  const [submitted, setSubmitted] = useState(Boolean(existing))
  useEffect(() => {
    // Apply a stored or cloud-restored answer when progress finishes loading.
    setSelected(typeof existing?.answer === 'number' ? existing.answer : null)
    setSubmitted(Boolean(existing))
  }, [existing])
  const correct = selected === exercise.correctAnswer
  return (
    <>
      <div className="choice-list">
        {exercise.options?.map((option, index) => {
          // 结合提交状态展示正确选项与误选项。

          const isRight = submitted && index === exercise.correctAnswer
          const isWrong = submitted && selected === index && !correct
          return (
            <button
              key={option}
              className={`choice-option ${selected === index ? 'selected' : ''} ${isRight ? 'correct' : ''} ${isWrong ? 'incorrect' : ''}`}
              onClick={() => {
                // 未提交时允许选择当前答案。
                return !submitted && setSelected(index)
              }}
              disabled={submitted}
            >
              <span className="choice-key">
                {String.fromCharCode(65 + index)}
              </span>
              <span>{option}</span>
              {isRight && <CheckCircle2 size={16} />}
              {isWrong && <XCircle size={16} />}
            </button>
          )
        })}
      </div>
      {submitted ? (
        <Feedback
          correct={correct}
          exercise={exercise}
          onRetry={() => {
            // 清空当前选择，允许重新作答。

            setSubmitted(false)
            setSelected(null)
          }}
        />
      ) : (
        <button
          className="primary-button submit-button"
          disabled={selected === null}
          onClick={() => {
            // 只有选择完成后才提交本地答案与客观判定。

            if (selected === null) return
            setSubmitted(true)
            onSubmit(exercise, selected, correct)
          }}
        >
          {t('提交答案', 'Submit answer')} <ArrowRight size={14} />
        </button>
      )}
    </>
  )
}
