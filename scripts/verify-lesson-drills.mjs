// Check passing Rust lessons and deliberately rejected source files.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const samples = new URL(
  '../content/samples/verified-lesson-drills/',
  import.meta.url,
)
const manifest = fileURLToPath(new URL('Cargo.toml', samples))
const failedDir = fileURLToPath(new URL('compile_fail/', samples))

function run(program, args) {
  const result = spawnSync(program, args, { encoding: 'utf8' })
  if (result.error) throw result.error
  return result
}

const tested = run('cargo', [
  'test',
  '--offline',
  '--manifest-path',
  manifest,
  '--lib',
])
if (tested.status !== 0) {
  process.stderr.write(tested.stdout)
  process.stderr.write(tested.stderr)
  throw new Error('The executable Rust lesson tests did not pass')
}
process.stdout.write(tested.stdout)

const cases = [
  ['m02_tail_semicolon.rs', 'E0308'],
  ['m03_missing_variant.rs', 'E0004'],
  ['m04_used_after_move.rs', 'E0382'],
  ['m05_borrow_after_push.rs', 'E0502'],
  ['m06_ambiguous_result.rs', 'E0106'],
  ['m07_wrong_associated_output.rs', 'E0053'],
  ['m01_diagnostic_type.rs', 'E0308'],
  ['m04_partial_move.rs', 'E0382'],
  ['m06_nonstatic_borrow.rs', 'E0597'],
  ['m07_mixed_newtypes.rs', 'E0308'],
  ['m08_after_into_iter.rs', 'E0382'],
  ['m09_incompatible_question.rs', 'E0277'],
]

const outputDir = mkdtempSync(join(tmpdir(), 'rust-path-compile-fail-'))
try {
  for (const [file, code] of cases) {
    const result = run('rustc', [
      '--edition=2024',
      '--emit=metadata',
      '--out-dir',
      outputDir,
      join(failedDir, file),
    ])
    if (result.status === 0 || !result.stderr.includes(`error[${code}]`)) {
      process.stderr.write(result.stderr)
      throw new Error(`Expected compiler error ${code} in ${file}`)
    }
    process.stdout.write(`Verified expected ${code} in ${file}\n`)
  }
} finally {
  rmSync(outputDir, { recursive: true, force: true })
}
