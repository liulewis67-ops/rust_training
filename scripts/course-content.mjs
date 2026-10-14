import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const rootDirectory = resolve(import.meta.dirname, '..')
const courseSchema = JSON.parse(
  await readFile(
    resolve(rootDirectory, 'schemas/course-pack.schema.json'),
    'utf8',
  ),
)
const privateAssessmentSchema = JSON.parse(
  await readFile(
    resolve(rootDirectory, 'schemas/private-assessment.schema.json'),
    'utf8',
  ),
)

/** Validate a value against the JSON Schema subset used by the checked-in schemas. */
function validateSchema(value, schema, path, errors, rootSchema = schema) {
  if (schema.$ref) {
    // Resolve only local schema refs so validation never follows network URLs.
    const referencedSchema = schema.$ref
      .slice(2)
      .split('/')
      .reduce((current, part) => current[part], rootSchema)
    validateSchema(value, referencedSchema, path, errors, rootSchema)
    return
  }

  if (schema.anyOf) {
    // Probe each candidate without leaking one branch's diagnostics into another.
    const matchingBranch = schema.anyOf.some((branch) => {
      const branchErrors = []
      validateSchema(value, branch, path, branchErrors, rootSchema)
      return branchErrors.length === 0
    })
    if (!matchingBranch)
      errors.push(`${path}: value does not match any allowed schema`)
    return
  }

  const actualType = Array.isArray(value)
    ? 'array'
    : value === null
      ? 'null'
      : typeof value
  if (schema.type && actualType !== schema.type) {
    errors.push(`${path}: expected ${schema.type}, received ${actualType}`)
    return
  }

  if (schema.const !== undefined && value !== schema.const) {
    errors.push(`${path}: expected ${JSON.stringify(schema.const)}`)
  }
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${path}: expected one of ${schema.enum.join(', ')}`)
  }
  if (typeof value === 'string') {
    if (schema.minLength && value.length < schema.minLength) {
      errors.push(
        `${path}: must contain at least ${schema.minLength} character(s)`,
      )
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      errors.push(`${path}: does not match required format`)
    }
    if (schema.format === 'date') {
      const dateSyntaxIsValid = /^\d{4}-\d{2}-\d{2}$/.test(value)
      const parsedDate = dateSyntaxIsValid
        ? new Date(`${value}T00:00:00Z`)
        : undefined
      if (
        !parsedDate ||
        Number.isNaN(parsedDate.getTime()) ||
        parsedDate.toISOString().slice(0, 10) !== value
      ) {
        errors.push(`${path}: expected a valid YYYY-MM-DD date`)
      }
    }
  }
  if (Array.isArray(value)) {
    if (schema.minItems && value.length < schema.minItems) {
      errors.push(`${path}: must contain at least ${schema.minItems} item(s)`)
    }
    if (
      schema.uniqueItems &&
      // Duplicate JSON values are rejected before domain-level ID checks.
      new Set(value.map((item) => JSON.stringify(item))).size !== value.length
    ) {
      errors.push(`${path}: items must be unique`)
    }
    if (schema.items) {
      // Keep nested schema failures anchored to the exact array index.
      value.forEach((item, index) => {
        validateSchema(
          item,
          schema.items,
          `${path}[${index}]`,
          errors,
          rootSchema,
        )
      })
    }
  }
  if (actualType === 'object') {
    for (const requiredKey of schema.required ?? []) {
      if (!(requiredKey in value))
        errors.push(`${path}.${requiredKey}: required field is missing`)
    }
    for (const [key, child] of Object.entries(value)) {
      const childSchema = schema.properties?.[key]
      if (childSchema) {
        validateSchema(child, childSchema, `${path}.${key}`, errors, rootSchema)
      } else if (schema.additionalProperties === false) {
        errors.push(`${path}.${key}: field is not allowed`)
      }
    }
  }
}

/** Build a map of stable IDs and report duplicates at the later item's field path. */
function indexEntities(entities, collectionName, errors) {
  const byId = new Map()
  // The later duplicate is the actionable location to show to the author.
  const entityList = Array.isArray(entities) ? entities : []
  for (const [index, entity] of entityList.entries()) {
    if (typeof entity?.id !== 'string') continue
    const path = `${collectionName}[${index}].id`
    if (byId.has(entity.id))
      errors.push(`${path}: duplicate stable ID "${entity.id}"`)
    else byId.set(entity.id, { entity, index })
  }
  return byId
}

/** Validate referenced IDs and report the exact array entry that cannot be resolved. */
function validateReferences(
  items,
  fieldName,
  knownIds,
  collectionName,
  errors,
) {
  // Report each bad reference independently so one run can reveal all broken links.
  for (const [itemIndex, item] of items.entries()) {
    const references =
      item && typeof item === 'object' && Array.isArray(item[fieldName])
        ? item[fieldName]
        : []
    for (const [referenceIndex, referenceId] of references.entries()) {
      if (!knownIds.has(referenceId)) {
        errors.push(
          `${collectionName}[${itemIndex}].${fieldName}[${referenceIndex}]: unknown ID "${referenceId}"`,
        )
      }
    }
  }
}

/** Validate versioned local/external prerequisite edges and reject graph cycles. */
function validatePrerequisiteGraph(pack, dependencies, errors) {
  if (dependencies !== undefined && !Array.isArray(dependencies)) {
    errors.push('dependencies: expected an array of course packs')
    return
  }

  const packageEntries = [
    { pack, path: 'course' },
    ...(dependencies ?? []).map((dependency, index) => ({
      pack: dependency,
      path: `dependencies[${index}]`,
    })),
  ]
  const packagesByVersion = new Map()
  const graph = new Map()

  for (const [packageIndex, entry] of packageEntries.entries()) {
    if (packageIndex > 0) {
      validateSchema(entry.pack, courseSchema, entry.path, errors, courseSchema)
    }
    if (
      typeof entry.pack?.course_id !== 'string' ||
      typeof entry.pack?.version !== 'string'
    ) {
      continue
    }

    const packageKey = JSON.stringify([
      entry.pack.course_id,
      entry.pack.version,
    ])
    if (packagesByVersion.has(packageKey)) {
      errors.push(
        `${entry.path}: duplicate course package "${entry.pack.course_id}@${entry.pack.version}"`,
      )
      continue
    }
    const lessons = Array.isArray(entry.pack.lessons) ? entry.pack.lessons : []
    const lessonIds = indexEntities(lessons, `${entry.path}.lessons`, errors)
    packagesByVersion.set(packageKey, { ...entry, lessons, lessonIds })
  }

  for (const entry of packagesByVersion.values()) {
    const packageKey = JSON.stringify([
      entry.pack.course_id,
      entry.pack.version,
    ])
    for (const lesson of entry.lessons) {
      if (typeof lesson?.id !== 'string') continue
      const nodeId = `${packageKey}#${lesson.id}`
      graph.set(nodeId, [])
    }
  }

  for (const entry of packagesByVersion.values()) {
    const packageKey = JSON.stringify([
      entry.pack.course_id,
      entry.pack.version,
    ])
    for (const [lessonIndex, lesson] of entry.lessons.entries()) {
      if (typeof lesson?.id !== 'string') continue
      const nodeId = `${packageKey}#${lesson.id}`
      const nodePath = `${entry.path}.lessons[${lessonIndex}]`
      const edges = graph.get(nodeId)
      const localPrerequisites = Array.isArray(lesson.prerequisites)
        ? lesson.prerequisites
        : []
      for (const [
        referenceIndex,
        prerequisiteId,
      ] of localPrerequisites.entries()) {
        const prerequisite = entry.lessonIds.get(prerequisiteId)
        if (!prerequisite) {
          errors.push(
            `${nodePath}.prerequisites[${referenceIndex}]: unknown ID "${prerequisiteId}"`,
          )
          continue
        }
        edges.push({
          nodeId: `${packageKey}#${prerequisiteId}`,
          path: `${nodePath}.prerequisites[${referenceIndex}]`,
        })
      }

      const externalPrerequisites = Array.isArray(lesson.external_prerequisites)
        ? lesson.external_prerequisites
        : []
      for (const [
        referenceIndex,
        prerequisite,
      ] of externalPrerequisites.entries()) {
        if (
          typeof prerequisite?.course_id !== 'string' ||
          typeof prerequisite?.version !== 'string' ||
          typeof prerequisite?.lesson_id !== 'string'
        ) {
          continue
        }
        const dependencyKey = JSON.stringify([
          prerequisite.course_id,
          prerequisite.version,
        ])
        const dependency = packagesByVersion.get(dependencyKey)
        const referencePath = `${nodePath}.external_prerequisites[${referenceIndex}]`
        if (!dependency) {
          errors.push(
            `${referencePath}: missing dependency course "${prerequisite.course_id}@${prerequisite.version}"`,
          )
          continue
        }
        if (dependency === entry) {
          errors.push(
            `${referencePath}: use prerequisites for lessons in the same course package`,
          )
          continue
        }
        if (!dependency.lessonIds.has(prerequisite.lesson_id)) {
          errors.push(
            `${referencePath}: unknown lesson "${prerequisite.lesson_id}" in "${prerequisite.course_id}@${prerequisite.version}"`,
          )
          continue
        }
        edges.push({
          nodeId: `${dependencyKey}#${prerequisite.lesson_id}`,
          path: referencePath,
        })
      }
    }
  }

  const state = new Map()
  const stack = []

  /** Visit a lesson node while retaining the edge that introduced a cycle. */
  function visit(nodeId) {
    if (state.get(nodeId) === 'complete') return
    state.set(nodeId, 'visiting')
    stack.push(nodeId)
    for (const edge of graph.get(nodeId) ?? []) {
      if (state.get(edge.nodeId) === 'visiting') {
        const cycleStart = stack.indexOf(edge.nodeId)
        const cycle = [...stack.slice(cycleStart), edge.nodeId].join(' -> ')
        errors.push(`${edge.path}: prerequisite cycle ${cycle}`)
      } else if (state.get(edge.nodeId) !== 'complete') {
        visit(edge.nodeId)
      }
    }
    stack.pop()
    state.set(nodeId, 'complete')
  }

  for (const nodeId of graph.keys()) visit(nodeId)
}

