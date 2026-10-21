import type { JSX } from 'react'
import { useState } from 'react'
import { ArrowRight, Check, ChevronRight, RotateCcw } from 'lucide-react'
import { allExercises, tagLabel } from '../features/catalog'
import { ChoiceExercise, OpenExercise } from '../features/practice'
import { CodeBlock } from '../components/CodeBlock'
import type { Progress } from '../features/learning'
import type { Lesson, Exercise } from '../types/lesson'
import { useLanguage } from '../features/preferences'
import { legacyLessonTitle } from '../data/courseText'

/** 从已完成课程中组合薄弱点练习，提交时保留原课程来源。 */
export function ReviewPage({
  progress,
  lessons: allLessons,
  onAttempt,
  onNavigate,
  onOpenCatalog,
}: {
  progress: Progress
  lessons: Lesson[]
  onAttempt: (
    lesson: Lesson,
    exercise: Exercise,
    answer: string | number,
    correct: boolean,
    score?: number,
  ) => void
  onNavigate: (lesson: Lesson) => void
  onOpenCatalog: () => void
}): JSX.Element {
  const { language, t } = useLanguage()
  const weak = Object.entries(progress.weakness)
    .filter(([, score]) => {
      // 排除已巩固的零分知识点。
      return score > 0
    })
    .sort((a, b) => {
      // 优先排列错误累计较多的知识点。
      return b[1] - a[1]
    })
  const questionPool = allLessons
    .filter((lesson) => {
      // 只复习用户标记完成的课程。
      return progress.completed.includes(lesson.id)
    })
    .flatMap((lesson) => {
      // 汇总当前课程中关联薄弱点的全部练习。
      return allExercises(
        lesson.exercises,
        lesson.comparisonQuestion,
        lesson.challenge,
      )
        .filter((ex) => {
          // 保留至少命中一个薄弱标签的练习。
          return ex.tags.some((tag) => {
            // 检查知识点是否仍需巩固。
            return (progress.weakness[tag] ?? 0) > 0
          })
        })
        .map((exercise) => {
          // 保留题目与来源课程的对应关系。
          return { lesson, exercise }
        })
    })
  const [cursor, setCursor] = useState(0)
  const entry = questionPool[cursor % Math.max(1, questionPool.length)]
  return (
    <div className="utility-page">
      <div className="breadcrumb">
        <span>{t('学习工具', 'Learning tools')}</span>
        <ChevronRight size={13} />
        <span>Review</span>
      </div>
      <div className="utility-title-row">
        <div>
          <span className="utility-eyebrow">REVIEW MODE</span>
          <h1>{t('薄弱点复习', 'Review weak areas')}</h1>
          <p>
            {t(
              '从已完成的互动课程中抽取与你的薄弱知识点相关的练习。',
              'Practice weak topics from interactive lessons you have completed.',
            )}
          </p>
        </div>
        <div className="review-count">
          <RotateCcw size={17} />
          <b>{questionPool.length}</b>
          <small>{t('道待复习', 'to review')}</small>
        </div>
      </div>
      {weak.length > 0 && (
        <div className="weak-tag-list">
          <h3>{t('当前关注', 'Current focus')}</h3>
          {weak.map(([tag, score]) => {
            // 显示当前薄弱点及其累计分值。
            return (
              <span className="tag-pill" key={tag}>
                {tagLabel(tag, language)} <b>{score}</b>
              </span>
            )
          })}
        </div>
      )}
      {entry ? (
        <section className="exercise-card review-exercise">
          <div className="exercise-eyebrow">
            <span className="exercise-dot" />
            {t('来自第', 'From lesson')}{' '}
            {String(entry.lesson.order).padStart(2, '0')} ·{' '}
            {legacyLessonTitle(entry.lesson.id, language, entry.lesson.title)}
          </div>
          <h2>{entry.exercise.prompt}</h2>
          {entry.exercise.code && (
            <CodeBlock code={entry.exercise.code} compact />
          )}
          {entry.exercise.correctAnswer !== undefined ? (
            <ChoiceExercise
              key={`${entry.exercise.id}-${cursor}`}
              exercise={entry.exercise}
              onSubmit={(exercise, answer, correct) => {
                // 将客观题反馈绑定到原课程。
                return onAttempt(entry.lesson, exercise, answer, correct)
              }}
            />
          ) : (
            <OpenExercise
              key={`${entry.exercise.id}-${cursor}`}
              exercise={entry.exercise}
              onSubmit={(exercise, answer, correct, score) => {
                // 提交开放题答案并保留自评分来源。
                return onAttempt(entry.lesson, exercise, answer, correct, score)
              }}
            />
          )}
          <div className="exercise-footer">
            <button
              className="secondary-button"
              onClick={() => {
                // 在当前待复习题库中随机抽题。
                return setCursor(
                  Math.floor(Math.random() * questionPool.length),
                )
              }}
            >
              <RotateCcw size={13} />
              {t('随机抽题', 'Random question')}
            </button>
            <button
              className="text-link"
              onClick={() => {
                // 返回这道题的原课程。
                return onNavigate(entry.lesson)
              }}
            >
              {t('查看原课程', 'View original lesson')} <ArrowRight size={13} />
            </button>
          </div>
        </section>
      ) : (
        <div className="empty-state">
          <span className="empty-check">
            <Check size={16} />
          </span>
          <h2>
            {progress.completed.length
              ? t(
                  '暂时没有待复习的互动题',
                  'No interactive questions to review yet',
                )
              : t(
                  '当前没有待复习的互动题',
                  'No interactive questions to review',
                )}
          </h2>
          <p>
            {t(
              'M01 的开放练习和公开答案在对应课节中自查；已有互动练习的错题仍会在这里出现。',
              'Check M01 open exercises and public answers in their lessons. Missed interactive questions will appear here.',
            )}
          </p>
          <button className="primary-button" onClick={onOpenCatalog}>
            {t('查看已发布课程', 'View published lessons')}{' '}
            <ArrowRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
