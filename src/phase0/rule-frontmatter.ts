export type Phase0Scenario = "step1" | "step2-3"

export type RuleScenario = Phase0Scenario | "all"

type SupportedFrontmatterField =
  | "id"
  | "description"
  | "applies_to"
  | "globs"
  | "scenario"
  | "priority"
  | "max_bullets"
  | "enforcement"

export type RuleMetadata = {
  readonly id: string
  readonly description?: string
  readonly appliesTo: readonly string[]
  readonly globs: readonly string[]
  readonly scenario: RuleScenario
  readonly priority: number
  readonly maxBullets?: number
  readonly enforcement?: string
}

const STEP1_API_CONTRACT_RULE = "backend/step1-api-contract.md"
const STEP2_3_API_CONTRACT_RULE = "backend/step2-3-api-contract.md"

export function extractBulletPolicies(markdown: string): string[] {
  const body = markdown.startsWith("---") ? markdown.split("---").slice(2).join("---") : markdown

  return body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).replace(/`/g, ""))
}

function scenarioForRulePath(rulePath: string): RuleScenario {
  if (rulePath === STEP1_API_CONTRACT_RULE) {
    return "step1"
  }
  if (rulePath === STEP2_3_API_CONTRACT_RULE) {
    return "step2-3"
  }
  return "all"
}

function parseSupportedField(rawKey: string): SupportedFrontmatterField | undefined {
  if (rawKey === "id") return "id"
  if (rawKey === "description") return "description"
  if (rawKey === "applies_to") return "applies_to"
  if (rawKey === "globs") return "globs"
  if (rawKey === "scenario") return "scenario"
  if (rawKey === "priority") return "priority"
  if (rawKey === "max_bullets") return "max_bullets"
  if (rawKey === "enforcement") return "enforcement"
  return undefined
}

function cleanScalar(value: string): string {
  const trimmed = value.trim()
  const first = trimmed.at(0)
  const last = trimmed.at(-1)
  if (trimmed.length >= 2 && ((first === '"' && last === '"') || (first === "'" && last === "'"))) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function parseScenario(value: string | undefined, fallback: RuleScenario): RuleScenario {
  if (value === "step1" || value === "step2-3" || value === "all") {
    return value
  }
  return fallback
}

function parsePositiveInteger(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined
  }
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

function addListValue(field: SupportedFrontmatterField, value: string, globs: string[], appliesTo: string[]): void {
  if (field === "globs") {
    globs.push(value)
  }
  if (field === "applies_to") {
    appliesTo.push(value)
  }
}

export function parseRuleMetadata(rulePath: string, markdown: string): RuleMetadata {
  const lines = markdown.split("\n")
  let id = rulePath
  let description: string | undefined
  const globs: string[] = []
  const appliesTo: string[] = []
  let scenarioValue: string | undefined
  let priority = 100
  let maxBullets: number | undefined
  let enforcement: string | undefined
  let listField: SupportedFrontmatterField | undefined

  if (lines[0] !== "---") {
    return { id, appliesTo, globs, scenario: scenarioForRulePath(rulePath), priority }
  }

  for (const line of lines.slice(1)) {
    if (line === "---") {
      break
    }

    const listMatch = line.match(/^\s*-\s+(.*)$/)
    if (listMatch?.[1] !== undefined && listField !== undefined) {
      addListValue(listField, cleanScalar(listMatch[1]), globs, appliesTo)
      continue
    }

    const fieldMatch = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/)
    if (fieldMatch?.[1] === undefined || fieldMatch[2] === undefined) {
      listField = undefined
      continue
    }

    const field = parseSupportedField(fieldMatch[1])
    const value = cleanScalar(fieldMatch[2])
    listField = value === "" ? field : undefined

    if (field === "id" && value !== "") id = value
    if (field === "description" && value !== "") description = value
    if (field === "scenario" && value !== "") scenarioValue = value
    if (field === "priority") priority = parsePositiveInteger(value) ?? priority
    if (field === "max_bullets") maxBullets = parsePositiveInteger(value)
    if (field === "enforcement" && value !== "") enforcement = value
    if ((field === "globs" || field === "applies_to") && value !== "") {
      addListValue(field, value, globs, appliesTo)
    }
  }

  return {
    id,
    description,
    appliesTo,
    globs,
    scenario: parseScenario(scenarioValue, scenarioForRulePath(rulePath)),
    priority,
    maxBullets,
    enforcement,
  }
}