/** Ensure public resources stay in the public tree and are never referenced as private data. */
function validatePublicResources(pack, lessonIds, errors) {
  const resources = Array.isArray(pack.resources) ? pack.resources : []
  const resourceIds = indexEntities(resources, 'resources', errors)
  for (const [resourceId, resource] of resourceIds) {
    const resourcePath = resource.entity.path
    if (typeof resourcePath !== 'string') continue
    const pathParts = resourcePath.replaceAll('\\', '/').split('/')
    const isPrivateResource = resource.entity.visibility === 'private'
    if (
      resourcePath.startsWith('/') ||
      /^[A-Za-z]:/.test(resourcePath) ||
      pathParts.includes('..') ||
      (isPrivateResource && !resourcePath.startsWith('private-assessment/')) ||
      (!isPrivateResource && !resourcePath.startsWith('public/'))
    ) {
      errors.push(
        `resources[${resource.index}].path: resource path must stay inside its declared pack`,
      )
    }
    if (
      pack.visibility === 'public' &&
      resource.entity.visibility !== 'public'
    ) {
      errors.push(
        `resources[${resource.index}].visibility: public packs may contain only public resources`,
      )
    }
  }

  for (const [lessonId, lessonEntry] of lessonIds) {
    const lessonResources = lessonEntry.entity.resource_ids
    for (const [resourceIndex, resourceId] of (Array.isArray(lessonResources)
      ? lessonResources
      : []
    ).entries()) {
      const resourceEntry = resourceIds.get(resourceId)
      if (
        resourceEntry &&
        pack.visibility === 'public' &&
        resourceEntry.entity.visibility !== 'public'
      ) {
        errors.push(
          `lessons[${lessonEntry.index}].resource_ids[${resourceIndex}]: public lesson "${lessonId}" cannot reference a private resource`,
        )
      }
    }
  }
  return resourceIds
}

