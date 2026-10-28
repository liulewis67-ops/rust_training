import { expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SafeMarkdown } from './SafeMarkdown'
import { resolveCourseAsset } from '../../data/courseCatalog'
import m02Lab from '../../../content/releases/m02-l05.md?raw'

it('identifies fenced Rust examples and copies exactly the visible code', async () => {
  const previousClipboard = Object.getOwnPropertyDescriptor(
    navigator,
    'clipboard',
  )
  const writeText = vi.fn(async () => undefined)
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  })

  try {
    const example = 'fn main() {\n    println!("hi");\n}'
    const { container } = render(
      <SafeMarkdown content={`\`\`\`rust\n${example}\n\`\`\``} />,
    )
    expect(container.querySelector('.course-code-language')?.textContent).toBe(
      'Rust',
    )
    expect(container.querySelector('pre code')?.textContent).toBe(example)

    fireEvent.click(screen.getByRole('button', { name: '复制代码' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(example))
    expect(screen.getByRole('button', { name: '已复制' })).toBeTruthy()
  } finally {
    if (previousClipboard) {
      Object.defineProperty(navigator, 'clipboard', previousClipboard)
    } else {
      Reflect.deleteProperty(navigator, 'clipboard')
    }
  }
})

it('keeps code readable and reports unavailable clipboard access', async () => {
  const previousClipboard = Object.getOwnPropertyDescriptor(
    navigator,
    'clipboard',
  )
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: undefined,
  })

  try {
    const { container } = render(
      <SafeMarkdown
        language="en"
        content={`\`\`\`toml\n[package]\nname = "test"\n\`\`\``}
      />,
    )
    expect(container.querySelector('pre code')?.textContent).toContain(
      '[package]',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Copy code' }))
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Copy unavailable' }),
      ).toBeTruthy(),
    )
  } finally {
    if (previousClipboard) {
      Object.defineProperty(navigator, 'clipboard', previousClipboard)
    } else {
      Reflect.deleteProperty(navigator, 'clipboard')
    }
  }
})

// Only a small Markdown subset is rendered; active HTML and unsafe links stay inert.
it('filters active HTML and unsafe URL schemes while rendering safe Markdown', () => {
  const { container } = render(
    <SafeMarkdown
      content={
        '安全正文 <script>alert(1)</script><img src=x onerror=alert(2)> **借用切片** [危险链接](javascript:alert(3)) [Rust Book](https://doc.rust-lang.org/book/)'
      }
    />,
  )

  expect(container.querySelector('script, img')).toBeNull()
  expect(container.textContent).not.toContain('alert')
  expect(screen.getByText('借用切片').tagName).toBe('STRONG')
  expect(screen.queryByRole('link', { name: '危险链接' })).toBeNull()
  expect(
    screen.getByRole('link', { name: 'Rust Book' }).getAttribute('href'),
  ).toBe('https://doc.rust-lang.org/book/')
})

it('keeps published hints and reference answers available behind disclosures', () => {
  const { container } = render(
    <SafeMarkdown
      content={
        '### 分层提示\n先看输入。\n\n### 参考答案\n结果是 125。\n\n### 自评规程\n核对边界。'
      }
    />,
  )
  const disclosures = container.querySelectorAll('details')
  expect(disclosures).toHaveLength(2)
  expect(disclosures[0].open).toBe(false)
  expect(disclosures[1].open).toBe(false)
  expect(disclosures[1].textContent).toContain('结果是 125')
  expect(screen.getByText('核对边界。')).toBeTruthy()
})

it('also folds hints and reference answers in English lessons', () => {
  const { container } = render(
    <SafeMarkdown
      content={
        '### Layering Tips\nStart with the input.\n\n### Reference answer\nThe result is 125.'
      }
    />,
  )
  expect(
    Array.from(container.querySelectorAll('details > summary')).map(
      (summary) => summary.textContent,
    ),
  ).toEqual(['Layering Tips', 'Reference answer'])
})

it('keeps translated case answers folded until the learner opens them', () => {
  const { container, unmount } = render(
    <SafeMarkdown
      content={'## Case answers and explanations\nReview each answer.'}
      language="en"
    />,
  )
  const caseAnswers = Array.from(container.querySelectorAll('details')).find(
    (item) =>
      item.querySelector('summary')?.textContent?.trim() ===
      'Case answers and explanations',
  )
  expect(caseAnswers).toBeTruthy()
  expect(caseAnswers?.open).toBe(false)
  unmount()
})

it('gives released ZIP downloads a stable file name', () => {
  render(<SafeMarkdown content="[下载样例](./m01-l03-samples.zip)" />)
  const link = screen.getByRole('link', { name: '下载样例' })
  expect(link.getAttribute('download')).toBe('m01-l03-samples.zip')
  expect(link.getAttribute('href')).toContain('m01-l03-samples')
})

it('links to the English download in English Markdown', () => {
  render(
    <SafeMarkdown
      content="[Reference project](./m01-l06-reference.zip)"
      language="en"
    />,
  )
  expect(
    screen
      .getByRole('link', { name: 'Reference project' })
      .getAttribute('href'),
  ).toBe(resolveCourseAsset('./m01-l06-reference.zip', 'en'))
})

