import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
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
  readonly command?: {
    readonly phase: "after-action" | "now"
    readonly value: string
  }
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
    action: "Run the project's supported test/build/runtime verification and record the outcome in workflow evidence.",
    blockerId: "verification-unknown",
    command: { phase: "after-action", value: "npx ph workflow check" },
    priority: 1,
    stepId: "verify-app",
  },
  {
    action: "Fix the compile/test failure, rerun supported verification, and record the new outcome.",
    blockerId: "verification-failed",
    command: { phase: "after-action", value: "npx ph workflow check" },
    priority: 1,
    stepId: "fix-verification",
  },
  {
    action: "Complete the required substantive content in .persona/workflow/implementation-report.md, including verification evidence, before marking it filled.",
    blockerId: "implementation-report-missing",
    command: { phase: "after-action", value: "npx ph plan --report-filled implementation" },
    priority: 1,
    stepId: "fill-implementation-report",
  },
  {
    action: "Complete the required substantive content in .persona/workflow/review-report.md after review/manual QA before marking it filled.",
    blockerId: "review-report-missing",
    command: { phase: "after-action", value: "npx ph plan --report-filled review" },
    priority: 1,
    stepId: "fill-review-report",
  },
  {
    action: "Review the current ticket and confirm it is complete before archiving it.",
    blockerId: "pending-ticket",
    command: { phase: "after-action", value: "npx ph workflow archive req-1" },
    priority: 1,
    stepId: "archive-current-ticket",
  },
  {
    action: "Route the Controller through a Service layer instead of depending on Repository directly.",
    blockerId: "architecture-controller-repository-direct-dependency",
    command: { phase: "after-action", value: "npx ph workflow check" },
    priority: 1,
    stepId: "fix-controller-repository-dependency",
  },
  {
    action: "Install sg/ast-grep or lower the affected convention from block level.",
    blockerId: CONVENTION_TOOLCHAIN_MISSING_BLOCKER_ID,
    command: { phase: "after-action", value: "npx ph workflow check" },
    priority: 1,
    stepId: "install-convention-toolchain",
  },
  {
    action: "Re-read .persona/project-profile.jsonc and align the generated Spring Boot/Gradle/JPA/database stack.",
    blockerId: "stack-alignment-mismatch",
    command: { phase: "after-action", value: "npx ph workflow check" },
    priority: 1,
    stepId: "fix-stack-alignment",
  },
  {
    action: "Escalate the missing Persona Harness blocker mapping for maintainer review before retrying automation.",
    blockerId: "future-unregistered-blocker",
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

function writeVerificationSuccessEvidence(projectDir: string): void {
  writeFileSync(
    join(projectDir, ".persona", "evidence", "phase0", "verification.json"),
    `${JSON.stringify(
      {
        command: "npx ph bearshell --shell './gradlew test'",
        status: 0,
        tool: "bearshell",
        toolOutput: "BUILD SUCCESSFUL",
      },
      null,
      2,
    )}\n`,
  )
}

function writeFilledImplementationReport(projectDir: string): void {
  writeFileSync(
    join(projectDir, ".persona", "workflow", "implementation-report.md"),
    [
      "Status: template",
      "- README ranges read: all",
      "- Project profile ranges read: all",
      "- `npx ph bearshell --shell './gradlew test'`",
      "- BUILD SUCCESSFUL",
    ].join("\n"),
  )
}

function writeFilledReviewReport(projectDir: string): void {
  writeFileSync(
    join(projectDir, ".persona", "workflow", "review-report.md"),
    [
      "Status: template",
      "- Requirements reviewed against the accepted plan.",
      "- Boundary review completed.",
      "- `npx ph bearshell --shell './gradlew bootRun'`",
      "- Manual QA completed.",
    ].join("\n"),
  )
}

function closurePayload(projectDir: string): ClosureNextPayload {
  const closure = runPersonaCli(["workflow", "closure", "next", "--json"], {
    cwd: projectDir,
    env: {},
    invocationName: "ph",
  })
  expect(closure.status).toBe(0)
  return JSON.parse(closure.stdout) as ClosureNextPayload
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
    expect(result.stderr).toContain("Next command: after completing the action, run npx ph workflow check")
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
      action: "Complete the required substantive content in .persona/workflow/implementation-report.md, including verification evidence, before marking it filled.",
      blockerId: "implementation-report-missing",
      command: { phase: "after-action", value: "npx ph plan --report-filled implementation" },
    })
    expect(reasons).toHaveLength(2)
    expect(reasons.map((reason) => reason.blockerId)).toEqual([
      "implementation-report-missing",
      "review-report-missing",
    ])
    expect(reasons[1]).toMatchObject({
      nextAction: "Complete the required substantive content in .persona/workflow/review-report.md after review/manual QA before marking it filled.",
      step: {
        commandAfterContent: "npx ph plan --report-filled review",
        id: "fill-review-report",
      },
      type: "closure-blocker",
    })
    expect(result.stderr.match(/^Next action:/gmu)).toHaveLength(1)
    expect(result.stderr.match(/^Next command:/gmu)).toHaveLength(1)
    expect(result.stderr).toContain("Next command: after completing the action, run npx ph plan --report-filled implementation")
    expect(result.stderr).not.toContain("npx ph plan --report-filled review")
  })

  it("treats verification check as an after-action transition instead of an immediate fix", () => {
    const projectDir = createWorkflowProject()
    const beforeAction = runPersonaCli(["workflow", "finish", "implement"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })
    const prematureCheck = runPersonaCli(["workflow", "check"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })

    expect(beforeAction.stderr).toContain("Next action: Run the project's supported test/build/runtime verification")
    expect(beforeAction.stderr).toContain("Next command: after completing the action, run npx ph workflow check")
    expect(prematureCheck.status).toBe(0)
    expect(closurePayload(projectDir).nextStep).toMatchObject({ blockerId: "verification-unknown" })

    writeVerificationSuccessEvidence(projectDir)
    const afterActionCheck = runPersonaCli(["workflow", "check"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })

    expect(afterActionCheck.status).toBe(0)
    expect(closurePayload(projectDir).nextStep).toMatchObject({ blockerId: "implementation-report-missing" })
  })

  it("rejects an untouched implementation template without writes, then advances after substantive content", () => {
    const projectDir = createWorkflowProject()
    writeVerificationSuccessEvidence(projectDir)
    const beforeAction = runPersonaCli(["workflow", "finish", "implement"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })
    const prematureCheck = runPersonaCli(["workflow", "check"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })
    const implementationPath = join(projectDir, ".persona", "workflow", "implementation-report.md")
    const templateBytes = readFileSync(implementationPath, "utf8")
    const untouchedTemplate = runPersonaCli(["plan", "--report-filled", "implementation"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })

    expect(beforeAction.stderr).toContain("Next action: Complete the required substantive content in .persona/workflow/implementation-report.md")
    expect(beforeAction.stderr).toContain("Next command: after completing the action, run npx ph plan --report-filled implementation")
    expect(prematureCheck.status).toBe(0)
    expect(closurePayload(projectDir).nextStep).toMatchObject({ blockerId: "implementation-report-missing" })
    expect(untouchedTemplate.status).toBe(1)
    expect(untouchedTemplate.stderr).toContain("required substantive implementation report content")
    expect(readFileSync(implementationPath, "utf8")).toBe(templateBytes)
    expect(closurePayload(projectDir).nextStep).toMatchObject({ blockerId: "implementation-report-missing" })

    writeFilledImplementationReport(projectDir)
    const afterAction = runPersonaCli(["plan", "--report-filled", "implementation"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })

    expect(afterAction.status).toBe(0)
    expect(closurePayload(projectDir).nextStep).toMatchObject({ blockerId: "review-report-missing" })
  })

  it("rejects an untouched review template without writes, then resolves after substantive content", () => {
    const projectDir = createWorkflowProject()
    writeVerificationSuccessEvidence(projectDir)
    writeFilledImplementationReport(projectDir)
    expect(
      runPersonaCli(["plan", "--report-filled", "implementation"], {
        cwd: projectDir,
        env: {},
        invocationName: "ph",
      }).status,
    ).toBe(0)

    const beforeAction = runPersonaCli(["workflow", "finish", "implement"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })
    const prematureCheck = runPersonaCli(["workflow", "check"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })
    const reviewPath = join(projectDir, ".persona", "workflow", "review-report.md")
    const templateBytes = readFileSync(reviewPath, "utf8")
    const untouchedTemplate = runPersonaCli(["plan", "--report-filled", "review"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })

    expect(beforeAction.stderr).toContain("Next action: Complete the required substantive content in .persona/workflow/review-report.md")
    expect(beforeAction.stderr).toContain("Next command: after completing the action, run npx ph plan --report-filled review")
    expect(prematureCheck.status).toBe(0)
    expect(closurePayload(projectDir).nextStep).toMatchObject({ blockerId: "review-report-missing" })
    expect(untouchedTemplate.status).toBe(1)
    expect(untouchedTemplate.stderr).toContain("required substantive review report content")
    expect(readFileSync(reviewPath, "utf8")).toBe(templateBytes)
    expect(closurePayload(projectDir).nextStep).toMatchObject({ blockerId: "review-report-missing" })

    writeFilledReviewReport(projectDir)
    const afterAction = runPersonaCli(["plan", "--report-filled", "review"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })
    const finish = runPersonaCli(["workflow", "finish", "implement"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })

    expect(afterAction.status).toBe(0)
    expect(finish.status).toBe(0)
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
    expect(finish.stderr).toContain("Next command: after completing the action, run npx ph workflow check")
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
