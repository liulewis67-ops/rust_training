import type { JSX } from 'react'
import { CheckCircle2, RotateCcw, XCircle } from 'lucide-react'
import type { Exercise } from '../../../types/lesson'

/** 展示原型题目解释与重试入口，不充当真实编译诊断。 */
export function Feedback({
  correct,
  exercise,
  onRetry,
}: {
  correct: boolean
  exercise: Exercise
  onRetry: () => void
}): JSX.Element {
  return (
    <div className={`feedback ${correct ? 'feedback-good' : 'feedback-bad'}`}>
      <div className="feedback-title">
        {correct ? <CheckCircle2 size={17} /> : <XCircle size={17} />}
        {correct ? '回答正确' : '再想一想'}
      </div>
      <p>{exercise.explanation}</p>
      <div className="feedback-rule">
        <b>Rust 规则</b>
        <span>{exercise.rule}</span>
      </div>
      {!correct && exercise.temptingWrong && (
        <div className="tempting-note">
          <b>为什么容易选错</b>
          <span>{exercise.temptingWrong}</span>
        </div>
      )}
      {exercise.comparison && (
        <div className="feedback-rule">
          <b>Java / Go 对比</b>
          <span>{exercise.comparison}</span>
        </div>
      )}
      <button className="retry-button" onClick={onRetry}>
        <RotateCcw size={13} />
        重新作答
      </button>
    </div>
  )
}
