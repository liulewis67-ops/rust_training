// Verify executable lesson examples and deliberate compiler-error examples.
// No extra dependencies, network access, or changed project manifests needed.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const manifest = fileURLToPath(
  new URL('../content/samples/verified-lesson-drills/Cargo.toml', import.meta.url),
)
const failures = fileURLToPath(
  new URL('../content/samples/verified-lesson-drills/compile_fail/', import.meta.url),
)

function execute(program, args) {
  const result = spawnSync(program, args, { encoding: 'utf8' })
  if (result.error) throw result.error
  return result
}

const tested = execute('cargo', [
  'test',
  '--offline',
  '--manifest-path',
  manifest,
  '--lib',
])
if (tested.status !== 0) {
  throw new Error(`Executable drills failed:\n${tested.stdout}\n${tested.stderr}`)
}
process.stdout.write(tested.stdout)

const cases = [
  ['m02_tail_semicolon.rs', 'E0308'],
  ['m03_missing_variant.rs', 'E0004'],
  ['m04_used_after_move.rs', 'E0382'],
  ['m05_borrow_after_push.rs', 'E0502'],
  ['m06_ambiguous_result.rs', 'E0106'],
  ['m07_wrong_associated_output.rs', 'E0053'],
]
const outputDir = mkdtempSync(join(tmpdir(), 'rust-path-compile-fail-'))
try {
  for (const [file, expected] of cases) {
    const filePath = join(failures, file)
    const result = execute('rustc', [
      '--edition=2024',
      '--emit=metadata',
      '--out-dir',
      outputDir,
      filePath,
    ])
    if (result.status === 0 || !result.stderr.includes(`error[${expected}]`)) {
      throw new Error(
        `Unexpected compiler outcome for ${file}. Expected ${expected} and nonzero status.\n${result.stdout}\n${result.stderr}`,
      )
    }
    process.stdout.write(`Verified expected ${expected} in ${file}\n`)
  }
} finally {
  rmSync(outputDir, { recursive: true, force: true })
}
