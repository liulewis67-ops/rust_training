// Verify real bilingual Markdown code fences instead of only companion examples.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
// Each lesson enumerates all its Rust fences in reading order.
const audited = {
  'm01-l01': ['ok'],
  'm01-l03': ['E0308', 'test-fail', 'panic'],
  'm01-l04': ['ok', 'ok'],
  'm02-l02': ['ok', 'ok', 'reject:expected expression', 'ok', 'E0308'],
  'm02-l03': ['ok', 'E0308', 'ok', 'ok', 'ok'],
  'm02-l04': ['ok', 'ok', 'ok', 'ok', 'ok'],
  'm03-l01': ['ok', 'ok', 'ok'],
  'm03-l03': ['ok', 'ok', 'panic'],
  'm03-l04': ['ok', 'ok', 'ok'],
  'm04-l01': ['ok'],
  'm04-l03': ['ok', 'ok', 'ok', 'ok', 'ok'],
  'm04-l04': ['ok', 'E0382', 'ok'],
  'm05-l02': ['ok', 'E0502', 'ok'],
  'm06-l02': ['ok', 'ok', 'ok', 'E0106', 'ok', 'E0515'],
  'm06-l04': ['ok', 'ok', 'ok', 'E0597', 'ok'],
  'm02-l01': ['ok', 'ok', 'ok', 'ok', 'ok', 'ok'],
  'm03-l02': ['ok', 'ok'],
  'm04-l02': ['ok', 'E0382', 'ok', 'E0382', 'ok', 'E0382'],
  'm05-l01': ['ok', 'E0596', 'ok', 'E0502', 'ok', 'ok'],
  'm06-l01': ['ok', 'E0106', 'ok', 'ok'],
  'm07-l01': ['ok', 'E0369', 'ok'],
}
const stdoutContracts = {
  'm01-l01:1': 'INFO: started\n',
  'm02-l02:1': '750\n',
  'm02-l03:1': 'cool\n',
  'm02-l03:5': '1\n2\n3\n',
  'm03-l01:1': '8 by 5\n',
  'm03-l01:2': '10\n',
  'm03-l03:1': 'standard\nnot found\n',
  'm04-l03:5': 'map\n',
  'm06-l04:1': 'worker ready\n',
  'm06-l04:2': 'built-in\n',
  'm02-l01:1': 'attempts = 3\n',
  'm02-l01:2': 'attempts = 4\n',
  'm02-l01:5': '42\n',
  'm02-l01:6': '10\n',
}
function extractRust(source) {
  const tick = String.fromCharCode(96).repeat(3)
  const fence = new RegExp(
    '^' + tick + '([^\\n\\r]*)\\r?\\n([\\s\\S]*?)^' + tick + '\\s*$',
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
let observedPanics = 0
let observedFailedTests = 0
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
      const hasTests = /^\s*#\[test\]/m.test(code)
      const output = join(workspace, lesson + '-' + (index + 1))
      const args = ['--edition=2024', '--crate-name', 'lesson_fence']
      if (hasTests) args.push('--test')
      else if (hasMain) args.push('--crate-type=bin')
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
      if (expected.startsWith('E') || expected.startsWith('reject:')) {
        const diagnostic = expected.startsWith('reject:')
          ? expected.slice('reject:'.length)
          : 'error[' + expected + ']'
        if (result.status === 0 || !result.stderr.includes(diagnostic)) {
          throw new Error(
            id + ': expected compiler diagnostic ' + diagnostic + ', got:\n' +
              result.stderr,
          )
        }
        rejected++
        continue
      }
      if (result.status !== 0) {
        throw new Error(id + ': expected a compiling fence, got:\n' + result.stderr)
      }
      compiled++
      if (!hasMain && !hasTests) {
        if (expected !== 'ok') {
          throw new Error(id + ': runtime outcome requires fn main or #[test]')
        }
        continue
      }
      const execution = run(output, [], root)
      if (expected === 'panic') {
        if (execution.status === 0 || !execution.stderr.includes('panicked at')) {
          throw new Error(id + ': expected an actual runtime panic, got:\n' +
            execution.stderr)
        }
        observedPanics++
      } else if (expected === 'test-fail') {
        if (!hasTests || execution.status === 0 ||
          !execution.stdout.includes('test result: FAILED')) {
          throw new Error(id + ': expected a failing #[test] assertion, got:\n' +
            execution.stdout + execution.stderr)
        }
        observedFailedTests++
      } else if (expected === 'ok') {
        if (execution.status !== 0) {
          throw new Error(
            id + ': executable fence failed:\n' + execution.stderr,
          )
        }
        const stdout = stdoutContracts[id]
        if (stdout !== undefined && execution.stdout !== stdout) {
          throw new Error(
            id + ': expected ' + JSON.stringify(stdout) +
              ' stdout, got ' + JSON.stringify(execution.stdout),
          )
        }
      } else {
        throw new Error(id + ': unsupported outcome ' + expected)
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
      ' intentional rustc failures; ' +
      observedPanics + ' runtime panics; ' +
      observedFailedTests + ' failed assertions.\n',
  )
} finally {
  rmSync(workspace, { recursive: true, force: true })
}
