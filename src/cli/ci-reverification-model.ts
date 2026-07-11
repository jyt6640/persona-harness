export type CiReverificationFinalStatus =
  | "artifact-invalid"
  | "failed"
  | "partial"
  | "passed"
  | "timeout"
  | "unavailable"

export type CiReverificationCommandOutcome = "failed" | "passed" | "timeout" | "unavailable"

export type CiReverificationStatusInput = {
  readonly artifactValid: boolean
  readonly ciDisallowedTrackedMutation: boolean
  readonly commands: readonly {
    readonly outcome: CiReverificationCommandOutcome
    readonly started: boolean
  }[]
  readonly identityPartial: boolean
  readonly preflightAvailable: boolean
}

export function determineCiReverificationFinalStatus(
  input: CiReverificationStatusInput,
): CiReverificationFinalStatus {
  const started = input.commands.filter((command) => command.started)
  if (!input.preflightAvailable && started.length === 0) {
    return "unavailable"
  }
  if (started.some((command) => command.outcome === "timeout")) {
    return "timeout"
  }
  if (!input.artifactValid) {
    return "artifact-invalid"
  }
  if (input.identityPartial || input.ciDisallowedTrackedMutation) {
    return "partial"
  }
  const firstNonPassed = input.commands.find((command) => command.outcome !== "passed")
  if (firstNonPassed !== undefined) {
    const priorSuccess = input.commands
      .slice(0, input.commands.indexOf(firstNonPassed))
      .some((command) => command.outcome === "passed")
    return priorSuccess ? "partial" : "failed"
  }
  return started.length > 0 && started.every((command) => command.outcome === "passed")
    ? "passed"
    : "unavailable"
}
