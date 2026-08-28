import { randomUUID } from "node:crypto"
import { lstatSync, readFileSync, realpathSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join, posix, win32 } from "node:path"

import { STARTER_PROFILE } from "../context-core/rule-types.js"
import { ensurePrivateDirectory, writePrivateFileAtomic } from "../io/atomic-file.js"
import {
  emptyPersonalizationStore,
  findConflictingRule,
  historyEvent,
  parsePersonalizationCandidate,
  parsePersonalizationStore,
  ruleFromCandidate,
  scopesOverlap,
  type PersonalizationCandidate,
  type PersonalizationDecisionAction,
  type PersonalizationHistoryEvent,
  type PersonalizationScope,
  type PersonalizationStoreDocument,
} from "./personalization-profile-model.js"
import { PersonalizationValidationError } from "./personalization-profile-model.js"

export * from "./personalization-profile-model.js"
export { STARTER_PROFILE } from "../context-core/rule-types.js"

export type PersonalizationStoreOptions = {
  readonly env?: Readonly<Record<string, string | undefined>>
  readonly homeDir?: string
  readonly idFactory?: () => string
  readonly now?: () => Date
  readonly platform?: NodeJS.Platform
  readonly storeRoot?: string
}

export class PersonalizationStoreError extends Error {
  readonly code: "personalization-store-unsafe" | "personalization-store-corrupt" | "personalization-candidate-invalid" | "personalization-candidate-conflict" | "personalization-candidate-missing" | "personalization-resolution-invalid" | "personalization-rule-missing"

  constructor(code: PersonalizationStoreError["code"]) {
    super(code)
    this.name = "PersonalizationStoreError"
    this.code = code
  }
}

export function resolvePersonalizationStoreRoot(options: Pick<PersonalizationStoreOptions, "env" | "homeDir" | "platform"> = {}): string {
  const env = options.env ?? process.env
  const platform = options.platform ?? process.platform
  const path = platform === "win32" ? win32 : posix
  const configured = firstNonEmpty(env.PH_HOME)
  if (configured !== undefined) return safeRoot(configured, path)
  if (platform === "win32") {
    const appData = firstNonEmpty(env.APPDATA)
    if (appData !== undefined) return safeRoot(path.join(appData, "persona-harness"), path)
  }
  const xdg = firstNonEmpty(env.XDG_CONFIG_HOME)
  if (xdg !== undefined) return safeRoot(path.join(xdg, "persona-harness"), path)
  const home = firstNonEmpty(options.homeDir) ?? firstNonEmpty(env.HOME) ?? firstNonEmpty(env.USERPROFILE) ?? homedir()
  return safeRoot(path.join(home, ".config", "persona-harness"), path)
}

export function personalizationStorePath(options: PersonalizationStoreOptions = {}): string {
  const root = options.storeRoot ?? resolvePersonalizationStoreRoot(options)
  const path = options.platform === "win32" ? win32 : posix
  return path.join(assertSafeStoreRoot(root, path), "profile.json")
}

export function readPersonalizationStore(options: PersonalizationStoreOptions = {}): PersonalizationStoreDocument {
  const path = personalizationStorePath(options)
  const root = dirname(path)
  try {
    const rootStat = lstatSync(root)
    if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) throw new PersonalizationStoreError("personalization-store-unsafe")
  } catch (error) {
    if (error instanceof PersonalizationStoreError) throw error
    if (isMissingPathError(error)) return emptyPersonalizationStore()
    throw new PersonalizationStoreError("personalization-store-unsafe")
  }
  let parsed: unknown
  try {
    const stat = lstatSync(path)
    if (stat.isSymbolicLink()) throw new PersonalizationStoreError("personalization-store-unsafe")
    if (!stat.isFile() || stat.isSymbolicLink()) throw new PersonalizationStoreError("personalization-store-unsafe")
    parsed = JSON.parse(readFileSync(path, "utf8")) as unknown
  } catch (error) {
    if (error instanceof PersonalizationStoreError) throw error
    if (isMissingPathError(error)) return emptyPersonalizationStore()
    throw new PersonalizationStoreError("personalization-store-corrupt")
  }
  try {
    return parsePersonalizationStore(parsed)
  } catch (error) {
    if (error instanceof PersonalizationValidationError && error.code === "personalization-store-corrupt") {
      throw new PersonalizationStoreError("personalization-store-corrupt")
    }
    throw error
  }
}

export function writePersonalizationStore(document: PersonalizationStoreDocument, options: PersonalizationStoreOptions = {}): void {
  let validated: PersonalizationStoreDocument
  try {
    validated = parsePersonalizationStore(document)
  } catch {
    throw new PersonalizationStoreError("personalization-store-corrupt")
  }
  const path = personalizationStorePath(options)
  const root = dirname(path)
  assertSafeStoreRoot(root, options.platform === "win32" ? win32 : posix)
  assertWritableStoreFile(path)
  ensurePrivateDirectory(root)
  writePrivateFileAtomic(path, `${JSON.stringify(validated, null, 2)}\n`)
}

