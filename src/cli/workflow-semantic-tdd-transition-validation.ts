import { createHash } from "node:crypto"
import { join } from "node:path"

import { readBoundedTextFile } from "../io/bounded-path-walker.js"
import {
  commandPlanSha256,
  profileSha256,
  REVERIFICATION_COMMAND_CATALOG_ID,
} from "./ci-reverification-catalog.js"
import { parseCiReverificationArtifact } from "./ci-reverification-artifact.js"
import {
  buildFreshArtifactBinding,
  type FreshArtifactBinding,
} from "./fresh-verification-lifecycle.js"
import { sameSourceIdentity } from "./source-identity.js"
import { readSemanticJUnitEvidence, type SemanticJUnitTestcase } from "./workflow-semantic-tdd-junit.js"
import type {
  SemanticTddTransitionDiagnosticCode,
  SemanticTddTransitionPhase,
} from "./workflow-semantic-tdd-transition-types.js"
import type {
  VerificationAttempt,
  VerificationReceipt,
} from "./workflow-verification-receipt-types.js"

export type TransitionPhaseRead =
  | { readonly codes: readonly SemanticTddTransitionDiagnosticCode[]; readonly ok: false }
  | { readonly ok: true; readonly phase: SemanticTddTransitionPhase }

export function readTransitionPhase(
  projectDir: string,
  evidenceRoot: string,
  attempt: VerificationAttempt,
  receipt: VerificationReceipt | undefined,
  phase: "green" | "red",
  expectedTestcaseId?: string,
): TransitionPhaseRead {
  const artifactPath = join(evidenceRoot, "ci-reverification", `${attempt.attemptId}.json`)
  const source = readBoundedTextFile(artifactPath, projectDir, "semantic transition artifact")
  if (!source.ok) return { codes: ["semantic-transition-artifact-invalid"], ok: false }
  const artifact = parseCiReverificationArtifact(source.text)
  if (
    artifact === undefined
    || artifact.commandCatalogId !== REVERIFICATION_COMMAND_CATALOG_ID
    || artifact.commandPlanSha256 !== commandPlanSha256()
    || artifact.profileSha256 !== profileSha256(projectDir)
    || artifact.finalStatus !== (phase === "red" ? "failed" : "passed")
    || artifact.commands.length !== (phase === "red" ? 1 : 2)
  ) return { codes: ["semantic-transition-artifact-invalid"], ok: false }
  const binding = buildFreshArtifactBinding(artifact, artifactPath, Date.now)
  const command = artifact.commands.find((entry) => entry.fixedArgvId === "gradle-wrapper-test.1")
  if (binding === undefined || command === undefined || !sameAttemptBinding(binding, attempt)) {
    return { codes: ["semantic-transition-binding-mismatch"], ok: false }
  }
  const expectedOutcome = phase === "red" ? "failed" : "passed"
  if (command.outcome !== expectedOutcome || (phase === "red" ? command.exitCode === 0 : command.exitCode !== 0)) {
    return { codes: ["semantic-transition-artifact-invalid"], ok: false }
  }
  if (phase === "green" && (receipt === undefined || receipt.result.status !== "pass" || receipt.result.testCount === 0)) {
    return { codes: ["semantic-transition-green-required"], ok: false }
  }
  const junit = readSemanticJUnitEvidence(projectDir, command.junitRefs)
  if (!junit.ok) return { codes: ["semantic-transition-artifact-invalid"], ok: false }
  const testcase = phase === "red"
    ? junit.value.failureCases.length === 1 ? junit.value.failureCases[0] : undefined
    : selectPassingCase(junit.value.passingCases, expectedTestcaseId)
  if (testcase === undefined) {
    return {
      codes: [phase === "red" ? "semantic-transition-red-required" : "semantic-transition-testcase-mismatch"],
      ok: false,
    }
  }
  if (phase === "green" && receipt !== undefined && receipt.result.testCount !== junit.value.testCount) {
    return { codes: ["semantic-transition-green-required"], ok: false }
  }
  const junitArtifactDigests = digestJUnit(projectDir, command.junitRefs)
  if (junitArtifactDigests === undefined) return { codes: ["semantic-transition-artifact-invalid"], ok: false }
  const expectedProvenance = provenanceDigest(binding, attempt, phase === "red" ? "fail" : "pass", junit.value.testCount)
  if (
    attempt.provenanceDigest !== expectedProvenance
    || (receipt !== undefined && receipt.provenanceDigest !== expectedProvenance)
  ) return { codes: ["semantic-transition-binding-mismatch"], ok: false }
  return {
    ok: true,
    phase: {
      artifactDigest: binding.artifactDigest,
      attemptId: attempt.attemptId,
      command: binding.command,
      completedAt: attempt.completedAt,
      dirtyWorktreeDigest: binding.dirtyWorktreeDigest,
      finishId: attempt.finishId,
      junitArtifactDigests,
      phVersion: attempt.phVersion,
      provenanceDigest: expectedProvenance,
      receiptId: phase === "green" ? receipt?.receiptId ?? null : null,
      sessionId: attempt.sessionId,
      sourceHead: attempt.sourceHead,
      sourceIdentity: attempt.sourceIdentity,
      startedAt: attempt.startedAt,
      testcaseId: testcase.identity,
      workspaceIdentity: attempt.workspaceIdentity,
    },
  }
}

