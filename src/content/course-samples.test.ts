import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../..')

// Run the real locked-toolchain validator against runnable, fragment, failure and solution samples.
describe('课程代码样例验证', () => {
  // This must fail if any accepted sample stops compiling, running or matching its declared outcome.
  it('校验三类示例、正确解和错误解并识别语法错误', () => {
    const output = execFileSync(
      'node',
      [
        'scripts/validate-course-samples.mjs',
        'validate',
        'content/course-samples.json',
      ],
      { cwd: root, encoding: 'utf8' },
    )

    expect(output).toContain('Verified 5 course samples with rustc 1.95.0')
    expect(output).toContain('rejected syntax-only failure')
  })
})
