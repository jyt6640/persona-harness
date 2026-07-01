import process from "node:process"

import type { CliRunResult } from "./bearshell.js"
import { readWorkflowClosurePayload } from "./workflow-closure.js"
import type { TddClosureFinding } from "./workflow-tdd.js"

export function runWorkflowTddStatus(options: { readonly projectDir?: string }): CliRunResult {
  const projectDir = options.projectDir ?? process.cwd()
  const closure = readWorkflowClosurePayload("status", projectDir)
  const tdd = closure.state.tdd
  return {
    status: 0,
    stdout: [
      "TDD Workflow Rail status",
      `State: ${tdd.kind}`,
      `Reason: ${tdd.reason}`,
      ...sourceLines(tdd),
      ...evidenceLines(tdd),
      `Next: ${nextAction(tdd)}`,
      "Boundary: read-only status; use `ph workflow test` to record red and `ph workflow check`/archive/finish to record green.",
    ].join("\n") + "\n",
    stderr: "",
  }
}

function sourceLines(tdd: TddClosureFinding): readonly string[] {
  return "source" in tdd ? [`Source: ${tdd.source}`] : []
}

function evidenceLines(tdd: TddClosureFinding): readonly string[] {
  return tdd.evidenceRef === undefined ? [] : [`Evidence: ${tdd.evidenceRef}`]
}

function nextAction(tdd: TddClosureFinding): string {
  switch (tdd.kind) {
    case "disabled":
      return "enable `enforce.tdd=true` only when the project wants the opt-in TDD finish gate"
    case "unavailable":
      return "enable strict `enforce.executeVerification=true`; PH will not fake red/green evidence"
    case "no-ticket":
      return "create or select a workflow ticket before recording TDD evidence"
    case "red-missing":
      return "write a behavior test, confirm it fails through PH with `ph workflow test`, then implement"
    case "red-without-green":
      return "make the recorded red test pass, then run `ph workflow check`, `ph workflow archive <ticket>`, or `ph workflow finish implement`"
    case "passed":
      return "continue normal closure/archive/finish flow"
    default:
      return assertNever(tdd)
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled TDD state: ${JSON.stringify(value)}`)
}
