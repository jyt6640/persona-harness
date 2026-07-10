import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { CONVENTION_TOOLCHAIN_MISSING_BLOCKER_ID } from "../src/cli/architecture-conventions.js"
import {
  blockerStep,
  type ClosureBlocker,
  type ClosureNextPayload,
  type WorkflowClosureState,
} from "../src/cli/workflow-closure.js"
import {
  workflowClosureFinishReasons,
  workflowFinishFollowUp,
} from "../src/cli/workflow-closure-finish.js"
import { failedRunnerOutput } from "../src/cli/workflow-output.js"
import { runPersonaCli } from "../src/cli/index.js"

type FinishMatrixRow = {
  readonly action: string
  readonly blockerId: string
  readonly command: string
  readonly priority: 1
  readonly stepId: string
}

const CURRENT_TICKET = {
  id: "req-1",
  path: ".persona/workflow/work/req-1/00-task-card.md",
  reviewArchiveCandidate: false,
  state: "active-work" as const,
  technicalSignals: [],
  title: "Finish UX fixture",
}

const BASE_STATE: WorkflowClosureState = {
  archive: "pending",
  blockers: [],
  currentTicket: CURRENT_TICKET,
  evidence: "present",
  finish: "blocked",
  implementationReport: "filled",
  pendingTickets: ["req-1"],
  plan: "accepted",
  reportCoverage: "sufficient",
  reviewReport: "filled",
  tdd: { kind: "disabled", reason: "TDD is not enforced" },
  verification: "passed",
}

const tempProjects: string[] = []

const FINISH_BLOCKER_MATRIX: readonly FinishMatrixRow[] = [
  {
    action: "Run supported test/build/runtime verification and record the outcome.",
    blockerId: "verification-unknown",
    command: "npx ph workflow check",
    priority: 1,
    stepId: "verify-app",
  },
  {
    action: "Fix the compile/test failure and record the new verification outcome.",
    blockerId: "verification-failed",
    command: "npx ph workflow check",
    priority: 1,
    stepId: "fix-verification",
  },
  {
    action: "Fill the implementation report with verification evidence.",
    blockerId: "implementation-report-missing",
    command: "npx ph plan --report-filled implementation",
    priority: 1,
    stepId: "fill-implementation-report",
  },
  {
    action: "Fill the review report after review/manual QA.",
    blockerId: "review-report-missing",
    command: "npx ph plan --report-filled review",
    priority: 1,
    stepId: "fill-review-report",
  },
  {
    action: "Review the current ticket and archive it only after review confirms completion.",
    blockerId: "pending-ticket",
    command: "npx ph workflow archive req-1",
    priority: 1,
    stepId: "archive-current-ticket",
  },
  {
    action: "Fix the architecture convention violation.",
    blockerId: "architecture-controller-repository-direct-dependency",
    command: "npx ph workflow check",
    priority: 1,
    stepId: "fix-controller-repository-dependency",
  },
  {
    action: "Restore the required convention toolchain or lower that convention level.",
    blockerId: CONVENTION_TOOLCHAIN_MISSING_BLOCKER_ID,
    command: "npx ph workflow check",
    priority: 1,
    stepId: "install-convention-toolchain",
  },
  {
    action: "Align the generated project with the accepted profile.",
    blockerId: "stack-alignment-mismatch",
    command: "npx ph workflow check",
    priority: 1,
    stepId: "fix-stack-alignment",
  },
  {
    action: "Escalate the missing Persona Harness blocker mapping for maintainer review.",
    blockerId: "future-unregistered-blocker",
    command: "npx ph workflow closure next --json",
    priority: 1,
    stepId: "unmapped-blocker",
  },
]

function blocker(id: string): ClosureBlocker {
  return {
    id,
    reason: `${id} finish UX fixture`,
    source: ".persona/workflow/implementation-report.md",
  }
}

function payloadFor(blockerIds: readonly string[]): ClosureNextPayload {
  const blockers = blockerIds.map(blocker)
  const state: WorkflowClosureState = { ...BASE_STATE, blockers }
  const steps = blockers.map((candidate, index) => blockerStep(candidate, state, index === 0 ? "blocked" : "pending"))
  return {
    action: "next",
    nextStep: steps[0] ?? null,
    state,
    steps,
  }
}

function requiredFollowUp(payload: ClosureNextPayload) {
  const followUp = workflowFinishFollowUp(payload)
  if (followUp === null) {
    throw new TypeError("expected a prioritized finish follow-up")
  }
  return followUp
}

function createWorkflowProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-finish-next-action-test-"))
  tempProjects.push(projectDir)
  expect(runPersonaCli(["intake", "--default", "backend"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
  expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
  expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
  mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
  writeFileSync(
    join(projectDir, ".persona", "evidence", "phase0", "verification.json"),
    `${JSON.stringify({ toolOutput: "gradlew test" }, null, 2)}\n`,
  )
  return projectDir
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { force: true, recursive: true })
  }
  tempProjects.length = 0
})

describe("ph workflow finish next action matrix", () => {
  it.each(FINISH_BLOCKER_MATRIX)("uses one shared prioritized follow-up for $blockerId", (row) => {
    const payload = payloadFor([row.blockerId])
    const followUp = requiredFollowUp(payload)

    expect(payload.nextStep).toMatchObject({ blockerId: row.blockerId, id: row.stepId })
    expect(payload.nextStep?.status).toBe(row.priority === 1 ? "blocked" : "pending")
    expect(followUp).toEqual({
      action: row.action,
      blockerId: row.blockerId,
      command: row.command,
    })
  })

  it("keeps verification first and renders one action and command for simultaneous blockers", () => {
    const payload = payloadFor(["verification-failed", "review-report-missing", "pending-ticket"])
    const followUp = requiredFollowUp(payload)
    const reasons = workflowClosureFinishReasons(payload)
    const result = failedRunnerOutput("finish", "implement", reasons, {
      blockerIds: payload.state.blockers.map((blocker) => blocker.id),
      followUp,
    })

    expect(payload.state.blockers.map((blocker) => blocker.id)).toEqual([
      "verification-failed",
      "review-report-missing",
      "pending-ticket",
    ])
    expect(followUp.blockerId).toBe("verification-failed")
    expect(result.status).toBe(1)
    expect(result.stderr.match(/^Next action:/gmu)).toHaveLength(1)
    expect(result.stderr.match(/^Next command:/gmu)).toHaveLength(1)
    expect(result.stderr).toContain("Other blockers:")
    expect(result.stderr).toContain("- review-report-missing")
    expect(result.stderr).toContain("- pending-ticket")
    expect(result.stderr).not.toContain("npx ph plan --report-filled review")
    expect(result.stderr).not.toContain("npx ph workflow archive req-1")
  })

  it("keeps implementation report ahead of review report without losing structured fixes", () => {
    const payload = payloadFor(["implementation-report-missing", "review-report-missing"])
    const followUp = requiredFollowUp(payload)
    const reasons = workflowClosureFinishReasons(payload)
    const result = failedRunnerOutput("finish", "implement", reasons, {
      blockerIds: payload.state.blockers.map((blocker) => blocker.id),
      followUp,
    })

    expect(followUp).toEqual({
      action: "Fill the implementation report with verification evidence.",
      blockerId: "implementation-report-missing",
      command: "npx ph plan --report-filled implementation",
    })
    expect(reasons).toHaveLength(2)
    expect(reasons.map((reason) => reason.blockerId)).toEqual([
      "implementation-report-missing",
      "review-report-missing",
    ])
    expect(reasons[1]).toMatchObject({
      nextAction: "Fill the review report after review/manual QA.",
      step: {
        commandAfterContent: "npx ph plan --report-filled review",
        id: "fill-review-report",
      },
      type: "closure-blocker",
    })
    expect(result.stderr.match(/^Next action:/gmu)).toHaveLength(1)
    expect(result.stderr.match(/^Next command:/gmu)).toHaveLength(1)
    expect(result.stderr).not.toContain("npx ph plan --report-filled review")
  })

  it("renders one plaintext follow-up while closure JSON retains every blocker and step", () => {
    const projectDir = createWorkflowProject()
    const finish = runPersonaCli(["workflow", "finish", "implement"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })
    const closure = runPersonaCli(["workflow", "closure", "next", "--json"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })
    const payload = JSON.parse(closure.stdout) as ClosureNextPayload

    expect(finish.status).toBe(1)
    expect(finish.stderr).toContain("Blocker: verification-unknown")
    expect(finish.stderr.match(/^Next action:/gmu)).toHaveLength(1)
    expect(finish.stderr.match(/^Next command:/gmu)).toHaveLength(1)
    expect(finish.stderr).toContain("Other blockers:")
    expect(finish.stderr).not.toContain("npx ph plan --report-filled implementation")
    expect(closure.status).toBe(0)
    expect(payload.state.blockers.map((blocker) => blocker.id)).toEqual([
      "verification-unknown",
      "implementation-report-missing",
      "review-report-missing",
    ])
    expect(payload.steps.map((step) => step.blockerId)).toEqual([
      "verification-unknown",
      "implementation-report-missing",
      "review-report-missing",
    ])
  })
})
