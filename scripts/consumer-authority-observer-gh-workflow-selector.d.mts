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
  readonly packageRecordShape?:
    | "record-encoding"
    | "record-path"
    | "primary-missing"
    | "primary-unsafe"
    | "ancillary-unsafe"
    | "executable-ambiguous"
    | "lstat-failed"
    | "canonical"
  readonly selectorStage: WorkflowObserverGhSelectorStage
  readonly state: "blocked" | "ready"
}

export interface WorkflowObserverGhToolOptions {
  readonly assessTool?: (path: string, options?: { readonly stateRoot: string }) => { readonly code?: string; readonly state: "blocked" | "ready" }
  readonly copyFile?: (source: string, destination: string, mode: number) => void
  readonly environment?: Record<string, string | undefined>
  readonly lstatPackageRecord?: (path: string) => WorkflowObserverGhPackageRecordStat
  readonly readPackageRecord?: () => readonly string[]
}

export interface PrivateObserverGhCopyResult {
  readonly code: string
  readonly path?: string
  readonly selectorStage: "source-assessment" | "private-reservation" | "private-copy" | "private-assessment"
  readonly state: "blocked" | "ready"
}

export interface PrivateObserverGhCopyOptions {
  readonly assessTool?: (path: string, options?: { readonly stateRoot: string }) => { readonly code?: string; readonly state: "blocked" | "ready" }
  readonly copyFile?: (source: string, destination: string, mode: number) => void
  readonly runnerTemp?: string
}

export interface WorkflowObserverGhPackageRecordStat {
  isFile(): boolean
  isSymbolicLink(): boolean
  mode: number
}

export function provisionWorkflowObserverGhTool(
  options?: WorkflowObserverGhToolOptions,
): WorkflowObserverGhToolResult
export function provisionPrivateObserverGhCopy(
  sourcePath: string,
  options?: PrivateObserverGhCopyOptions,
): PrivateObserverGhCopyResult

export class WorkflowObserverGhToolError extends Error {
  readonly code: string
}