export function compareTransitionBindings(
  red: SemanticTddTransitionPhase,
  green: SemanticTddTransitionPhase,
): readonly SemanticTddTransitionDiagnosticCode[] {
  const codes: SemanticTddTransitionDiagnosticCode[] = []
  if (
    red.finishId !== green.finishId
    || red.sessionId !== green.sessionId
    || red.phVersion !== green.phVersion
    || red.command.catalogId !== green.command.catalogId
    || red.command.argvDigest !== green.command.argvDigest
    || red.sourceHead !== green.sourceHead
    || JSON.stringify(red.workspaceIdentity) !== JSON.stringify(green.workspaceIdentity)
  ) codes.push("semantic-transition-binding-mismatch")
  if (red.testcaseId !== green.testcaseId) codes.push("semantic-transition-testcase-mismatch")
  if (Date.parse(red.startedAt) >= Date.parse(green.startedAt)) codes.push("semantic-transition-time-invalid")
  return [...new Set(codes)]
}

function sameAttemptBinding(binding: FreshArtifactBinding, attempt: VerificationAttempt): boolean {
  return binding.attemptId === attempt.attemptId
    && binding.command.catalogId === attempt.command.catalogId
    && binding.command.argvDigest === attempt.command.argvDigest
    && binding.dirtyWorktreeDigest === attempt.dirtyWorktreeDigest
    && binding.phVersion === attempt.phVersion
    && binding.sourceHead === attempt.sourceHead
    && sameSourceIdentity(binding.sourceIdentity, attempt.sourceIdentity)
    && JSON.stringify(binding.workspaceIdentity) === JSON.stringify(attempt.workspaceIdentity)
}

function selectPassingCase(
  cases: readonly SemanticJUnitTestcase[],
  expectedTestcaseId: string | undefined,
): SemanticJUnitTestcase | undefined {
  return expectedTestcaseId === undefined
    ? cases.length === 1 ? cases[0] : undefined
    : cases.find((testcase) => testcase.identity === expectedTestcaseId)
}

function digestJUnit(projectDir: string, refs: readonly string[]): readonly string[] | undefined {
  const digests: string[] = []
  for (const ref of [...new Set(refs)].sort()) {
    const read = readBoundedTextFile(join(projectDir, ref), projectDir, "semantic JUnit artifact")
    if (!read.ok) return undefined
    digests.push(digest(read.text))
  }
  return digests.length === 0 ? undefined : digests
}

function provenanceDigest(
  binding: FreshArtifactBinding,
  attempt: VerificationAttempt,
  status: "fail" | "pass",
  testCount: number,
): string {
  return digest({
    artifactDigest: binding.artifactDigest,
    attemptId: attempt.attemptId,
    finishId: attempt.finishId,
    sessionId: attempt.sessionId,
    status,
    sourceIdentity: binding.sourceIdentity,
    testCount,
  })
}

function digest(value: unknown): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`
}
