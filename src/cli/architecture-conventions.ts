import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

import {
  CONTROLLER_REPOSITORY_CONVENTION,
  SERVICE_STATE_OWNERSHIP_CONVENTION,
} from "../config/convention-registry.js"
import type { ConventionDefinition } from "../config/convention-registry.js"
import { loadHarnessConfig } from "../config/harness-config.js"
import type { ConventionLevel } from "../config/harness-config.js"
import { observeControllerRepositoryDependency } from "../observer/controller-repository-observer.js"
import type { ControllerRepositoryEvidence } from "../observer/controller-repository-observer.js"
import { runAstGrepConvention } from "./ast-grep-convention-runner.js"
import { readConventionDefinitions } from "./convention-definitions.js"
import { readProfileIntent } from "./stack-alignment-profile.js"

export type ArchitectureConventionFinding = "PASS" | "WARN"

export type ArchitectureConventionBlocker = {
  readonly conventionId: string
  readonly id: string
  readonly reason: string
  readonly source: string
}

export type ArchitectureConventionSummary = {
  readonly architectureConventions: string
  readonly architectureConventionBlockers: readonly ArchitectureConventionBlocker[]
  readonly architectureConventionsBlocking: boolean
  readonly architectureConventionsFinding: ArchitectureConventionFinding
}

const JAVA_MAIN_DIR = join("src", "main", "java")
const SERVICE_ARCHITECTURE_STYLES = [
  "simple-layered",
  "clean-architecture-light",
  "hexagonal-light",
  "strict-clean-architecture",
] as const

function serviceArchitectureApplies(projectDir: string): boolean {
  const intent = readProfileIntent(projectDir)
  return intent?.language === "java"
    && intent.framework === "spring"
    && SERVICE_ARCHITECTURE_STYLES.some((style) => style === intent.architectureStyle)
}

function collectControllerFiles(projectDir: string): readonly string[] {
  return collectJavaFiles(projectDir, "Controller.java")
}

function collectServiceFiles(projectDir: string): readonly string[] {
  return collectJavaFiles(projectDir, "Service.java")
}

function collectJavaFiles(projectDir: string, suffix: string): readonly string[] {
  const rootDir = join(projectDir, JAVA_MAIN_DIR)
  const files: string[] = []

  function visit(dirPath: string): void {
    if (!existsSync(dirPath)) {
      return
    }
    for (const entry of readdirSync(dirPath)) {
      const entryPath = join(dirPath, entry)
      const stat = statSync(entryPath)
      if (stat.isDirectory()) {
        visit(entryPath)
        continue
      }
      if (stat.isFile() && entryPath.endsWith(suffix)) {
        files.push(entryPath)
      }
    }
  }

  visit(rootDir)
  return files.sort()
}

function className(filePath: string): string {
  return (filePath.replace(/\\/g, "/").split("/").at(-1) ?? filePath).replace(/\.java$/, "")
}

function repositoryName(evidence: ControllerRepositoryEvidence): string | undefined {
  const evidenceTexts = [...evidence.constructorParameters, ...evidence.fields, ...evidence.imports]
  for (const text of evidenceTexts) {
    const match = /\b(?<repository>[A-Za-z_$][\w$]*Repository[\w$]*)\b/u.exec(text)
    if (match?.groups?.repository !== undefined) {
      return match.groups.repository
    }
  }
  return undefined
}

function directDependencyFinding(projectDir: string, filePath: string): string | undefined {
  const source = readFileSync(filePath, "utf8")
  const observation = observeControllerRepositoryDependency({ filePath, source })
  if (observation.finding !== "WARN") {
    return undefined
  }

  const dependency = repositoryName(observation.evidence)
  if (dependency === undefined) {
    return undefined
  }
  return `${className(filePath)} directly depends on ${dependency}; ${CONTROLLER_REPOSITORY_CONVENTION.actionableMessage} Source: ${relative(projectDir, filePath)}`
}

function configuredConventionLevel(projectDir: string, definition: ConventionDefinition): ConventionLevel {
  return loadHarnessConfig(projectDir).conventions[definition.id] ?? definition.defaultLevel
}

function effectiveConventionLevel(definition: ConventionDefinition, level: ConventionLevel): ConventionLevel {
  return level === "block" && (!definition.blockAllowed || !definition.highPrecision || definition.fixPath.trim() === "") ? "warn" : level
}

function controllerRepositoryConventionFindings(projectDir: string): readonly string[] {
  return collectControllerFiles(projectDir).flatMap((filePath) => {
    const finding = directDependencyFinding(projectDir, filePath)
    return finding === undefined ? [] : [finding]
  })
}

type ServiceStateField = {
  readonly fieldName: string
  readonly line: number
  readonly terms: readonly string[]
  readonly typeName: string
}

function stripJavaCommentsAndLiterals(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//gu, (match) => match.replace(/[^\n]/gu, " "))
    .replace(/\/\/[^\r\n]*/gu, "")
    .replace(/"""[\s\S]*?"""/gu, (match) => match.replace(/[^\n]/gu, " "))
    .replace(/"(?:\\.|[^"\\])*"/gu, "\"\"")
    .replace(/'(?:\\.|[^'\\])*'/gu, "''")
}

function rawJavaType(typeName: string): string {
  const withoutAnnotations = typeName.replace(/@\w+(?:\([^)]*\))?\s*/gu, "")
  const withoutGenerics = withoutAnnotations.replace(/<[\s\S]*>/gu, "")
  const parts = withoutGenerics.trim().split(/\s+/u)
  return parts.at(-1)?.replace(/\[\]$/u, "") ?? withoutGenerics.trim()
}

