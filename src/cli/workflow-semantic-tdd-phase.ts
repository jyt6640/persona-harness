import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
  REVERIFICATION_COMMAND_CATALOG_ID,
  REVERIFICATION_COMMANDS,
  commandPlanSha256,
  profileSha256,
  sha256,
} from "./ci-reverification-catalog.js"
import { parseCiReverificationArtifact, type CiReverificationArtifact } from "./ci-reverification-artifact.js"
import { captureGitIdentity, captureWorkspaceIdentity } from "./ci-reverification-identity.js"
import {
  buildFreshArtifactBinding,
  type FreshArtifactBinding,
} from "./fresh-verification-lifecycle.js"
import { readSemanticJUnitEvidence, type SemanticJUnitTestcase } from "./workflow-semantic-tdd-junit.js"
import type {
  SemanticTddDiagnosticCode,
  SemanticTddPhase,
} from "./workflow-semantic-tdd-types.js"
import type { VerificationAttempt, VerificationReceipt } from "./workflow-verification-receipt-types.js"

const CI_ARTIFACT_DIR = ".persona/evidence/ci-reverification"

export type SemanticTddPhaseRead =
  | {
      readonly diagnosticCodes: readonly SemanticTddDiagnosticCode[]
      readonly ok: false
      readonly phase?: SemanticTddPhase
    }
  | {
      readonly diagnosticCodes: readonly []
      readonly ok: true
      readonly phase: {
        readonly binding: FreshArtifactBinding
        readonly public: SemanticTddPhase
        readonly testcase: SemanticJUnitTestcase
      }
    }

export function readSemanticTddPhase(
  projectDir: string,
  attempt: VerificationAttempt,
  receipt: VerificationReceipt | undefined,
  phase: "green" | "red",
  expectedTestcaseId?: string,
): SemanticTddPhaseRead {
  const artifactPath = join(projectDir, CI_ARTIFACT_DIR, `${attempt.attemptId}.json`)
  const source = readText(artifactPath)
  const artifact = source === undefined ? undefined : parseCiReverificationArtifact(source)
  if (artifact === undefined) return invalidPhase("semantic-artifact-invalid")
  if (artifact.commandCatalogId !== REVERIFICATION_COMMAND_CATALOG_ID
    || artifact.commandPlanSha256 !== commandPlanSha256()
    || artifact.profileSha256 !== profileSha256(projectDir)
    || !hasExpectedCommands(artifact, phase)) {
    return invalidPhase("semantic-artifact-invalid")
  }
  const binding = buildFreshArtifactBinding(artifact, artifactPath, () => Date.parse(attempt.startedAt))
  if (binding === undefined
    || !sameBinding(binding, attempt)
    || !matchesCurrentProjectBindings(projectDir, binding)) {
    return invalidPhase("semantic-binding-mismatch")
  }
  const command = artifact.commands.find((item) => item.fixedArgvId === "gradle-wrapper-test.1")
  if (command === undefined) return invalidPhase("semantic-artifact-invalid")
  const expectedStatus = phase === "red" ? "failed" : "passed"
  if (artifact.finalStatus !== expectedStatus
    || command.outcome !== expectedStatus
    || (phase === "red" ? command.exitCode === 0 : command.exitCode !== 0)) {
    return invalidPhase("semantic-artifact-invalid")
  }
  if (phase === "green" && (receipt === undefined || receipt.result.status !== "pass" || receipt.result.testCount === 0)) {
    return invalidPhase("semantic-green-required")
  }
  const junit = readSemanticJUnitEvidence(projectDir, command.junitRefs)
  if (!junit.ok) return invalidPhase("semantic-artifact-invalid")
  const testcase = phase === "red"
    ? selectFailure(junit.value.failureCases)
    : selectPass(junit.value.passingCases, expectedTestcaseId)
  if (testcase === undefined) {
    return invalidPhase(
      phase === "red"
        ? "semantic-junit-failure-missing"
        : expectedTestcaseId === undefined ? "semantic-junit-pass-missing" : "semantic-testcase-mismatch",
    )
  }
  if (phase === "green" && receipt !== undefined && receipt.result.testCount !== junit.value.testCount) {
    return invalidPhase("semantic-green-required")
  }
  const expectedProvenance = provenanceDigest(binding, attempt, phase === "red" ? "fail" : "pass", junit.value.testCount)
  if (attempt.provenanceDigest !== expectedProvenance
    || (receipt !== undefined && receipt.provenanceDigest !== expectedProvenance)) {
    return invalidPhase("semantic-binding-mismatch")
  }
  if (receipt !== undefined && !receipt.result.artifactDigests.includes(binding.artifactDigest)) {
    return invalidPhase("semantic-binding-mismatch")
  }
  return {
    diagnosticCodes: [],
    ok: true,
    phase: {
      binding,
      public: {
        artifactPath,
        attemptId: attempt.attemptId,
        finishId: attempt.finishId,
        sessionId: attempt.sessionId,
        sourceHead: attempt.sourceHead,
        testcaseId: testcase.identity,
      },
      testcase,
    },
  }
}

