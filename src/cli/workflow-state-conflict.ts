import { relative } from "node:path"

import { AtomicWriteConflictError } from "../io/atomic-file.js"

export type WorkflowStateWriteOptions = {
  readonly onBeforeWorkflowStateWrite?: (path: string) => void
}

export class WorkflowStateConflictError extends Error {
  constructor(readonly relativePath: string) {
    super(
      [
        `Workflow state changed while Persona Harness was updating ${relativePath}.`,
        "Refusing to overwrite concurrent changes.",
        "Rerun the command after reviewing the current workflow state.",
      ].join(" "),
    )
    this.name = "WorkflowStateConflictError"
  }
}

export function toWorkflowStateConflict(error: AtomicWriteConflictError, projectDir: string): WorkflowStateConflictError {
  return new WorkflowStateConflictError(relative(projectDir, error.targetPath))
}

export function beforeWorkflowStateWrite(options: WorkflowStateWriteOptions | undefined, path: string): void {
  options?.onBeforeWorkflowStateWrite?.(path)
}
