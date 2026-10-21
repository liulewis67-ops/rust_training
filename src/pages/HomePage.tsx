import type { JSX } from 'react'
import { ArrowRight, Boxes, BookOpen, Layers3, ShieldCheck } from 'lucide-react'
import { learningTrack } from '../data/learningTrack'
import { courseModules } from '../data/courseCatalog'
import { listPublicCourseLessons } from '../data/publicCourse'
import type { Route } from '../app/router'
import type { Progress } from '../features/learning'
import { useLanguage } from '../features/preferences'
import { lessonTitle } from '../data/courseText'
import './learningRecommendations.css'

/** Introduce the learning path and provide a direct route into its course catalog. */
export function HomePage({
  onNavigate,
  progress,
}: {
  onNavigate: (route: Route) => void
  progress: Progress
}): JSX.Element {
  const { language, t } = useLanguage()
  const publishedLessons = courseModules.flatMap((module) =>
    module.lessons
      .filter((lesson) => lesson.published)
      .map((lesson) => ({ ...lesson })),
  )
  const completedPublished = publishedLessons.filter((lesson) =>
    progress.completed.includes(`${lesson.moduleId}-${lesson.id}`),
  ).length
  const nextLesson =
    publishedLessons.find(
      (lesson) =>
        !progress.completed.includes(`${lesson.moduleId}-${lesson.id}`),
    ) ?? publishedLessons[0]
  const publicLesson = listPublicCourseLessons(language)[0]
  /** 打开唯一已发布的路线方案页。 */
  function openTrack(): void {
    onNavigate({ page: 'track', trackSlug: learningTrack.slug })
  }

  /** Open the next published lesson in the main track. */
  function openNextLesson(): void {
    if (!nextLesson) return openTrack()
    onNavigate({
      page: 'course-lesson',
      moduleId: nextLesson.moduleId,
      lessonId: nextLesson.id,
    })
  }

  return (
    <article className="home-page">
      <p className="home-eyebrow">RUST BACKEND ENGINEER TRACK</p>
      <section className="home-hero">
        <div className="home-hero-copy">
          <p className="home-kicker">
            {t(
              '面向有编程经验的开发者',
              'For developers with programming experience',
            )}
          </p>
          <h1>
            {t(
              '从 Rust 基础，走到可交付的后端服务。',
              'From Rust fundamentals to production ready backend services.',
            )}
          </h1>
          <p className="home-description">
            {t(
              '按 8 个阶段、24 个模块系统学习 Rust 工程。在线阅读课程，在本地完成练习与项目。',
              'Learn Rust engineering through 8 phases and 24 modules. Read lessons online and complete exercises and projects locally.',
            )}
          </p>
          <button className="primary-button home-cta" onClick={openTrack}>
            {t('浏览课程目录', 'Browse courses')} <ArrowRight size={15} />
          </button>
        </div>
        <div className="home-route-card">
          <span className="home-card-icon">
            <BookOpen size={17} />
          </span>
          <p>{t('课程主线', 'Core learning path')}</p>
          <h2>{t(learningTrack.title, 'Rust Backend Engineer Path')}</h2>
          <span>
            {t(
              '8 个学习阶段 · 24 个模块 · 144 节课程',
              '8 phases · 24 modules · 144 lessons',
            )}
          </span>
          <span className="planned-badge">
            {t('课程可浏览', 'Browse the curriculum')}
          </span>
        </div>
      </section>

      <section
        className="home-next-steps"
        aria-labelledby="home-next-steps-title"
      >
        <div className="home-section-heading">
          <div>
            <p className="home-kicker">LOCAL STUDY</p>
            <h2 id="home-next-steps-title">
              {t('从一条清晰的下一步开始', 'Start with a clear next step')}
            </h2>
          </div>
          <small>
            {t('主线已自报完成', 'Core lessons marked complete')}{' '}
            {completedPublished} / {publishedLessons.length}
          </small>
        </div>
        <p className="home-next-steps-note">
          {t(
            '规划阶段不会计作已完成学习；已发布课程可直接阅读，本地记录也不代表平台认证的能力等级。',
            'Planned phases do not count as completed learning. Published lessons are available to read; local records are not a certification of skill.',
          )}
        </p>
        <div className="home-next-step-grid">
          <article className="home-next-step home-next-step-in_progress">
            <span className="home-next-step-status">
              {t('主线下一课', 'Next core lesson')}
            </span>
            <h3>
              {nextLesson
                ? `${nextLesson.moduleId}-${nextLesson.id} · ${lessonTitle(nextLesson.moduleId, nextLesson.id, language, nextLesson.title)}`
                : t('已发布课程准备中', 'Published lessons coming soon')}
            </h3>
            <p>
              {t(
                '按已发布课程的顺序阅读，在自己的电脑上完成练习。',
                'Read published lessons in order and complete exercises on your computer.',
              )}
            </p>
            <button className="secondary-button" onClick={openNextLesson}>
              {nextLesson
                ? t('打开课节', 'Open lesson')
                : t('查看课程目录', 'View catalog')}{' '}
              <ArrowRight size={13} />
            </button>
          </article>
          {publicLesson && (
            <article className="home-next-step home-next-step-not_started">
              <span className="home-next-step-status">
                {t('专题练习', 'Focused practice')}
              </span>
              <h3>{publicLesson.title}</h3>
              <p>
                {t(
                  '阅读借用切片示例，并在本地 Cargo 项目中编写测试。',
                  'Study borrowed slices and write tests in a local Cargo project.',
                )}
              </p>
              <button
                className="secondary-button"
                onClick={() =>
                  onNavigate({
                    page: 'public-course-lesson',
                    lessonId: publicLesson.id,
                  })
                }
              >
                {t('打开课节', 'Open lesson')} <ArrowRight size={13} />
              </button>
            </article>
          )}
          <article className="home-next-step home-next-step-no_content">
            <span className="home-next-step-status">
              {t('路线规划', 'Learning path')}
            </span>
            <h3>
              {t(
                '从 Rust 基础到工程交付',
                'From Rust basics to engineering delivery',
              )}
            </h3>
            <p>
              {t(
                '查看 24 个模块的学习目标，以及尚在准备的课节。',
                'Explore goals for 24 modules and lessons still in preparation.',
              )}
            </p>
            <button className="secondary-button" onClick={openTrack}>
              {t('查看路线', 'View path')} <ArrowRight size={13} />
            </button>
          </article>
        </div>
      </section>

      <section className="home-section" aria-labelledby="home-projects-title">
        <div className="home-section-heading">
          <div>
            <p className="home-kicker">LEARN BY BUILDING</p>
            <h2 id="home-projects-title">
              {t(
                '沿途交付真实工程成果',
                'Build real engineering projects along the way',
              )}
            </h2>
          </div>
          <button className="text-button" onClick={openTrack}>
            {t('查看阶段', 'View phases')} <ArrowRight size={13} />
          </button>
        </div>
        <div className="home-pillars">
          <article className="home-pillar">
            <span>
              <Layers3 size={16} />
            </span>
            <small>{t('P1 · 工程化', 'P1 · Engineering')}</small>
            <h3>{t('日志分析 CLI', 'Log analysis CLI')}</h3>
            <p>
              {t(
                '把类型建模、错误处理与测试组合成可交付工具。',
                'Combine data modeling, error handling, and tests into a usable tool.',
              )}
            </p>
            <span className="planned-label">{t('规划中', 'Planned')}</span>
          </article>
          <article className="home-pillar">
            <span>
              <ArrowRight size={16} />
            </span>
            <small>{t('P2 · 异步', 'P2 · Async')}</small>
            <h3>{t('受限并发执行器', 'Bounded task executor')}</h3>
            <p>
              {t(
                '练习任务调度、取消、背压与资源边界。',
                'Practice scheduling, cancellation, backpressure, and resource boundaries.',
              )}
            </p>
            <span className="planned-label">{t('规划中', 'Planned')}</span>
          </article>
          <article className="home-pillar">
            <span>
              <ShieldCheck size={16} />
            </span>
            <small>{t('P3 · 服务端', 'P3 · Backend')}</small>
            <h3>{t('持久化后端服务', 'Persistent backend service')}</h3>
            <p>
              {t(
                '从 API 契约继续走向权限、可靠性和数据安全。',
                'Move from API contracts to authorization, reliability, and data safety.',
              )}
            </p>
            <span className="planned-label">{t('规划中', 'Planned')}</span>
          </article>
          <article className="home-pillar">
            <span>
              <Boxes size={16} />
            </span>
            <small>{t('P4 · 生产交付', 'P4 · Production delivery')}</small>
            <h3>{t('可部署服务与答辩', 'Deployable service and review')}</h3>
            <p>
              {t(
                '综合构建、发布、恢复、性能证据和维护实践。',
                'Bring together builds, releases, recovery, performance evidence, and maintenance.',
              )}
            </p>
            <span className="planned-label">{t('规划中', 'Planned')}</span>
          </article>
        </div>
      </section>

      <p className="home-disclosure" role="status">
        {t(
          '代码练习在本地电脑完成；本站不提供在线运行或平台评测。',
          'Complete coding exercises locally. This site does not run code or grade submissions online.',
        )}
      </p>
    </article>
  )
}
