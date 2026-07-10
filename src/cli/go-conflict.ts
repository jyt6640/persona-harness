export class GoWorkflowConflictError extends Error {
  constructor() {
    super("workflow state changed while ph go was running")
    this.name = "GoWorkflowConflictError"
  }
}
