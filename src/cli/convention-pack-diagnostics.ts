import { readFileSync } from "node:fs"
import { relative } from "node:path"

import { CONVENTION_REGISTRY } from "../config/convention-registry.js"
import { invalidGlobReason } from "../rules/rule-glob.js"
import {
  collectConventionFiles,
  readIndentedYamlScalar,
  readPersonaListMeta,
  readPersonaMeta,
  readYamlScalar,
} from "./convention-pack.js"

export type ConventionPackDiagnosticCode =
  | "duplicate_convention_id"
  | "invalid_glob"
  | "invalid_pattern"
  | "missing_required_field"
  | "unknown_role"

export type ConventionPackDiagnostic = {
  readonly code: ConventionPackDiagnosticCode
  readonly field?: string
  readonly message: string
  readonly path: string
}

export type ConventionPackDiagnosticsFinding = "PASS" | "WARN"

export type ConventionPackDiagnosticsSummary = {
  readonly conventionCount: number
  readonly diagnosticCount: number
  readonly diagnostics: readonly ConventionPackDiagnostic[]
  readonly finding: ConventionPackDiagnosticsFinding
}

const ROLE_VALUES = new Set(["test-writer", "implementer", "reviewer", "main"])

function diagnostic(
  path: string,
  code: ConventionPackDiagnosticCode,
  field: string | undefined,
  message: string,
): ConventionPackDiagnostic {
  if (field === undefined) {
    return { code, message, path }
  }
  return { code, field, message, path }
}

function missingRequiredField(path: string, field: string): ConventionPackDiagnostic {
  return diagnostic(path, "missing_required_field", field, `Required convention metadata field '${field}' is missing.`)
}

function duplicateConventionId(path: string, id: string, duplicatePath: string): ConventionPackDiagnostic {
  return diagnostic(path, "duplicate_convention_id", "id", `Duplicate convention id '${id}' also appears in ${duplicatePath}.`)
}

function invalidConventionGlob(path: string, field: string, glob: string, reason: string): ConventionPackDiagnostic {
  return diagnostic(path, "invalid_glob", field, `Invalid convention glob '${glob}': ${reason}.`)
}

function invalidConventionPattern(path: string, pattern: string, reason: string): ConventionPackDiagnostic {
  return diagnostic(path, "invalid_pattern", "rule.pattern", `Invalid convention pattern '${pattern}': ${reason}.`)
}

function unknownRole(path: string, role: string): ConventionPackDiagnostic {
  return diagnostic(path, "unknown_role", "roles", `Unknown convention role '${role}'.`)
}

function invalidPatternReason(pattern: string): string | undefined {
  if (pattern.trim() === "") {
    return "pattern must not be empty"
  }
  if (/[\r\n]/u.test(pattern)) {
    return "pattern must stay on one line"
  }
  return undefined
}

type ConventionDiagnosticEntry = {
  readonly builtInRuleId?: string
  readonly diagnostics: readonly ConventionPackDiagnostic[]
  readonly id?: string
  readonly path: string
}

function builtInConventionIdForRulePath(path: string): string | undefined {
  const definition = CONVENTION_REGISTRY.find((item) => item.check.kind === "ast-grep" && item.check.rule === path)
  return definition?.id
}

function readConventionEntry(projectDir: string, filePath: string): ConventionDiagnosticEntry {
  const path = relative(projectDir, filePath).replace(/\\/g, "/")
  const source = readFileSync(filePath, "utf8")
  const id = readYamlScalar(source, "id")
  const builtInRuleId = builtInConventionIdForRulePath(path)
  const diagnostics: ConventionPackDiagnostic[] = []

  if (id === undefined) {
    diagnostics.push(missingRequiredField(path, "id"))
  }
  if (readPersonaMeta(source, "fix-path") === undefined) {
    diagnostics.push(missingRequiredField(path, "persona-harness-fix-path"))
  }
  if (readPersonaMeta(source, "step-id") === undefined) {
    diagnostics.push(missingRequiredField(path, "persona-harness-step-id"))
  }

  for (const role of readPersonaListMeta(source, "roles")) {
    if (!ROLE_VALUES.has(role)) {
      diagnostics.push(unknownRole(path, role))
    }
  }

  const targetGlob = readPersonaMeta(source, "target-glob")
  if (targetGlob !== undefined) {
    const reason = invalidGlobReason(targetGlob)
    if (reason !== undefined) {
      diagnostics.push(invalidConventionGlob(path, "persona-harness-target-glob", targetGlob, reason))
    }
  }

  const pattern = readIndentedYamlScalar(source, "rule", "pattern")
  if (pattern !== undefined) {
    const reason = invalidPatternReason(pattern)
    if (reason !== undefined) {
      diagnostics.push(invalidConventionPattern(path, pattern, reason))
    }
  }

  if (builtInRuleId === undefined || builtInRuleId !== id) {
    return { diagnostics, id, path }
  }
  return { builtInRuleId, diagnostics, id, path }
}

function addDuplicateConventionDiagnostics(entries: readonly ConventionDiagnosticEntry[]): ConventionPackDiagnostic[] {
  const pathsById = new Map<string, string[]>()
  for (const definition of CONVENTION_REGISTRY) {
    pathsById.set(definition.id, [`built-in:${definition.id}`])
  }
  for (const entry of entries) {
    if (entry.id === undefined || entry.builtInRuleId === entry.id) {
      continue
    }
    const paths = pathsById.get(entry.id) ?? []
    paths.push(entry.path)
    pathsById.set(entry.id, paths)
  }

  return entries.flatMap((entry) => {
    const id = entry.id
    if (id === undefined || entry.builtInRuleId === id) {
      return []
    }
    const duplicatePaths = (pathsById.get(id) ?? []).filter((path) => path !== entry.path)
    return duplicatePaths.map((duplicatePath) => duplicateConventionId(entry.path, id, duplicatePath))
  })
}

export function summarizeConventionPackDiagnostics(projectDir: string): ConventionPackDiagnosticsSummary {
  const entries = collectConventionFiles(projectDir).map((filePath) => readConventionEntry(projectDir, filePath))
  const diagnostics = [
    ...entries.flatMap((entry) => entry.diagnostics),
    ...addDuplicateConventionDiagnostics(entries),
  ]
  return {
    conventionCount:
      CONVENTION_REGISTRY.length + entries.filter((entry) => entry.id !== undefined && entry.builtInRuleId !== entry.id).length,
    diagnosticCount: diagnostics.length,
    diagnostics,
    finding: diagnostics.length === 0 ? "PASS" : "WARN",
  }
}
