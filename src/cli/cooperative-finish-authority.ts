import type { ProjectReadBoundary } from "../io/bootstrap-write-boundary.js"
import { nativeProjectReadPlatformSupported } from "../io/native-project-read.js"
import {
  cooperativeWorkspaceKey,
  prepareCooperativeFinishContext,
  type CooperativeFinishContext,
} from "./cooperative-finish-context.js"
import {
  runCooperativeGradleVerification,
  runCooperativeGradleVerificationWithinBoundary,
} from "./cooperative-gradle-verification.js"

export type CooperativeCurrentProcessVerificationDecision = {
  readonly assurance: "cooperative"
  readonly authorityProvider: "cooperative-current-process"
  readonly commandCatalogId: string
  readonly commandPlanDigest: string
  readonly completionEligible: true
  readonly consumptionState: "unconsumed"
  readonly decisionId: string
  readonly kind: "cooperative-current-process"
  readonly sourceSnapshotDigest: string
  readonly status: "trusted"
  readonly testCount: number
  readonly verifiedAt: string
}

export type CooperativeFinishAuthorityResult =
  | { readonly code: string; readonly kind: "blocked" }
  | { readonly kind: "passed"; readonly testCount: number }

class CurrentProcessCapability {
  readonly #brand = true
}

type CooperativeTransaction = {
  consumed: boolean
  readonly capability: CurrentProcessCapability
  readonly key: string
}

const activeTransactions = new Map<string, CooperativeTransaction>()
const decisionTransactions = new WeakMap<object, CooperativeTransaction>()

export function runCurrentProcessCooperativeFinish(
  projectDir: string,
  boundary?: ProjectReadBoundary,
  suppliedContext?: CooperativeFinishContext,
): CooperativeFinishAuthorityResult {
  // The other half of #235. Now that a platform with no native artifact can
  // prepare a context and reach blocker evaluation, nothing else stands
  // between it and `runCooperativeGradleVerification` below — a non-boundary
  // path that returns `passed`. `doctor` states in words that such a platform
  // "cannot reach a cooperative PASS", and the boundary is what runs the
  // build, so a PASS without it would keep the word and drop the thing it
  // names.
  //
  // Checked on the platform fact, not on `boundary === undefined`: an absent
  // boundary is a legitimate state for callers on a platform that does build
  // one, and using it here would change their behaviour too.
  if (!nativeProjectReadPlatformSupported()) {
    return { code: "cooperative-pass-unavailable-on-this-platform", kind: "blocked" }
  }
  const context = suppliedContext === undefined
    ? prepareCooperativeFinishContext(projectDir, boundary)
    : { kind: "ready" as const, value: suppliedContext }
  if (context.kind === "blocked") return context
  const key = cooperativeWorkspaceKey(context.value.workspace)
  if (activeTransactions.has(key)) return { code: "cooperative-session-active", kind: "blocked" }

  const transaction: CooperativeTransaction = {
    capability: new CurrentProcessCapability(),
    consumed: false,
    key,
  }
  activeTransactions.set(key, transaction)
  try {
    const verification = boundary === undefined
      ? runCooperativeGradleVerification(projectDir, context.value)
      : runCooperativeGradleVerificationWithinBoundary(projectDir, context.value, boundary)
    if (verification.kind === "blocked") return verification
    const decision = createDecision(transaction, verification.value)
    if (!isLiveCooperativeDecision(decision) || !consumeDecision(decision)) {
      return { code: "cooperative-capability-unavailable", kind: "blocked" }
    }
    return { kind: "passed", testCount: verification.value.testCount }
  } finally {
    if (activeTransactions.get(key) === transaction) activeTransactions.delete(key)
  }
}

export function isLiveCooperativeDecision(value: unknown): value is CooperativeCurrentProcessVerificationDecision {
  if (typeof value !== "object" || value === null) return false
  const transaction = decisionTransactions.get(value)
  return transaction !== undefined
    && !transaction.consumed
    && activeTransactions.get(transaction.key) === transaction
}

function createDecision(
  transaction: CooperativeTransaction,
  input: {
    readonly commandPlanDigest: string
    readonly sourceSnapshotDigest: string
    readonly testCount: number
  },
): CooperativeCurrentProcessVerificationDecision {
  const decision: CooperativeCurrentProcessVerificationDecision = Object.freeze({
    assurance: "cooperative",
    authorityProvider: "cooperative-current-process",
    commandCatalogId: "java-spring-gradle-cooperative.1",
    commandPlanDigest: input.commandPlanDigest,
    completionEligible: true,
    consumptionState: "unconsumed",
    decisionId: `cooperative-${input.commandPlanDigest.slice("sha256:".length, 20)}`,
    kind: "cooperative-current-process",
    sourceSnapshotDigest: input.sourceSnapshotDigest,
    status: "trusted",
    testCount: input.testCount,
    verifiedAt: new Date().toISOString(),
  })
  decisionTransactions.set(decision, transaction)
  return decision
}

function consumeDecision(decision: CooperativeCurrentProcessVerificationDecision): boolean {
  const transaction = decisionTransactions.get(decision)
  if (transaction === undefined || transaction.consumed || activeTransactions.get(transaction.key) !== transaction) {
    return false
  }
  if (!(transaction.capability instanceof CurrentProcessCapability)) return false
  transaction.consumed = true
  decisionTransactions.delete(decision)
  return true
}
