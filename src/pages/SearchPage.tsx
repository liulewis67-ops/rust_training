import { useEffect, useState, type FormEvent, type JSX } from 'react'
import { ArrowRight, Search, X } from 'lucide-react'
import type { Route } from '../app/router'
import { searchLessons } from '../features/search/searchIndex'
import { useLanguage } from '../features/preferences'

/** Search published course sections and provide a direct route to each matching lesson. */
export function SearchPage({
  onNavigate,
}: {
  onNavigate: (route: Route) => void
}): JSX.Element {
  const { language, t } = useLanguage()
  const suggestedQueries =
    language === 'zh'
      ? ['借用', 'E0382', 'State']
      : ['ownership', 'E0382', 'State']
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<
    Awaited<ReturnType<typeof searchLessons>>
  >([])
  useEffect(() => {
    let active = true
    void searchLessons(query, language).then((nextResults) => {
      if (active) setResults(nextResults)
    })
    return () => {
      active = false
    }
  }, [query, language])

  /** Prevent Enter from reloading the app; results update as the learner types. */
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
  }

  /** Reset the query so the learner can try a suggested search. */
  function clearQuery(): void {
    setQuery('')
  }

  return (
    <article className="search-page">
      <p className="search-eyebrow">COURSE SEARCH</p>
      <h1>{t('搜索课程', 'Search courses')}</h1>
      <p className="search-intro">
        {t(
          '搜索课程标题、正文、练习题面、Rust 术语和编译错误码。',
          'Search lesson titles, content, exercises, Rust terms, and compiler error codes.',
        )}
      </p>
      <form className="search-form" role="search" onSubmit={handleSubmit}>
        <Search size={17} aria-hidden="true" />
        <label className="sr-only" htmlFor="course-search-input">
          {t(
            '搜索课程标题、正文、术语或错误码',
            'Search lesson titles, content, terms, or error codes',
          )}
        </label>
        <input
          id="course-search-input"
          type="search"
          value={query}
          placeholder={t(
            '例如：借用、E0382、State',
            'For example: ownership, E0382, State',
          )}
          onChange={(event) => {
            // 查询值只保存在当前页面状态，不写入学习记录或草稿。
            setQuery(event.currentTarget.value)
          }}
        />
        {query && (
          <button
            type="button"
            className="search-clear"
            aria-label={t('清除搜索', 'Clear search')}
            onClick={clearQuery}
          >
            <X size={15} />
          </button>
        )}
      </form>

      {!query.trim() ? (
        <section
          className="search-suggestions"
          aria-labelledby="search-suggestions-title"
        >
          <h2 id="search-suggestions-title">
            {t('试试这些搜索', 'Try these searches')}
          </h2>
          <div>
            {suggestedQueries.map((suggestion) => {
              // 将常见中文词、所有权错误码和 Axum 术语填入搜索框。
              return (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => {
                    setQuery(suggestion)
                  }}
                >
                  {suggestion}
                </button>
              )
            })}
          </div>
        </section>
      ) : results.length > 0 ? (
        <section className="search-results" aria-live="polite">
          <h2>
            {t(
              `${results.length} 个课程结果`,
              `${results.length} course results`,
            )}
          </h2>
          <ul>
            {results.map((result) => {
              // 每个结果直接链接到所在课程页；课程页负责显示完整上下文。
              return (
                <li key={result.id}>
                  <a href={result.href}>
                    <span>{result.section}</span>
                    <h3>{result.title}</h3>
                    <p>{result.excerpt}</p>
                    <small>
                      {t('查看课程章节', 'View lesson section')}{' '}
                      <ArrowRight size={12} />
                    </small>
                  </a>
                </li>
              )
            })}
          </ul>
        </section>
      ) : (
        <section className="search-empty" role="status">
          <h2>{t('没有找到匹配课程', 'No matching lessons')}</h2>
          <p>
            {t(
              '换一个 Rust 术语、错误码或中文关键词试试。',
              'Try another Rust term, error code, or keyword.',
            )}
          </p>
          <button type="button" onClick={clearQuery}>
            {t('清除搜索', 'Clear search')}
          </button>
          <button
            type="button"
            className="search-track-link"
            onClick={() => {
              // 没有命中时提供学习路线入口，帮助继续浏览。
              onNavigate({ page: 'track', trackSlug: 'rust-backend' })
            }}
          >
            {t('查看学习路线', 'View learning path')} <ArrowRight size={13} />
          </button>
        </section>
      )}
    </article>
  )
}
