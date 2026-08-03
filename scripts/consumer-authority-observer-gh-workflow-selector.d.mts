export const OBSERVER_GH_WORKFLOW_SELECTOR_STAGES: readonly [
  "environment",
  "package-list",
  "package-record",
  "source-assessment",
  "private-reservation",
  "private-copy",
  "private-assessment",
  "output-handoff",
]

export type WorkflowObserverGhSelectorStage = typeof OBSERVER_GH_WORKFLOW_SELECTOR_STAGES[number] | "selector-internal"

export interface WorkflowObserverGhToolResult {
  readonly code: string
  readonly selectorStage: WorkflowObserverGhSelectorStage
  readonly state: "blocked" | "ready"
}

export interface WorkflowObserverGhToolOptions {
  readonly copyFile?: (source: string, destination: string, mode: number) => void
  readonly environment?: Record<string, string | undefined>
  readonly listPackageFiles?: () => string[]
}

export interface WorkflowObserverGhPackageRecordStat {
  isFile(): boolean
  isSymbolicLink(): boolean
  mode: number
}

export interface WorkflowObserverGhPackageRecordSelectorOptions {
  readonly lstat?: (path: string) => WorkflowObserverGhPackageRecordStat
}

export function provisionWorkflowObserverGhTool(
  options?: WorkflowObserverGhToolOptions,
): WorkflowObserverGhToolResult

export function selectRegularPackageGhCandidate(
  paths: string[],
  options?: WorkflowObserverGhPackageRecordSelectorOptions,
): string | undefined

export class WorkflowObserverGhToolError extends Error {
  readonly code: string
}
