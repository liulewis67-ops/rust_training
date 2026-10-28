import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')

function runCargo(project, action) {
  const result = spawnSync(
    'cargo',
    [
      action,
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
    exitCode: result.status,
    output: `${result.stdout ?? ''}\n${result.stderr ?? ''}`,
  }
}

const starter = runCargo('m08-starter', 'test')
if (
  starter.exitCode === 0 ||
  !starter.output.includes('test result: FAILED') ||
  !starter.output.includes('l05_duplicate_services_accumulate') ||
  !starter.output.includes(
    'l06_zero_value_counts_and_rejected_sensor_is_listed',
  )
) {
  throw new Error(
    `M08 starter must compile and expose the intended behavior failures:\n${starter.output}`,
  )
}

const reference = runCargo('m08-reference', 'test')
if (reference.exitCode !== 0 || !reference.output.includes('test result: ok')) {
  throw new Error(
    `M08 reference must pass all public tests:\n${reference.output}`,
  )
}

console.log('M08 local lab: starter fails expected checks; reference passes.')