/** Check that private assessment records match public references without exposing their contents. */
function validatePrivateAssessment(
  pack,
  privatePack,
  exercises,
  publicResourceIds,
  errors,
) {
  if (privatePack === undefined) return
  validateSchema(
    privatePack,
    privateAssessmentSchema,
    'privatePack',
    errors,
    privateAssessmentSchema,
  )
  if (privatePack?.course_id !== pack.course_id) {
    errors.push('privatePack.course_id: must match the public course_id')
  }
  if (privatePack?.version !== pack.version) {
    errors.push('privatePack.version: must match the public course version')
  }

  const privateAssessments = Array.isArray(privatePack?.assessments)
    ? privatePack.assessments
    : []
  const assessments = indexEntities(
    privateAssessments,
    'privatePack.assessments',
    errors,
  )
  // Public exercises expose opaque assessment IDs, never the answer bundle contents.
  const referencedAssessmentIds = new Set()
  const assessmentExerciseIds = new Map()
  for (const [exerciseIndex, exercise] of exercises.entries()) {
    if (!exercise || typeof exercise !== 'object') continue
    if (exercise.private_assessment_id) {
      if (assessmentExerciseIds.has(exercise.private_assessment_id)) {
        errors.push(
          `exercises[${exerciseIndex}].private_assessment_id: assessment ID is already assigned to another exercise`,
        )
      }
      referencedAssessmentIds.add(exercise.private_assessment_id)
      assessmentExerciseIds.set(exercise.private_assessment_id, exercise.id)
    }
    if (
      exercise.private_assessment_id &&
      !assessments.has(exercise.private_assessment_id)
    ) {
      errors.push(
        `exercises: missing private assessment "${exercise.private_assessment_id}" referenced by "${exercise.id}"`,
      )
    }
  }
  for (const [assessmentId, assessmentEntry] of assessments) {
    if (!referencedAssessmentIds.has(assessmentId)) {
      errors.push(
        `privatePack.assessments[${assessmentEntry.index}].id: assessment "${assessmentId}" is not referenced by a public exercise`,
      )
    }
    // Bind each private answer bundle to the exercise that declared its assessment ID.
    if (
      assessmentExerciseIds.get(assessmentId) !==
      assessmentEntry.entity.exercise_id
    ) {
      errors.push(
        `privatePack.assessments[${assessmentEntry.index}].exercise_id: must match the exercise that references "${assessmentId}"`,
      )
    }
  }
  const privateResources = Array.isArray(privatePack?.resources)
    ? privatePack.resources
    : []
  indexEntities(privateResources, 'privatePack.resources', errors)
  for (const [resourceIndex, resource] of privateResources.entries()) {
    if (!resource || typeof resource !== 'object') continue
    if (resource.id && publicResourceIds.has(resource.id)) {
      errors.push(
        `privatePack.resources[${resourceIndex}].id: resource ID is already used by the public pack`,
      )
    }
    if (typeof resource.path !== 'string') continue
    const pathParts = resource.path.replaceAll('\\', '/').split('/')
    if (
      resource.path.startsWith('/') ||
      /^[A-Za-z]:/.test(resource.path) ||
      pathParts.includes('..') ||
      !resource.path.startsWith('private-assessment/')
    ) {
      errors.push(
        `privatePack.resources[${resourceIndex}].path: resource path must stay inside the private assessment tree`,
      )
    }
  }
}