function lineNumberAt(source: string, index: number): number {
  return source.slice(0, Math.max(0, index)).split(/\r?\n/u).length
}

function serviceStateTerms(typeName: string, fieldName: string): readonly string[] {
  const terms: string[] = []
  const rawType = rawJavaType(typeName)
  if (rawType === "Map" || rawType === "AtomicLong") {
    terms.push(rawType)
  }
  if (/^(nextId|idCounter)$/u.test(fieldName)) {
    terms.push(fieldName)
  }
  return terms
}

function javaPrivateFields(source: string): readonly ServiceStateField[] {
  const codeOnly = stripJavaCommentsAndLiterals(source)
  const fields: ServiceStateField[] = []
  const fieldPattern = /\bprivate\s+(?:(?:static|final|volatile|transient)\s+)*(?<type>[A-Za-z_$][\w$]*(?:\s*<[^;{}=]+>)?(?:\[\])?)\s+(?<name>[A-Za-z_$][\w$]*)\b[^;{}]*;/gu
  for (const match of codeOnly.matchAll(fieldPattern)) {
    const typeName = match.groups?.type?.trim()
    const fieldName = match.groups?.name?.trim()
    if (typeName === undefined || fieldName === undefined || match.index === undefined) {
      continue
    }
    const terms = serviceStateTerms(typeName, fieldName)
    if (terms.length === 0) {
      continue
    }
    fields.push({
      fieldName,
      line: lineNumberAt(codeOnly, match.index),
      terms,
      typeName,
    })
  }
  return fields
}

function serviceStateOwnershipConventionFindings(projectDir: string): readonly string[] {
  return collectServiceFiles(projectDir).flatMap((filePath) => {
    const source = readFileSync(filePath, "utf8")
    const stateFields = javaPrivateFields(source)
    if (stateFields.length === 0) {
      return []
    }
    const evidence = stateFields
      .map((field) => `${field.typeName} ${field.fieldName} at ${relative(projectDir, filePath)}:${field.line}`)
      .join(", ")
    const terms = Array.from(new Set(stateFields.flatMap((field) => field.terms))).join("/")
    return [
      `${className(filePath)} owns in-memory state/id sequence (${terms}); ${SERVICE_STATE_OWNERSHIP_CONVENTION.actionableMessage} Source: ${evidence}`,
    ]
  })
}

type ConventionEvaluation = {
  readonly findings: readonly string[]
  readonly warnings: readonly string[]
}

function conventionFindings(projectDir: string, definition: ConventionDefinition): ConventionEvaluation {
  if (definition.check.kind === "observer" && definition.id === CONTROLLER_REPOSITORY_CONVENTION.id) {
    return { findings: controllerRepositoryConventionFindings(projectDir), warnings: [] }
  }
  if (definition.check.kind === "observer" && definition.id === SERVICE_STATE_OWNERSHIP_CONVENTION.id) {
    return { findings: serviceStateOwnershipConventionFindings(projectDir), warnings: [] }
  }
  if (definition.check.kind === "ast-grep") {
    const result = runAstGrepConvention(projectDir, definition)
    if (result.status === "skipped") {
      return { findings: [], warnings: [result.warning] }
    }
    if (result.status === "checked") {
      const findings = result.findings.map((finding) => {
        return `${definition.actionableMessage} Source: ${finding.path}:${finding.line}`
      })
      return { findings, warnings: [] }
    }
  }
  return { findings: [], warnings: [] }
}

export function readArchitectureConventions(projectDir: string, implementationStatus: string): ArchitectureConventionSummary {
  if (implementationStatus !== "filled") {
    return {
      architectureConventionBlockers: [],
      architectureConventions: "not checked until implementation report is filled",
      architectureConventionsBlocking: false,
      architectureConventionsFinding: "PASS",
    }
  }
  if (!serviceArchitectureApplies(projectDir)) {
    return {
      architectureConventionBlockers: [],
      architectureConventions: "not checked; Java/Spring service-layer profile not active",
      architectureConventionsBlocking: false,
      architectureConventionsFinding: "PASS",
    }
  }

  const summaries: string[] = []
  const blockers: ArchitectureConventionBlocker[] = []
  let hasWarnFinding = false
  for (const definition of readConventionDefinitions(projectDir)) {
    const result = conventionFindings(projectDir, definition)
    for (const warning of result.warnings) {
      summaries.push(warning)
      hasWarnFinding = true
    }
    if (result.findings.length === 0) {
      continue
    }
    const level = effectiveConventionLevel(definition, configuredConventionLevel(projectDir, definition))
    summaries.push(`${definition.id} ${level}: ${result.findings.join("; ")}`)
    if (level !== "report") {
      hasWarnFinding = true
    }
    if (level === "block") {
      blockers.push({
        conventionId: definition.id,
        id: definition.blockerId,
        reason: `${definition.id} ${level}: ${result.findings.join("; ")}`,
        source: "src/main/java",
      })
    }
  }

  if (summaries.length === 0) {
    return {
      architectureConventionBlockers: [],
      architectureConventions: "architecture convention violations not observed",
      architectureConventionsBlocking: false,
      architectureConventionsFinding: "PASS",
    }
  }
  return {
    architectureConventionBlockers: blockers,
    architectureConventions: summaries.join("; "),
    architectureConventionsBlocking: blockers.length > 0,
    architectureConventionsFinding: hasWarnFinding ? "WARN" : "PASS",
  }
}
