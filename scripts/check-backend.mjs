import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

// 未交付后端时显式失败，避免把缺失的 Cargo 检查报告为通过。
if (!existsSync('backend/Cargo.toml')) {
  console.error('后端检查未运行：backend/Cargo.toml 尚未建立。')
  process.exit(1)
}

const checks = [
  ['fmt', '--all', '--', '--check'],
  ['check', '--workspace', '--all-targets', '--locked'],
  [
    'clippy',
    '--workspace',
    '--all-targets',
    '--locked',
    '--',
    '-D',
    'warnings',
  ],
  ['test', '--workspace', '--locked'],
  ['doc', '--workspace', '--no-deps', '--locked'],
]

for (const args of checks) {
  console.log(`cargo ${args.join(' ')}`)
  const result = spawnSync('cargo', args, {
    cwd: 'backend',
    stdio: 'inherit',
    env: { ...process.env, RUSTDOCFLAGS: '-D warnings' },
  })
  if (result.error) console.error(result.error.message)
  if (result.status !== 0) process.exit(result.status ?? 1)
}
