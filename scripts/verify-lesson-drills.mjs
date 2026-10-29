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

const metadata = run('cargo', [
  'metadata',
  '--offline',
  '--no-deps',
  '--format-version',
  '1',
  '--manifest-path',
  manifest,
])
if (metadata.status !== 0) {
  throw new Error('Cargo could not read the verified lesson manifest')
}
const packages = JSON.parse(metadata.stdout).packages
const course = packages.find(
  (pkg) => pkg.name === 'rust-path-verified-lesson-drills',
)
if (!course || course.edition !== '2024' || course.version !== '0.1.0') {
  throw new Error(
    'Cargo package identity or 2024 Edition differs from lesson contract',
  )
}
process.stdout.write('Verified Cargo edition 2024 and package version 0.1.0\n')

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
  ['m02_if_branch_type.rs', 'E0308'],
  ['m03_private_state.rs', 'E0616'],
  ['m04_direct_drop.rs', 'E0040'],
  ['m05_view_across_push.rs', 'E0502'],
  ['m06_view_of_local.rs', 'E0515'],
  ['m07_nondyn_trait.rs', 'E0038'],
  ['m08_fnmut_not_fn.rs', 'E0525'],
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