it('routes published lesson links through the static hash router', () => {
  render(
    <SafeMarkdown content="[M01-L03](./m01-l03.md) [not published](./m99-l01-missing.md)" />,
  )
  const lessonLink = screen.getByRole('link', { name: 'M01-L03' })
  expect(lessonLink.getAttribute('href')).toBe('#/courses/m01/l03')
  expect(lessonLink.hasAttribute('target')).toBe(false)
  expect(screen.queryByRole('link', { name: 'not published' })).toBeNull()
})

it('preserves a released Markdown heading fragment in the lesson route', () => {
  render(<SafeMarkdown content="[请求轨迹](./m01-l01.md#检验理解)" />)
  const link = screen.getByRole('link', { name: '请求轨迹' })
  const href = link.getAttribute('href') ?? ''

  expect(href.split('?')[0]).toBe('#/courses/m01/l01')
  expect(new URLSearchParams(href.split('?')[1]).get('section')).toBe(
    '检验理解',
  )
})

it('maps a Chinese source fragment to the translated English heading', () => {
  render(
    <SafeMarkdown
      content="[Request trace](./m01-l01.md#检验理解)"
      language="en"
    />,
  )
  const href =
    screen.getByRole('link', { name: 'Request trace' }).getAttribute('href') ??
    ''
  expect(new URLSearchParams(href.split('?')[1]).get('section')).toBe(
    '检验理解',
  )
})

it('renders stable IDs for Unicode headings and repeated headings', () => {
  const { container } = render(
    <SafeMarkdown
      content={`## 练习一：预测请求轨迹

## 练习一：预测请求轨迹`}
    />,
  )

  expect(container.querySelectorAll('h2')[0]?.id).toBe('练习一预测请求轨迹')
  expect(container.querySelectorAll('h2')[1]?.id).toBe('练习一预测请求轨迹-1')
})

it('renders Markdown tables with alignment and inline formatting', () => {
  const { container } = render(
    <SafeMarkdown
      content={`| 状态 | 返回值 | 说明 |
| :--- | ---: | :---: |
| Queued | 202 | \`Accepted\` |
| Running | 409 | retry\\|conflict |`}
    />,
  )
  const table = screen.getByRole('table')
  const headers = screen.getAllByRole('columnheader')
  const rows = table.querySelectorAll('tbody tr')

  expect(headers.map((header) => header.textContent)).toEqual([
    '状态',
    '返回值',
    '说明',
  ])
  expect(headers[0]?.getAttribute('style')).toContain('text-align: left')
  expect(headers[1]?.getAttribute('style')).toContain('text-align: right')
  expect(headers[2]?.getAttribute('style')).toContain('text-align: center')
  expect(rows).toHaveLength(2)
  expect(rows[0]?.querySelector('code')?.textContent).toBe('Accepted')
  expect(rows[1]?.textContent).toContain('retry|conflict')
  expect(
    container.querySelector('.course-markdown-table-wrapper'),
  ).not.toBeNull()
})

it('renders GFM task lists as accessible page-local checkboxes', () => {
  const { container } = render(
    <SafeMarkdown
      content={'- [ ] 待完成的 **检查项**\n- [x] 已完成的 `测试`\n- 普通列表项'}
    />,
  )
  const unchecked = screen.getByRole('checkbox', { name: '待完成的 检查项' })
  const checked = screen.getByRole('checkbox', { name: '已完成的 测试' })

  expect((unchecked as HTMLInputElement).checked).toBe(false)
  expect((checked as HTMLInputElement).checked).toBe(true)
  expect(unchecked.hasAttribute('disabled')).toBe(false)
  fireEvent.click(unchecked)
  expect((unchecked as HTMLInputElement).checked).toBe(true)
  fireEvent.click(unchecked)
  expect((unchecked as HTMLInputElement).checked).toBe(false)
  expect(container.querySelector('ul.course-task-list')).not.toBeNull()
  expect(
    screen
      .getByText('普通列表项')
      .closest('li')
      ?.classList.contains('course-task-list-item'),
  ).toBe(false)
})

it('keeps numbered reference answers and their code inside one list', () => {
  const { container } = render(
    <SafeMarkdown
      content={`1. Inspect the input.
2. Use checked access.
3. Return a stable result.`}
    />,
  )

  const lists = container.querySelectorAll('ol')
  expect(lists).toHaveLength(1)
  const items = lists[0].querySelectorAll(':scope > li')
  expect(items).toHaveLength(3)
  expect(items[1].textContent).toContain('Use checked access')
  expect(items[2].textContent).toContain('Return a stable result')
})

it('folds published hints and solutions while keeping combined exercise sections visible', () => {
  const lab = render(<SafeMarkdown content={m02Lab} />)
  expect(
    Array.from(lab.container.querySelectorAll('details > summary')).map(
      (summary) => summary.textContent,
    ),
  ).toEqual(['分层提示', '公开参考实现'])
  lab.unmount()

  const exercises = render(
    <SafeMarkdown
      content={'## 公开练习与参考答案\n示例任务。\n\n### 公开答案\n示例答案。'}
    />,
  )
  expect(
    Array.from(exercises.container.querySelectorAll('h2')).some(
      (heading) => heading.textContent === '公开练习与参考答案',
    ),
  ).toBe(true)
  expect(
    exercises.container.querySelector('details > summary')?.textContent,
  ).toBe('公开答案')
  expect(exercises.container.querySelectorAll('details')).toHaveLength(1)
})
