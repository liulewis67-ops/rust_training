// Verify real bilingual Markdown code fences instead of only companion examples.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
// Each lesson enumerates all its Rust fences in reading order.
const audited = {
  'm02-l01': ['ok', 'ok', 'ok', 'ok', 'ok', 'ok'],
  'm03-l02': ['ok', 'ok'],
  'm04-l02': ['ok', 'E0382', 'ok', 'E0382', 'ok', 'E0382'],
  'm05-l01': ['ok', 'E0596', 'ok', 'E0502', 'ok', 'ok'],
  'm06-l01': ['ok', 'E0106', 'ok', 'ok'],
  'm07-l01': ['ok', 'E0369', 'ok'],
}
const stdoutContracts = {
  'm02-l01:1': 'attempts = 3\n',
  'm02-l01:2': 'attempts = 4\n',
  'm02-l01:5': '42\n',
  'm02-l01:6': '10\n',
}
function extractRust(source) {
  const tick = String.fromCharCode(96).repeat(3)
  const fence = new RegExp(
    '^' + tick + '([^\\n\\r]*)\\r?\\n([\\s\\S]*?)^' + tick + '\\s*
}
const workspace = mkdtempSync(join(tmpdir(), 'rust-markdown-fences-'))
let compiled = 0
let rejected = 0
try {
  for (const [lesson, outcomes] of Object.entries(audited)) {
    const chinese = readFileSync(
      join(root, 'content/releases', lesson + '.md'),
      'utf8',
    )
    const english = readFileSync(
      join(root, 'content/releases/en', lesson + '.md'),
      'utf8',
    )
    const zhBlocks = extractRust(chinese)
    const enBlocks = extractRust(english)
    if (
      zhBlocks.length !== outcomes.length ||
      enBlocks.length !== outcomes.length
    ) {
      throw new Error(
        lesson +
          ': expected ' +
          outcomes.length +
          ' Rust fences, found zh=' +
          zhBlocks.length +
          ', en=' +
          enBlocks.length,
      )
    }
    for (let index = 0; index < outcomes.length; index++) {
      const code = zhBlocks[index]
      const expected = outcomes[index]
      const id = lesson + ':' + (index + 1)
      if (code !== enBlocks[index])
        throw new Error(id + ': bilingual Rust fences differ')
      const hasMain = /\bfn\s+main\s*\(/.test(code)
      const output = join(workspace, lesson + '-' + (index + 1))
      const args = ['--edition=2024', '--crate-name', 'lesson_fence']
      if (hasMain) args.push('--crate-type=bin')
      else args.push('--crate-type=lib', '--emit=metadata')
      args.push('-o', output, '-')
      const result = spawnSync('rustc', args, {
        cwd: root,
        input: code,
        encoding: 'utf8',
        timeout: 25_000,
        maxBuffer: 1024 * 1024,
      })
      if (result.error) throw result.error
      if (expected === 'ok') {
        if (result.status !== 0) {
          throw new Error(
            id + ': runnable fence failed to compile:\n' + result.stderr,
          )
        }
        compiled++
        if (hasMain) {
          const execution = run(output, [], root)
          if (execution.status !== 0) {
            throw new Error(
              id + ': executable fence failed:\n' + execution.stderr,
            )
          }
          const stdout = stdoutContracts[id]
          if (stdout !== undefined && execution.stdout !== stdout) {
            throw new Error(
              id +
                ': expected ' +
                JSON.stringify(stdout) +
                ' stdout, got ' +
                JSON.stringify(execution.stdout),
            )
          }
        }
      } else {
        if (
          result.status === 0 ||
          !result.stderr.includes('error[' + expected + ']')
        ) {
          throw new Error(
            id + ': expected ' + expected + ', got:\n' + result.stderr,
          )
        }
        rejected++
      }
    }
    process.stdout.write(
      lesson +
        ': ' +
        outcomes.length +
        ' Rust fences verified in both languages\n',
    )
  }
  process.stdout.write(
    'Verified ' +
      compiled +
      ' compiling/executing examples and ' +
      rejected +
      ' intentional rustc failures.\n',
  )
} finally {
  rmSync(workspace, { recursive: true, force: true })
}
,
    'gm',
  )
  return [...source.matchAll(fence)]
    .filter((match) => match[1].trim() === 'rust')
    .map((match) => match[2])
}
function run(program, args, cwd) {
  const result = spawnSync(program, args, {
    cwd,
    encoding: 'utf8',
    timeout: 25_000,
    maxBuffer: 1024 * 1024,
  })
  if (result.error) throw result.error
  return result
}
const workspace = mkdtempSync(join(tmpdir(), 'rust-markdown-fences-'))
let compiled = 0
let rejected = 0
try {
  for (const [lesson, outcomes] of Object.entries(audited)) {
    const chinese = readFileSync(join(root, 'content/releases', lesson + '.md'), 'utf8')
    const english = readFileSync(join(root, 'content/releases/en', lesson + '.md'), 'utf8')
    const zhBlocks = extractRust(chinese)
    const enBlocks = extractRust(english)
    if (zhBlocks.length !== outcomes.length || enBlocks.length !== outcomes.length) {
      throw new Error(lesson + ': expected ' + outcomes.length + ' Rust fences, found zh=' +
        zhBlocks.length + ', en=' + enBlocks.length)
    }
    for (let index = 0; index < outcomes.length; index++) {
      const code = zhBlocks[index]
      const expected = outcomes[index]
      const id = lesson + ':' + (index + 1)
      if (code !== enBlocks[index]) throw new Error(id + ': bilingual Rust fences differ')
      const hasMain = /\bfn\s+main\s*\(/.test(code)
      const output = join(workspace, lesson + '-' + (index + 1))
      const args = ['--edition=2024', '--crate-name', 'lesson_fence']
      if (hasMain) args.push('--crate-type=bin')
      else args.push('--crate-type=lib', '--emit=metadata')
      args.push('-o', output, '-')
      const result = spawnSync('rustc', args, {
        cwd: root, input: code, encoding: 'utf8', timeout: 25_000,
        maxBuffer: 1024 * 1024,
      })
      if (result.error) throw result.error
      if (expected === 'ok') {
        if (result.status !== 0) {
          throw new Error(id + ': runnable fence failed to compile:\n' + result.stderr)
        }
        compiled++
        if (hasMain) {
          const execution = run(output, [], root)
          if (execution.status !== 0) {
            throw new Error(id + ': executable fence failed:\n' + execution.stderr)
          }
          const stdout = stdoutContracts[id]
          if (stdout !== undefined && execution.stdout !== stdout) {
            throw new Error(id + ': expected ' + JSON.stringify(stdout) +
              ' stdout, got ' + JSON.stringify(execution.stdout))
          }
        }
      } else {
        if (result.status === 0 || !result.stderr.includes('error[' + expected + ']')) {
          throw new Error(id + ': expected ' + expected + ', got:\n' + result.stderr)
        }
        rejected++
      }
    }
    process.stdout.write(lesson + ': ' + outcomes.length + ' Rust fences verified in both languages\n')
  }
  process.stdout.write('Verified ' + compiled + ' compiling/executing examples and ' +
    rejected + ' intentional rustc failures.\n')
} finally {
  rmSync(workspace, { recursive: true, force: true })
}
