import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, realpath, rm } from 'node:fs/promises'
import { promisify } from 'node:util'
import { isAbsolute, relative, resolve, sep } from 'node:path'

const execFileAsync = promisify(execFile)
const rootDirectory = resolve(import.meta.dirname, '..')
const sampleDirectory = resolve(rootDirectory, 'content/samples')
const verificationDirectory = resolve(rootDirectory, '.verification')
const MAX_OUTPUT_BYTES = 1024 * 1024
const PROCESS_TIMEOUT_MS = 30000

/** Run a local tool without a shell and retain compiler diagnostics on nonzero exit. */
async function runProcess(command, args, cwd, timeout = PROCESS_TIMEOUT_MS) {
  try {
    const result = await execFileAsync(command, args, {
      cwd,
      encoding: 'utf8',
      maxBuffer: MAX_OUTPUT_BYTES,
      timeout,
      windowsHide: true,
    })
    return { exitCode: 0, stdout: result.stdout, stderr: result.stderr }
  } catch (error) {
    if (typeof error.code === 'number') {
      return {
        exitCode: error.code,
        stdout: error.stdout ?? '',
        stderr: error.stderr ?? '',
      }
    }
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`${command} could not complete: ${message}`)
  }
}

/** Resolve a Rust source file only from the checked-in sample directory. */
async function resolveSampleSource(sourceFile) {
  if (
    typeof sourceFile !== 'string' ||
    isAbsolute(sourceFile) ||
    !sourceFile.endsWith('.rs')
  ) {
    throw new Error('sample source must be a relative .rs file path')
  }
  const resolvedSampleDirectory = await realpath(sampleDirectory)
  const resolvedSource = await realpath(resolve(sampleDirectory, sourceFile))
  const sourceRelativePath = relative(resolvedSampleDirectory, resolvedSource)
  if (
    !sourceRelativePath ||
    sourceRelativePath === '..' ||
    sourceRelativePath.startsWith(`..${sep}`) ||
    resolve(resolvedSampleDirectory, sourceRelativePath) !== resolvedSource
  ) {
    throw new Error(
      `sample source escapes the checked-in sample directory: ${sourceFile}`,
    )
  }
  return resolvedSource
}

/** Compile one trusted sample with the locked Edition and return its binary path or diagnostics. */
async function compileSample(
  sample,
  manifest,
  workspace,
  { testHarness = false } = {},
) {
  const sourcePath = await resolveSampleSource(sample.source)
  const outputPath = resolve(
    workspace,
    `${sample.id}${process.platform === 'win32' ? '.exe' : ''}`,
  )
  const compilerArgs = [
    '--edition',
    manifest.edition,
    sourcePath,
    '--crate-name',
    sample.id.replaceAll('-', '_'),
    '-o',
    outputPath,
  ]
  if (testHarness) compilerArgs.unshift('--test')
  const compilation = await runProcess('rustc', compilerArgs, rootDirectory)
  return { ...compilation, outputPath }
}

/** Extract stable Rust error codes without depending on localized or unstable prose. */
function diagnosticCodes(output) {
  const codes = new Set()
  for (const match of output.matchAll(/error\[([A-Z]\d+)\]/g)) {
    codes.add(match[1])
  }
  return codes
}

/** Validate a runnable example by compiling it, executing it and comparing its output. */
async function verifyRunnable(sample, manifest, workspace) {
  const compilation = await compileSample(sample, manifest, workspace)
  if (compilation.exitCode !== 0) {
    throw new Error(
      `${sample.id}: runnable example did not compile\n${compilation.stderr}`,
    )
  }
  const execution = await runProcess(
    compilation.outputPath,
    [],
    rootDirectory,
    10000,
  )
  if (execution.exitCode !== 0) {
    throw new Error(
      `${sample.id}: runnable example exited ${execution.exitCode}\n${execution.stderr}`,
    )
  }
  if (execution.stdout !== sample.expected_stdout) {
    throw new Error(
      `${sample.id}: stdout mismatch; expected ${JSON.stringify(sample.expected_stdout)}, received ${JSON.stringify(execution.stdout)}`,
    )
  }
}