export function compareSemanticTddLineage(
  red: FreshArtifactBinding,
  green: FreshArtifactBinding,
  redPhase: SemanticTddPhase,
  greenPhase: SemanticTddPhase,
  redTestcase: SemanticJUnitTestcase,
  greenTestcase: SemanticJUnitTestcase,
): readonly SemanticTddDiagnosticCode[] {
  const codes: SemanticTddDiagnosticCode[] = []
  if (red.sourceHead !== green.sourceHead
    || red.dirtyWorktreeDigest !== green.dirtyWorktreeDigest
    || red.phVersion !== green.phVersion
    || red.command.catalogId !== green.command.catalogId
    || red.command.argvDigest !== green.command.argvDigest
    || JSON.stringify(red.workspaceIdentity) !== JSON.stringify(green.workspaceIdentity)
    || redPhase.finishId !== greenPhase.finishId
    || redPhase.sessionId !== greenPhase.sessionId) {
    codes.push("semantic-binding-mismatch")
  }
  if (redTestcase.identity !== greenTestcase.identity) codes.push("semantic-testcase-mismatch")
  return [...new Set(codes)]
}

export function semanticTddPublicPhase(phase: SemanticTddPhaseRead): SemanticTddPhase | undefined {
  return phase.ok ? phase.phase.public : phase.phase
}

function sameBinding(binding: FreshArtifactBinding, attempt: VerificationAttempt): boolean {
  return binding.attemptId === attempt.attemptId
    && binding.command.catalogId === attempt.command.catalogId
    && binding.command.argvDigest === attempt.command.argvDigest
    && binding.dirtyWorktreeDigest === attempt.dirtyWorktreeDigest
    && binding.phVersion === attempt.phVersion
    && binding.sourceHead === attempt.sourceHead
    && JSON.stringify(binding.workspaceIdentity) === JSON.stringify(attempt.workspaceIdentity)
}

function matchesCurrentProjectBindings(projectDir: string, binding: FreshArtifactBinding): boolean {
  const workspace = captureWorkspaceIdentity(projectDir)
  if (workspace.status !== "available") return false
  const git = captureGitIdentity(projectDir, workspace.value)
  if (!git.available || git.head === undefined || git.status === undefined) return false
  const currentWorkspace = {
    deviceIdentity: `${workspace.value.dev}:${workspace.value.ino}`,
    platform: platformName(process.platform),
    rootDigest: `sha256:${sha256(JSON.stringify({
      device: workspace.value.dev,
      inode: workspace.value.ino,
      realpath: workspace.value.realpath,
    }))}`,
  }
  return binding.sourceHead === git.head
    && binding.dirtyWorktreeDigest === `sha256:${git.status.digest}`
    && JSON.stringify(binding.workspaceIdentity) === JSON.stringify(currentWorkspace)
}

function provenanceDigest(
  binding: FreshArtifactBinding,
  attempt: VerificationAttempt,
  status: "fail" | "pass",
  testCount: number,
): string {
  const source = JSON.stringify({
    artifactDigest: binding.artifactDigest,
    attemptId: attempt.attemptId,
    finishId: attempt.finishId,
    sessionId: attempt.sessionId,
    status,
    testCount,
  })
  return `sha256:${createHash("sha256").update(source).digest("hex")}`
}

function selectFailure(cases: readonly SemanticJUnitTestcase[]): SemanticJUnitTestcase | undefined {
  return cases.length === 1 ? cases[0] : undefined
}

function selectPass(cases: readonly SemanticJUnitTestcase[], expectedTestcaseId?: string): SemanticJUnitTestcase | undefined {
  if (expectedTestcaseId !== undefined) return cases.find((testcase) => testcase.identity === expectedTestcaseId)
  return cases.length === 1 ? cases[0] : undefined
}

function invalidPhase(code: SemanticTddDiagnosticCode): SemanticTddPhaseRead {
  return { diagnosticCodes: [code], ok: false }
}

function readText(path: string): string | undefined {
  try {
    return readFileSync(path, "utf8")
  } catch {
    return undefined
  }
}

function hasExpectedCommands(artifact: CiReverificationArtifact, phase: "green" | "red"): boolean {
  const expected = phase === "red"
    ? [REVERIFICATION_COMMANDS[0]]
    : [...REVERIFICATION_COMMANDS]
  return artifact.commands.length === expected.length
    && artifact.commands.every((command, index) => {
      const expectedCommand = expected[index]
      const expectedOutcome = phase === "red" ? "failed" : "passed"
      return expectedCommand !== undefined
        && command.ordinal === index + 1
        && command.fixedArgvId === expectedCommand.fixedArgvId
        && command.outcome === expectedOutcome
        && (expectedOutcome === "failed" ? command.exitCode !== 0 : command.exitCode === 0)
    })
}

function platformName(platform: NodeJS.Platform): "darwin" | "linux" | "win32" | "unknown" {
  if (platform === "darwin" || platform === "linux" || platform === "win32") return platform
  return "unknown"
}
