export interface WorkflowObserverGhToolResult {
  code: string
  state: "blocked" | "ready"
}

export interface WorkflowObserverGhToolOptions {
  environment?: Record<string, string | undefined>
  listPackageFiles?: () => string[]
}

export function provisionWorkflowObserverGhTool(
  options?: WorkflowObserverGhToolOptions,
): WorkflowObserverGhToolResult

export class WorkflowObserverGhToolError extends Error {
  readonly code: string
}
