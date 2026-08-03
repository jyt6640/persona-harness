export interface WorkflowObserverGhToolResult {
  code: string
  state: "blocked" | "ready"
}

export interface WorkflowObserverGhToolOptions {
  environment?: Record<string, string | undefined>
  listPackageFiles?: () => string[]
}

export interface WorkflowObserverGhPackageRecordStat {
  isFile(): boolean
  isSymbolicLink(): boolean
  mode: number
}

export interface WorkflowObserverGhPackageRecordSelectorOptions {
  lstat?: (path: string) => WorkflowObserverGhPackageRecordStat
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