/** Validate course-pack shape, stable identifiers, references, prerequisites and visibility. */
export function validateCoursePack(pack, options = {}) {
  const errors = []
  validateSchema(pack, courseSchema, 'course', errors, courseSchema)
  if (!pack || typeof pack !== 'object' || Array.isArray(pack))
    return { errors }

  const lessons = Array.isArray(pack.lessons) ? pack.lessons : []
  const exercises = Array.isArray(pack.exercises) ? pack.exercises : []
  const sources = Array.isArray(pack.sources) ? pack.sources : []
  const lessonIds = indexEntities(lessons, 'lessons', errors)
  const exerciseIds = indexEntities(exercises, 'exercises', errors)
  const sourceIds = indexEntities(sources, 'sources', errors)
  const resourceIds = validatePublicResources(pack, lessonIds, errors)
  const environmentIds = new Set(
    pack.environment?.id ? [pack.environment.id] : [],
  )

  // A listed exercise must point back to the lesson that owns it.
  for (const [lessonIndex, lesson] of lessons.entries()) {
    if (!lesson || typeof lesson !== 'object') continue
    const lessonExercises = Array.isArray(lesson.exercise_ids)
      ? lesson.exercise_ids
      : []
    for (const [exerciseIndex, exerciseId] of lessonExercises.entries()) {
      const exerciseEntry = exerciseIds.get(exerciseId)
      if (exerciseEntry && exerciseEntry.entity.lesson_id !== lesson.id) {
        errors.push(
          `lessons[${lessonIndex}].exercise_ids[${exerciseIndex}]: exercise "${exerciseId}" belongs to a different lesson`,
        )
      }
    }
  }

  validateReferences(lessons, 'source_ids', sourceIds, 'lessons', errors)
  validateReferences(lessons, 'resource_ids', resourceIds, 'lessons', errors)
  validateReferences(lessons, 'exercise_ids', exerciseIds, 'lessons', errors)
  validatePrerequisiteGraph(pack, options.dependencies, errors)
  if (options.samples !== undefined) {
    const sampleEntries = Array.isArray(options.samples?.examples)
      ? options.samples.examples
      : []
    if (!Array.isArray(options.samples?.examples)) {
      errors.push('samples.examples: expected an array of verified example IDs')
    }
    // One lesson pack must never promise a compiler/edition different from the examples it references.
    for (const field of ['rust_version', 'edition']) {
      if (
        typeof options.samples?.[field] === 'string' &&
        pack.environment?.[field] !== options.samples[field]
      ) {
        errors.push(
          `course.environment.${field}: must match sample manifest ${field} ("${options.samples[field]}")`,
        )
      }
    }
    const sampleIds = indexEntities(sampleEntries, 'samples.examples', errors)
    validateReferences(lessons, 'example_ids', sampleIds, 'lessons', errors)
  }

  // Reject dangling lesson, environment and source references from exercise metadata.
  for (const [index, exercise] of exercises.entries()) {
    if (!exercise || typeof exercise !== 'object') continue
    if (!lessonIds.has(exercise.lesson_id)) {
      errors.push(
        `exercises[${index}].lesson_id: unknown lesson ID "${exercise.lesson_id}"`,
      )
    }
    if (!environmentIds.has(exercise.environment_id)) {
      errors.push(
        `exercises[${index}].environment_id: unknown environment ID "${exercise.environment_id}"`,
      )
    }
    const exerciseSources = Array.isArray(exercise.source_ids)
      ? exercise.source_ids
      : []
    for (const [sourceIndex, sourceId] of exerciseSources.entries()) {
      if (!sourceIds.has(sourceId)) {
        errors.push(
          `exercises[${index}].source_ids[${sourceIndex}]: unknown source ID "${sourceId}"`,
        )
      }
    }
  }

  validatePrivateAssessment(
    pack,
    options.privatePack,
    exercises,
    resourceIds,
    errors,
  )
  return { errors }
}