/** Verify a compile-fail example reaches its declared Rust error category. */
async function verifyExpectedCompileFailure(sample, manifest, workspace) {
  const compilation = await compileSample(sample, manifest, workspace)
  const output = `${compilation.stdout}\n${compilation.stderr}`
  const codes = diagnosticCodes(output)
  if (compilation.exitCode === 0 || !codes.has(sample.expected_error_code)) {
    throw new Error(
      `${sample.id}: expected ${sample.expected_error_code}, received ${[...codes].join(', ') || 'no Rust error code'}\n${compilation.stderr}`,
    )
  }
}

/** Verify a correct solution passes all tests and a deliberately incorrect one fails a test. */
async function verifySolution(sample, manifest, workspace) {
  const compilation = await compileSample(sample, manifest, workspace, {
    testHarness: true,
  })
  if (compilation.exitCode !== 0) {
    throw new Error(
      `${sample.id}: solution test harness did not compile\n${compilation.stderr}`,
    )
  }
  const execution = await runProcess(
    compilation.outputPath,
    [],
    rootDirectory,
    10000,
  )
  const output = `${execution.stdout}\n${execution.stderr}`
  if (sample.expected_outcome === 'pass' && execution.exitCode !== 0) {
    throw new Error(`${sample.id}: correct solution tests failed\n${output}`)
  }
  if (
    sample.expected_outcome === 'test_failure' &&
    (execution.exitCode === 0 || !output.includes('test result: FAILED'))
  ) {
    throw new Error(
      `${sample.id}: incorrect solution was not rejected by a failing test\n${output}`,
    )
  }
}

/** Confirm a syntax error cannot accidentally satisfy an expected borrow-checker failure. */
async function verifySyntaxRejection(testCase, manifest, workspace) {
  const compilation = await compileSample(testCase, manifest, workspace)
  const output = `${compilation.stdout}\n${compilation.stderr}`
  if (
    compilation.exitCode === 0 ||
    diagnosticCodes(output).has(testCase.must_not_match_error_code)
  ) {
    throw new Error(
      `${testCase.id}: syntax-only input was not rejected as a different error category\n${compilation.stderr}`,
    )
  }
}

/** Check manifest invariants before compiling source files. */
function validateManifest(manifest) {
  const errors = []
  if (manifest?.schema_version !== '1.0.0') {
    errors.push('schema_version must be 1.0.0')
  }
  if (manifest?.edition !== '2024') errors.push('edition must be 2024')
  if (!Array.isArray(manifest?.examples) || manifest.examples.length !== 5) {
    errors.push('examples must list the five required sample kinds')
  }
  if (
    !Array.isArray(manifest?.validator_cases) ||
    !manifest.validator_cases.length
  ) {
    errors.push('validator_cases must include a syntax-only negative case')
  }
  const examples = Array.isArray(manifest?.examples) ? manifest.examples : []
  const requiredKinds = new Map([
    ['runnable', 1],
    ['fragment', 1],
    ['compile_fail', 1],
    ['solution', 2],
  ])
  const actualKinds = new Map()
  const solutionOutcomes = new Set()
  for (const sample of examples) {
    if (!sample || typeof sample !== 'object') continue
    actualKinds.set(sample.kind, (actualKinds.get(sample.kind) ?? 0) + 1)
    if (sample.kind === 'solution') {
      solutionOutcomes.add(sample.expected_outcome)
    }
  }
  for (const [kind, expectedCount] of requiredKinds) {
    const actualCount = actualKinds.get(kind) ?? 0
    if (actualCount !== expectedCount) {
      errors.push(`examples must include ${expectedCount} ${kind} sample(s)`)
    }
  }
  if (!solutionOutcomes.has('pass') || !solutionOutcomes.has('test_failure')) {
    errors.push(
      'solution samples must include one passing and one failing solution',
    )
  }
  for (const testCase of Array.isArray(manifest?.validator_cases)
    ? manifest.validator_cases
    : []) {
    if (!/^E\d+$/.test(testCase?.must_not_match_error_code ?? '')) {
      errors.push(
        'syntax-only validator cases must declare the target error code to reject',
      )
    }
  }

  const ids = new Set()
  for (const sample of [
    ...(Array.isArray(manifest?.examples) ? manifest.examples : []),
    ...(Array.isArray(manifest?.validator_cases)
      ? manifest.validator_cases
      : []),
  ]) {
    if (!sample || typeof sample !== 'object') {
      errors.push('each sample entry must be an object')
      continue
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(sample.id ?? '')) {
      errors.push('each sample entry must have a stable kebab-case ID')
    } else if (ids.has(sample.id)) {
      errors.push(`duplicate sample ID: ${sample.id}`)
    } else {
      ids.add(sample.id)
    }
  }
  return errors
}

