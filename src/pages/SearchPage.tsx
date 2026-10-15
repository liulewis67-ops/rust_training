import { useState, type FormEvent, type JSX } from 'react'
import { ArrowRight, Search, X } from 'lucide-react'
import type { Route } from '../app/router'
import { searchLessons } from '../features/search/searchIndex'

const suggestedQueries = ['借用', 'E0382', 'State']

/** Search published course sections and provide a direct route to each matching lesson. */
export function SearchPage({
  onNavigate,
}: {
  onNavigate: (route: Route) => void
}): JSX.Element {
  const [query, setQuery] = useState('')
  const results = searchLessons(query)

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
      <h1>搜索课程</h1>
      <p className="search-intro">
        搜索课程标题、正文、练习题面、Rust 术语和编译错误码。
      </p>
      <form className="search-form" role="search" onSubmit={handleSubmit}>
        <Search size={17} aria-hidden="true" />
        <label className="sr-only" htmlFor="course-search-input">
          搜索课程标题、正文、术语或错误码
        </label>
        <input
          id="course-search-input"
          type="search"
          value={query}
          placeholder="例如：借用、E0382、State"
          onChange={(event) => {
            // 查询值只保存在当前页面状态，不写入学习记录或草稿。
            setQuery(event.currentTarget.value)
          }}
        />
        {query && (
          <button
            type="button"
            className="search-clear"
            aria-label="清除搜索"
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
          <h2 id="search-suggestions-title">试试这些搜索</h2>
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
          <h2>{results.length} 个课程结果</h2>
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
                      查看课程章节 <ArrowRight size={12} />
                    </small>
                  </a>
                </li>
              )
            })}
          </ul>
        </section>
      ) : (
        <section className="search-empty" role="status">
          <h2>没有找到匹配课程</h2>
          <p>换一个 Rust 术语、错误码或中文关键词试试。</p>
          <button type="button" onClick={clearQuery}>
            清除搜索
          </button>
          <button
            type="button"
            className="search-track-link"
            onClick={() => {
              // 没有命中时提供学习路线入口，帮助继续浏览。
              onNavigate({ page: 'track', trackSlug: 'rust-backend' })
            }}
          >
            查看学习路线 <ArrowRight size={13} />
          </button>
        </section>
      )}
    </article>
  )
}
