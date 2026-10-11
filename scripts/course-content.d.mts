export interface ValidationResult {
  errors: string[]
}

export interface CoursePackValidationOptions {
  privatePack?: unknown
  samples?: unknown
}

/** Validate an untrusted JSON value as a versioned course pack. */
export function validateCoursePack(
  pack: unknown,
  options?: CoursePackValidationOptions,
): ValidationResult

/** Check that legacy IDs have a one-to-one identity mapping to current catalog IDs. */
export function validateLegacyCourseMap(
  mapping: unknown,
  expectedIds?: readonly string[],
): ValidationResult