/** Validate a one-to-one legacy ID map against the prototype's current stable IDs. */
export function validateLegacyCourseMap(mapping, expectedIds) {
  const errors = []
  if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) {
    return {
      errors: ['legacy map: expected an object of old ID to stable ID entries'],
    }
  }
  const values = Object.values(mapping)
  if (values.some((value) => typeof value !== 'string')) {
    errors.push('legacy map: each stable ID must be a string')
    return { errors }
  }
  if (new Set(values).size !== values.length)
    errors.push('legacy map: stable ID targets must be unique')
  if (expectedIds) {
    const expected = new Set(expectedIds)
    for (const id of expected) {
      if (mapping[id] !== id)
        errors.push(
          `legacy map.${id}: missing identity mapping for existing course ID`,
        )
    }
    for (const id of Object.keys(mapping)) {
      if (!expected.has(id))
        errors.push(
          `legacy map.${id}: ID is not present in the prototype catalog`,
        )
    }
  }
  return { errors }
}

/** Print CLI usage and return the usage-error exit status. */
function printUsage() {
  console.error(
    'Usage: node scripts/course-content.mjs validate <course-pack.json> [--private <assessment-pack.json>] [--samples <sample-manifest.json>] [--dependency <course-pack.json> ...]',
  )
  return 2
}

/** Parse a JSON file and turn read or syntax errors into concise command diagnostics. */
async function readJsonFile(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`${filePath}: ${message}`)
  }
}

/** Run the course-pack validator when this module is called as a command. */
async function runCli(argumentsList) {
  const [command, coursePath, ...optionArguments] = argumentsList
  if (command !== 'validate' || !coursePath) return printUsage()
  const paths = new Map()
  const dependencyPaths = []
  for (let index = 0; index < optionArguments.length; ) {
    const flag = optionArguments[index]
    const value = optionArguments[index + 1]
    if (flag === '--dependency') {
      if (!value || value.startsWith('--')) return printUsage()
      dependencyPaths.push(value)
      index += 2
      continue
    }
    if (
      !['--private', '--samples'].includes(flag) ||
      !value ||
      value.startsWith('--') ||
      paths.has(flag)
    ) {
      return printUsage()
    }
    paths.set(flag, value)
    index += 2
  }

  try {
    const pack = await readJsonFile(resolve(process.cwd(), coursePath))
    const privatePath = paths.get('--private')
    const samplesPath = paths.get('--samples')
    const privatePack = privatePath
      ? await readJsonFile(resolve(process.cwd(), privatePath))
      : undefined
    const samples = samplesPath
      ? await readJsonFile(resolve(process.cwd(), samplesPath))
      : undefined
    const dependencies = await Promise.all(
      dependencyPaths.map((dependencyPath) =>
        readJsonFile(resolve(process.cwd(), dependencyPath)),
      ),
    )
    const { errors } = validateCoursePack(pack, {
      privatePack,
      samples,
      dependencies,
    })
    if (errors.length) {
      console.error(errors.map((error) => `- ${error}`).join('\n'))
      return 1
    }
    console.log(`Valid course pack: ${pack.course_id}@${pack.version}`)
    return 0
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return 1
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = await runCli(process.argv.slice(2))
}
