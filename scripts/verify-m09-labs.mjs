import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')

function cargoTests(project) {
  const result = spawnSync(
    'cargo',
    [
      'test',
      '--offline',
      '--manifest-path',
      resolve(root, 'content/samples', project, 'Cargo.toml'),
    ],
    {
      cwd: root,
      encoding: 'utf8',
      timeout: 120_000,
      maxBuffer: 1024 * 1024,
    },
  )
  if (result.error) throw result.error
  return {
    code: result.status,
    output: `${result.stdout ?? ''}\n${result.stderr ?? ''}`,
  }
}

const starter = cargoTests('m09-starter')
const intendedFailures = [
  'l05_duplicate_fields_are_not_overwritten',
  'l05_duplicate_precedes_later_unknown_fields_and_bad_values',
  'l06_api_status_code_retry_and_request_id',
  'l06_unicode_request_id_and_internal_diagnostics_are_separate',
]
if (
  starter.code === 0 ||
  !starter.output.includes('test result: FAILED') ||
  !intendedFailures.every((test) =>
    starter.output.includes(`tests::${test} ... FAILED`),
  ) ||
  !starter.output.includes('7 passed; 4 failed')
) {
  throw new Error(
    `M09 starter must compile and fail only its two deliberate contract cases:\n${starter.output}`,
  )
}

const reference = cargoTests('m09-reference')
if (
  reference.code !== 0 ||
  !reference.output.includes('test result: ok. 11 passed; 0 failed')
) {
  throw new Error(`M09 reference tests failed:\n${reference.output}`)
}
console.log(
  'M09: intentional starter failures and all reference contracts verified.',
)
