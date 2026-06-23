export type RuleFrontmatterDiagnosticCode =
  | "missing_required_field"
  | "invalid_enum_value"
  | "malformed_frontmatter"

export type RuleFrontmatterDiagnostic = {
  readonly code: RuleFrontmatterDiagnosticCode
  readonly field?: string
  readonly message: string
}

export type RuleFrontmatterValidationInput = {
  readonly id?: string
  readonly source?: string
  readonly domain?: string
  readonly topic?: string
  readonly globs: readonly string[]
  readonly scenario?: string
  readonly severity?: string
  readonly enforcement?: string
  readonly malformedMessages: readonly string[]
}

const SOURCE_VALUES = ["clean-code", "backend-policy"]
const DOMAIN_VALUES = ["common", "backend"]
const SCENARIO_VALUES = ["step1", "step2-3", "all"]
const SEVERITY_VALUES = ["must", "should", "prefer"]
const ENFORCEMENT_VALUES = ["inject_only"]

export function malformedFrontmatter(message: string): RuleFrontmatterDiagnostic {
  return {
    code: "malformed_frontmatter",
    message,
  }
}

function missingRequiredField(field: string): RuleFrontmatterDiagnostic {
  return {
    code: "missing_required_field",
    field,
    message: `Required frontmatter field '${field}' is missing.`,
  }
}

function invalidEnumValue(field: string, value: string): RuleFrontmatterDiagnostic {
  return {
    code: "invalid_enum_value",
    field,
    message: `Unsupported frontmatter value for '${field}': ${value}.`,
  }
}

function hasValue(value: string | undefined): value is string {
  return value !== undefined && value !== ""
}

function isKnownValue(value: string | undefined, values: readonly string[]): boolean {
  return value !== undefined && values.includes(value)
}

export function validateRuleFrontmatter(
  input: RuleFrontmatterValidationInput,
): readonly RuleFrontmatterDiagnostic[] {
  const diagnostics = input.malformedMessages.map(malformedFrontmatter)

  if (!hasValue(input.id)) diagnostics.push(missingRequiredField("id"))
  if (!hasValue(input.source)) diagnostics.push(missingRequiredField("source"))
  if (!hasValue(input.domain)) diagnostics.push(missingRequiredField("domain"))
  if (!hasValue(input.topic)) diagnostics.push(missingRequiredField("topic"))
  if (input.globs.length === 0) diagnostics.push(missingRequiredField("globs"))
  if (!hasValue(input.severity)) diagnostics.push(missingRequiredField("severity"))
  if (!hasValue(input.enforcement)) diagnostics.push(missingRequiredField("enforcement"))

  if (hasValue(input.source) && !isKnownValue(input.source, SOURCE_VALUES)) {
    diagnostics.push(invalidEnumValue("source", input.source))
  }
  if (hasValue(input.domain) && !isKnownValue(input.domain, DOMAIN_VALUES)) {
    diagnostics.push(invalidEnumValue("domain", input.domain))
  }
  if (hasValue(input.scenario) && !isKnownValue(input.scenario, SCENARIO_VALUES)) {
    diagnostics.push(invalidEnumValue("scenario", input.scenario))
  }
  if (hasValue(input.severity) && !isKnownValue(input.severity, SEVERITY_VALUES)) {
    diagnostics.push(invalidEnumValue("severity", input.severity))
  }
  if (hasValue(input.enforcement) && !isKnownValue(input.enforcement, ENFORCEMENT_VALUES)) {
    diagnostics.push(invalidEnumValue("enforcement", input.enforcement))
  }

  return diagnostics
}
