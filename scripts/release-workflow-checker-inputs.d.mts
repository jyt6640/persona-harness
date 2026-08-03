export type ReleaseWorkflowCheckerInput = Readonly<{
  name: string
  path: string
}>

export const RELEASE_WORKFLOW_CHECKER_INPUTS: readonly ReleaseWorkflowCheckerInput[]
export const RELEASE_WORKFLOW_CHECKER_RUNTIME_FILES: readonly string[]

export function releaseWorkflowCheckerWorkflowPaths(): readonly string[]
export function releaseWorkflowCheckerInputName(path: string): string
export function releaseWorkflowCheckerFixturePaths(): readonly string[]