export type PersonalizationMutationResult = {
  readonly document: PersonalizationStoreDocument
  readonly event: PersonalizationHistoryEvent
  readonly status: "activated" | "conflict" | "pending" | "retained" | "exception" | "superseded" | "rollback"
}

export function proposePersonalizationCandidate(
  value: unknown,
  options: PersonalizationStoreOptions = {},
  explicitPending = false,
): PersonalizationMutationResult {
  let candidate: PersonalizationCandidate
  try {
    candidate = parsePersonalizationCandidate(value)
  } catch {
    throw new PersonalizationStoreError("personalization-candidate-invalid")
  }
  const current = readPersonalizationStore(options)
  if (current.profile.activeRules.some((rule) => rule.ruleId === `rule-${candidate.candidateId}`) || current.profile.pendingCandidates.some((item) => item.candidateId === candidate.candidateId)) {
    throw new PersonalizationStoreError("personalization-candidate-invalid")
  }
  const now = timestamp(options)
  const decisionId = createId(options, "decision")
  const eventId = createId(options, "event")
  const conflict = findConflictingRule(current.profile.activeRules, candidate)
  if (explicitPending) {
    const event = historyEvent(eventId, "pending", now, decisionId, candidate.candidateId, null)
    const document = withMutation(current, {
      action: "pending",
      candidate,
      decisionId,
      event,
      ruleId: null,
    })
    writePersonalizationStore(document, options)
    return { document, event, status: "pending" }
  }
  if (conflict !== undefined) {
    const event = historyEvent(eventId, "conflict", now, decisionId, candidate.candidateId, null)
    const document = withMutation(current, {
      action: "pending",
      candidate,
      decisionId,
      event,
      ruleId: null,
    })
    writePersonalizationStore(document, options)
    return { document, event, status: "conflict" }
  }
  const ruleId = `rule-${candidate.candidateId}`
  const rule = ruleFromCandidate(candidate, ruleId, now)
  const event = historyEvent(eventId, "activated", now, decisionId, candidate.candidateId, ruleId)
  const document = withMutation(current, { action: "activate", candidate, decisionId, event, removeCandidate: true, rule, ruleId })
  writePersonalizationStore(document, options)
  return { document, event, status: "activated" }
}

export function resolvePersonalizationCandidate(
  candidateId: string,
  action: Exclude<PersonalizationDecisionAction, "activate" | "rollback">,
  options: PersonalizationStoreOptions = {},
  exceptionScope?: PersonalizationScope,
): PersonalizationMutationResult {
  const current = readPersonalizationStore(options)
  const candidate = current.profile.pendingCandidates.find((item) => item.candidateId === candidateId)
  if (candidate === undefined) throw new PersonalizationStoreError("personalization-candidate-missing")
  const now = timestamp(options)
  const decisionId = createId(options, "decision")
  const eventId = createId(options, "event")
  if (action === "exception" && (exceptionScope === undefined || exceptionScope.kind === "personal")) throw new PersonalizationStoreError("personalization-resolution-invalid")
  const selectedScope = action === "exception" ? exceptionScope : candidate.scope
  const conflict = current.profile.activeRules.find((rule) => rule.topic === candidate.topic && selectedScope !== undefined && scopesOverlap(rule.scope, selectedScope))
  if (action === "exception" && conflict !== undefined) throw new PersonalizationStoreError("personalization-candidate-conflict")
  if (action === "supersede" && conflict === undefined) throw new PersonalizationStoreError("personalization-resolution-invalid")
  const ruleId = action === "exception" || action === "supersede" ? `rule-${candidate.candidateId}` : null
  const rule = ruleId === null ? undefined : ruleFromCandidate(candidate, ruleId, now, selectedScope)
  const eventName: PersonalizationHistoryEvent["event"] = action === "pending"
    ? "pending"
    : action === "retain"
      ? "retained"
      : action === "supersede"
        ? "superseded"
        : "exception"
  const event = historyEvent(eventId, eventName, now, decisionId, candidateId, ruleId)
  const document = withMutation(current, {
    action,
    candidate,
    decisionId,
    event,
    replaceRule: action === "supersede" ? conflict : undefined,
    rule,
    ruleId,
    removeCandidate: action !== "pending",
  })
  writePersonalizationStore(document, options)
  return { document, event, status: eventName }
}

