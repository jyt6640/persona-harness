import { mkdirSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"

import type { ControllerRepositoryObservation } from "./controller-repository-observer.js"

export const defaultPhase12ObserverReportPath = ".persona/evidence/phase1-2/observer-report.md"

export type FormatObserverReportInput = {
  readonly runId: string
  readonly filePath: string
  readonly observation: ControllerRepositoryObservation
  readonly nextRulePromptImprovementCandidate: boolean
}

export type WriteObserverReportInput = FormatObserverReportInput & {
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

function formatEvidence(values: readonly string[]): string {
  return values.length === 0 ? "none" : values.join("; ")
}