/** Run all locked course samples and report the exact compiler used. */
export async function validateCourseSamples(manifestPath) {
  const absoluteManifestPath = resolve(rootDirectory, manifestPath)
  const manifest = JSON.parse(await readFile(absoluteManifestPath, 'utf8'))
  const manifestErrors = validateManifest(manifest)
  if (manifestErrors.length) throw new Error(manifestErrors.join('\n'))

  const compiler = await runProcess('rustc', ['--version'], rootDirectory)
  if (compiler.exitCode !== 0)
    throw new Error(compiler.stderr || 'rustc is unavailable')
  const actualVersion = compiler.stdout.trim().match(/^rustc ([^ ]+)/)?.[1]
  if (actualVersion !== manifest.rust_version) {
    throw new Error(
      `Rust toolchain mismatch: expected ${manifest.rust_version}, received ${actualVersion ?? compiler.stdout.trim()}`,
    )
  }

  await mkdir(verificationDirectory, { recursive: true })
  const workspace = await mkdtemp(
    resolve(verificationDirectory, 'course-samples-'),
  )
  const verifiedSamples = []
  let rejectedSyntaxCase = false
  try {
    for (const sample of manifest.examples) {
      if (sample.kind === 'runnable') {
        if (typeof sample.expected_stdout !== 'string') {
          throw new Error(
            `${sample.id}: runnable sample requires expected_stdout`,
          )
        }
        await verifyRunnable(sample, manifest, workspace)
      } else if (sample.kind === 'fragment') {
        if (
          sample.runnable !== false ||
          typeof sample.execution_note !== 'string' ||
          !sample.execution_note.trim()
        ) {
          throw new Error(
            `${sample.id}: fragments must be explicitly non-runnable with an explanation`,
          )
        }
        await resolveSampleSource(sample.source)
      } else if (sample.kind === 'compile_fail') {
        if (!/^E\d+$/.test(sample.expected_error_code ?? '')) {
          throw new Error(
            `${sample.id}: compile-fail sample requires a Rust error code`,
          )
        }
        await verifyExpectedCompileFailure(sample, manifest, workspace)
      } else if (sample.kind === 'solution') {
        if (!['pass', 'test_failure'].includes(sample.expected_outcome)) {
          throw new Error(
            `${sample.id}: solution outcome must be pass or test_failure`,
          )
        }
        await verifySolution(sample, manifest, workspace)
      } else {
        throw new Error(
          `${sample.id}: unsupported sample kind "${sample.kind}"`,
        )
      }
      verifiedSamples.push(sample.id)
    }

    for (const testCase of manifest.validator_cases) {
      await verifySyntaxRejection(testCase, manifest, workspace)
      rejectedSyntaxCase = true
    }
  } finally {
    await rm(workspace, { force: true, recursive: true })
  }

  if (!rejectedSyntaxCase)
    throw new Error('syntax-only negative case was not executed')
  return {
    compiler: `rustc ${actualVersion}`,
    verifiedSamples,
    rejectedSyntaxCase,
  }
}

/** Print usage and return a command-line argument failure. */
function printUsage() {
  console.error(
    'Usage: node scripts/validate-course-samples.mjs validate [manifest.json]',
  )
  return 2
}

/** Execute the validator command and convert validation errors to a nonzero exit code. */
async function runCli(argumentsList) {
  const [command, manifestPath, ...extraArguments] = argumentsList
  if (command !== 'validate' || extraArguments.length) return printUsage()
  try {
    const result = await validateCourseSamples(
      manifestPath ?? 'content/course-samples.json',
    )
    console.log(
      `Verified ${result.verifiedSamples.length} course samples with ${result.compiler}`,
    )
    if (result.rejectedSyntaxCase) {
      console.log('Validator negative case: rejected syntax-only failure')
    }
    return 0
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return 1
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) ===
    resolve(import.meta.dirname, 'validate-course-samples.mjs')
) {
  process.exitCode = await runCli(process.argv.slice(2))
}