export function rollbackPersonalizationRule(ruleId: string, options: PersonalizationStoreOptions = {}): PersonalizationMutationResult {
  const current = readPersonalizationStore(options)
  const rule = current.profile.activeRules.find((item) => item.ruleId === ruleId)
  if (rule === undefined) throw new PersonalizationStoreError("personalization-rule-missing")
  const now = timestamp(options)
  const decisionId = createId(options, "decision")
  const event = historyEvent(createId(options, "event"), "rollback", now, decisionId, null, ruleId)
  const document = withMutation(current, { action: "rollback", decisionId, event, removeRule: ruleId, ruleId })
  writePersonalizationStore(document, options)
  return { document, event, status: "rollback" }
}

function withMutation(
  current: PersonalizationStoreDocument,
  mutation: {
    readonly action: PersonalizationDecisionAction
    readonly candidate?: PersonalizationCandidate
    readonly decisionId: string
    readonly event: PersonalizationHistoryEvent
    readonly removeCandidate?: boolean
    readonly removeRule?: string
    readonly replaceRule?: { readonly ruleId: string }
    readonly rule?: ReturnType<typeof ruleFromCandidate>
    readonly ruleId: string | null
  },
): PersonalizationStoreDocument {
  const activeRules = current.profile.activeRules
    .filter((rule) => rule.ruleId !== mutation.removeRule && rule.ruleId !== mutation.replaceRule?.ruleId)
  const nextRules = mutation.rule === undefined ? activeRules : [...activeRules, mutation.rule]
  const removeCandidate = mutation.removeCandidate === true || mutation.action === "activate"
  const pendingCandidates = mutation.candidate === undefined || removeCandidate
    ? current.profile.pendingCandidates.filter((candidate) => candidate.candidateId !== mutation.candidate?.candidateId)
    : [...current.profile.pendingCandidates, mutation.candidate]
  const scope = mutation.rule?.scope ?? null
  const decision = {
    action: mutation.action,
    candidateId: mutation.candidate?.candidateId ?? null,
    decidedAt: mutation.event.occurredAt,
    decisionId: mutation.decisionId,
    ruleId: mutation.ruleId,
    schemaVersion: "personalization-decision.v1" as const,
    scope,
  }
  return {
    history: { events: [...current.history.events, mutation.event], schemaVersion: current.history.schemaVersion },
    profile: {
      activeRules: nextRules,
      decisions: [...current.profile.decisions, decision],
      pendingCandidates,
      schemaVersion: current.profile.schemaVersion,
    },
    schemaVersion: current.schemaVersion,
  }
}

function assertSafeStoreRoot(root: string, path: typeof posix | typeof win32): string {
  if (!path.isAbsolute(root) || root.includes("\0") || root.trim() === "") throw new PersonalizationStoreError("personalization-store-unsafe")
  const parsed = path.parse(root)
  let current = parsed.root
  if (validateExistingDirectory(current) === "missing") throw new PersonalizationStoreError("personalization-store-unsafe")
  const relativeRoot = path.relative(parsed.root, root)
  for (const segment of relativeRoot.split(path.sep).filter((value) => value.length > 0)) {
    current = path.join(current, segment)
    if (validateExistingDirectory(current) === "missing") return root
  }
  return root
}

function validateExistingDirectory(candidate: string): "present" | "missing" {
  try {
    const stat = lstatSync(candidate)
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new PersonalizationStoreError("personalization-store-unsafe")
    const canonical = realpathSync.native(candidate)
    const canonicalStat = lstatSync(canonical)
    if (canonicalStat.isSymbolicLink() || !canonicalStat.isDirectory()) throw new PersonalizationStoreError("personalization-store-unsafe")
    return "present"
  } catch (error) {
    if (error instanceof PersonalizationStoreError) throw error
    if (isMissingPathError(error)) return "missing"
    throw new PersonalizationStoreError("personalization-store-unsafe")
  }
}

function assertWritableStoreFile(path: string): void {
  try {
    const stat = lstatSync(path)
    if (stat.isSymbolicLink() || !stat.isFile()) throw new PersonalizationStoreError("personalization-store-unsafe")
  } catch (error) {
    if (error instanceof PersonalizationStoreError) throw error
    if (!isMissingPathError(error)) throw new PersonalizationStoreError("personalization-store-unsafe")
  }
}

function isMissingPathError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT"
}

function safeRoot(root: string, path: typeof posix | typeof win32): string {
  if (!path.isAbsolute(root) || root.includes("\0") || root.trim() === "") throw new PersonalizationStoreError("personalization-store-unsafe")
  return root
}

function firstNonEmpty(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === "" ? undefined : value
}

function timestamp(options: PersonalizationStoreOptions): string {
  return (options.now ?? (() => new Date()))().toISOString()
}

function createId(options: PersonalizationStoreOptions, prefix: string): string {
  return `${prefix}-${(options.idFactory ?? randomUUID)()}`
}
