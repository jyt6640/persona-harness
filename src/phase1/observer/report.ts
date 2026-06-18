import { mkdirSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"

import type { ControllerRepositoryObservation } from "./controller-repository-observer.js"
import type { ControllerSqlObservation } from "./controller-sql-observer.js"
import type { ServiceStorageObservation } from "./service-storage-observer.js"

export const defaultPhase12ObserverReportPath = ".persona/evidence/phase1-2/observer-report.md"
export const defaultControllerSqlObserverReportPath = ".persona/evidence/phase-next/controller-sql-observer-report.md"
export const defaultServiceStorageObserverReportPath = ".persona/evidence/phase-next/service-storage-observer-report.md"

export type FormatObserverReportInput = {
  readonly runId: string
  readonly filePath: string
  readonly observation: ControllerRepositoryObservation
  readonly nextRulePromptImprovementCandidate: boolean
}

export type WriteObserverReportInput = FormatObserverReportInput & {
  readonly outputPath: string
}

export type FormatControllerSqlObserverReportInput = {
  readonly runId: string
  readonly filePath: string
  readonly observation: ControllerSqlObservation
  readonly nextRulePromptImprovementCandidate: boolean
}

export type WriteControllerSqlObserverReportInput = FormatControllerSqlObserverReportInput & {
  readonly outputPath: string
}

export type FormatServiceStorageObserverReportInput = {
  readonly runId: string
  readonly filePath: string
  readonly observation: ServiceStorageObservation
  readonly nextGeneratedRunCandidate: boolean
}

export type WriteServiceStorageObserverReportInput = FormatServiceStorageObserverReportInput & {
  readonly outputPath: string
}

export function formatObserverReport(input: FormatObserverReportInput): string {
  return `# Phase 1.2 Observer Report

## Target

- run: ${input.runId}
- file: ${input.filePath}

## Finding

${input.observation.finding}

## Evidence

- import: ${formatEvidence(input.observation.evidence.imports)}
- field: ${formatEvidence(input.observation.evidence.fields)}
- constructor parameter: ${formatEvidence(input.observation.evidence.constructorParameters)}
- method call: ${formatEvidence(input.observation.evidence.methodCalls)}

## Limitations

${input.observation.limitations.map((limitation) => `- ${limitation}`).join("\n")}

## Decision

- quality gate: no
- build/test failure: no
- next rule/prompt improvement candidate: ${input.nextRulePromptImprovementCandidate ? "yes" : "no"}
`
}

export function writeObserverReport(input: WriteObserverReportInput): void {
  mkdirSync(dirname(input.outputPath), { recursive: true })
  writeFileSync(input.outputPath, formatObserverReport(input))
}

export function formatControllerSqlObserverReport(input: FormatControllerSqlObserverReportInput): string {
  return `# Controller SQL Access Observer Report

## Target

- run: ${input.runId}
- file: ${input.filePath}

## Finding

${input.observation.finding}

## Confidence

${input.observation.confidence ?? "none"}

## Evidence

- import: ${formatEvidence(input.observation.evidence.imports)}
- field: ${formatEvidence(input.observation.evidence.fields)}
- constructor parameter: ${formatEvidence(input.observation.evidence.constructorParameters)}
- method call: ${formatEvidence(input.observation.evidence.methodCalls)}
- sql literal: ${formatEvidence(input.observation.evidence.sqlLiterals)}

## Limitations

${input.observation.limitations.map((limitation) => `- ${limitation}`).join("\n")}

## Decision

- quality gate: no
- build/test failure: no
- next rule/prompt improvement candidate: ${input.nextRulePromptImprovementCandidate ? "yes" : "no"}
`
}

export function writeControllerSqlObserverReport(input: WriteControllerSqlObserverReportInput): void {
  mkdirSync(dirname(input.outputPath), { recursive: true })
  writeFileSync(input.outputPath, formatControllerSqlObserverReport(input))
}

export function formatServiceStorageObserverReport(input: FormatServiceStorageObserverReportInput): string {
  return `# Service Storage Ownership Observer Report

## Target

- run: ${input.runId}
- file: ${input.filePath}

## Finding

${input.observation.finding}

## Confidence

${input.observation.confidence ?? "none"}

## Evidence

- storage field: ${formatEvidence(input.observation.evidence.storageFields)}
- sequence field: ${formatEvidence(input.observation.evidence.sequenceFields)}
- constructor parameter: ${formatEvidence(input.observation.evidence.constructorParameters)}
- mutation call: ${formatEvidence(input.observation.evidence.mutationCalls)}
- literal-only: ${formatEvidence(input.observation.evidence.literalOnly)}

## Limitations

${input.observation.limitations.map((limitation) => `- ${limitation}`).join("\n")}

## Decision

- quality gate: no
- build/test failure: no
- next generated run candidate: ${input.nextGeneratedRunCandidate ? "yes" : "no"}
`
}

export function writeServiceStorageObserverReport(input: WriteServiceStorageObserverReportInput): void {
  mkdirSync(dirname(input.outputPath), { recursive: true })
  writeFileSync(input.outputPath, formatServiceStorageObserverReport(input))
}

function formatEvidence(values: readonly string[]): string {
  return values.length === 0 ? "none" : values.join("; ")
}
