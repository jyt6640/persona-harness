import {
  malformedFrontmatter,
  validateRuleFrontmatter,
  type RuleFrontmatterDiagnostic,
} from "./rule-frontmatter-diagnostics.js"

export type Phase0Scenario = "step1" | "step2-3"

export type RuleScenario = Phase0Scenario | "all"

type SupportedFrontmatterField =
  | "id"
  | "source"
  | "domain"
  | "topic"
  | "globs"
  | "scenario"
  | "severity"
  | "max_bullets"
  | "enforcement"

export type RuleSeverity = "must" | "should" | "prefer"

export type RuleMetadata = {
  readonly id: string
  readonly source?: string
  readonly domain?: string
  readonly topic?: string
  readonly globs: readonly string[]
  readonly scenario: RuleScenario
  readonly severity?: RuleSeverity
  readonly maxBullets?: number
  readonly enforcement?: string
}

export type RuleFrontmatterParseResult = {
  readonly metadata: RuleMetadata
  readonly diagnostics: readonly RuleFrontmatterDiagnostic[]
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
  if (rawKey === "source") return "source"
  if (rawKey === "domain") return "domain"
  if (rawKey === "topic") return "topic"
  if (rawKey === "globs") return "globs"
  if (rawKey === "scenario") return "scenario"
  if (rawKey === "severity") return "severity"
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

function isRuleScenario(value: string | undefined): value is RuleScenario {
  return value === "step1" || value === "step2-3" || value === "all"
}

function parseScenario(value: string | undefined, fallback: RuleScenario): RuleScenario {
  if (isRuleScenario(value)) {
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

function parseSeverity(value: string | undefined): RuleSeverity | undefined {
  if (value === "must" || value === "should" || value === "prefer") {
    return value
  }
  return undefined
}

function addListValue(field: SupportedFrontmatterField, value: string, globs: string[]): void {
  if (field === "globs") {
    globs.push(value)
  }
}

export function fallbackRuleMetadata(rulePath: string): RuleMetadata {
  return { id: rulePath, globs: [], scenario: scenarioForRulePath(rulePath) }
}

export function parseRuleFrontmatter(rulePath: string, markdown: string): RuleFrontmatterParseResult {
  const lines = markdown.split("\n")
  let id: string | undefined
  let source: string | undefined
  let domain: string | undefined
  let topic: string | undefined
  const globs: string[] = []
  let scenarioValue: string | undefined
  let severityValue: string | undefined
  let severity: RuleSeverity | undefined
  let maxBullets: number | undefined
  let enforcement: string | undefined
  let listField: SupportedFrontmatterField | undefined
  const malformedMessages: string[] = []

  if (lines[0] !== "---") {
    return {
      metadata: fallbackRuleMetadata(rulePath),
      diagnostics: [malformedFrontmatter("Frontmatter block is missing an opening marker.")],
    }
  }

  if (!lines.slice(1).includes("---")) {
    malformedMessages.push("Frontmatter block is missing a closing marker.")
  }

  for (const line of lines.slice(1)) {
    if (line === "---") {
      break
    }

    const listMatch = line.match(/^\s*-\s+(.*)$/)
    if (listMatch?.[1] !== undefined && listField !== undefined) {
      addListValue(listField, cleanScalar(listMatch[1]), globs)
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
    if (field === "source" && value !== "") source = value
    if (field === "domain" && value !== "") domain = value
    if (field === "topic" && value !== "") topic = value
    if (field === "scenario" && value !== "") scenarioValue = value
    if (field === "severity" && value !== "") {
      severityValue = value
      severity = parseSeverity(value)
    }
    if (field === "max_bullets") maxBullets = parsePositiveInteger(value)
    if (field === "enforcement" && value !== "") enforcement = value
    if (field === "globs" && value !== "") {
      addListValue(field, value, globs)
    }
  }

  const diagnostics = validateRuleFrontmatter({
    id,
    source,
    domain,
    topic,
    globs,
    scenario: scenarioValue,
    severity: severityValue,
    enforcement,
    malformedMessages,
  })

  return {
    metadata: {
      id: id ?? rulePath,
      source,
      domain,
      topic,
      globs,
      scenario: parseScenario(scenarioValue, scenarioForRulePath(rulePath)),
      severity,
      maxBullets,
      enforcement,
    },
    diagnostics,
  }
}

export function parseRuleMetadata(rulePath: string, markdown: string): RuleMetadata {
  return parseRuleFrontmatter(rulePath, markdown).metadata
}
