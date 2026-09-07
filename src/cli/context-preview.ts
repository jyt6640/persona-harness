import {
  buildContextEnvelope,
  createProductSafetyInvariants,
  createStarterProfileDefaults,
  resolveEffectiveContext,
  type ContextEnvelope,
  type ContextRule,
  type EffectiveContextResolution,
} from "../context-core/index.js"
import { isContextPersonalizationEnabled, loadHarnessConfigResult } from "../config/harness-config.js"
import { loadTeamProfile, toTeamContextRules } from "../context-profile/team-profile-store.js"
import {
  PersonalizationStoreError,
  type PersonalizationStoreOptions,
} from "./personalization-profile-store.js"
import { contextScope, readContextPersonalization, withPersonalizationWarnings, type ContextPersonalization } from "./context-personalization.js"
import { parseContextPreviewRequest, type ContextPreviewRequest } from "./context-preview-request.js"
import { ContextScopeError, readCheckoutProjectBinding, type CheckoutProjectBinding } from "./context-checkout-binding.js"

export type ContextPreviewCommandResult = {
  readonly status: 0 | 1
  readonly stderr: string
  readonly stdout: string
}

export type ContextPreviewFailureCode =
  | "context-config-invalid"
  | "context-config-unavailable"
  | "context-personal-profile-unavailable"
  | "context-target-invalid"
  | "context-target-required"
  | "context-team-profile-invalid"
  | "context-topic-unavailable"
  | "context-preview-arguments-invalid"
  | "context-scope-unavailable"

export type ContextTargetDetection = {
  readonly fileRole: string
  readonly language: string
}

export type ContextPreviewOptions = {
  readonly personalization?: PersonalizationStoreOptions
}

export type ContextPreviewData = {
  readonly contextEnabled: boolean
  readonly detected: ContextTargetDetection
  readonly envelope: ContextEnvelope
  readonly resolution: EffectiveContextResolution
}

export type ContextPreviewReadResult =
  | { readonly status: "ready"; readonly preview: ContextPreviewData }
  | { readonly status: "blocked"; readonly code: ContextPreviewFailureCode }

export function runContextPreviewCommand(
  args: readonly string[],
  projectDir: string,
  options: ContextPreviewOptions = {},
): ContextPreviewCommandResult {
  const result = readContextPreview(args, projectDir, options)
  if (result.status === "blocked") return failure(result.code)

  const { contextEnabled, detected, envelope } = result.preview
  const output = { contextEnabled, detected, envelope }
  return args.includes("--json")
    ? success(`${JSON.stringify(output)}\n`)
    : success(renderPreview(contextEnabled, detected, envelope))
}

export function readContextPreview(
  args: readonly string[],
  projectDir: string,
  options: ContextPreviewOptions = {},
): ContextPreviewReadResult {
  return createContextPreviewReader(projectDir, options)(args)
}

type ContextPreviewSources = {
  readonly status: "ready"
  readonly configResult: ReturnType<typeof loadHarnessConfigResult>
  readonly teamResult: ReturnType<typeof loadTeamProfile>
  readonly personalization: ContextPersonalization
  readonly binding: CheckoutProjectBinding
}

// A reader owns one immutable batch snapshot; create a new reader for the next request.
export function createContextPreviewReader(
  projectDir: string,
  options: ContextPreviewOptions = {},
): (args: readonly string[]) => ContextPreviewReadResult {
  let sources: ContextPreviewSources | Extract<ContextPreviewReadResult, { readonly status: "blocked" }> | undefined
  return (args) => {
    const parsed = parseContextPreviewRequest(args)
    if (parsed.status === "blocked") return blocked(parsed.code)
    sources ??= readContextPreviewSources(projectDir, options)
    return sources.status === "blocked" ? sources : previewFromSources(parsed.request, sources)
  }
}

function readContextPreviewSources(
  projectDir: string,
  options: ContextPreviewOptions,
): ContextPreviewSources | Extract<ContextPreviewReadResult, { readonly status: "blocked" }> {
  const configResult = loadHarnessConfigResult(projectDir)
  if (!configResult.safe) return blocked("context-config-unavailable")
  if (configResult.contextDiagnostics.length > 0) return blocked("context-config-invalid")

  const teamResult = loadTeamProfile(projectDir)
  if (teamResult.status === "invalid") return blocked("context-team-profile-invalid")

  let personalization: ContextPersonalization
  let binding: CheckoutProjectBinding
  try {
    personalization = readContextPersonalization(options.personalization)
    binding = readCheckoutProjectBinding(projectDir, options.personalization)
  } catch (error) {
    if (error instanceof ContextScopeError) return blocked("context-scope-unavailable")
    if (error instanceof PersonalizationStoreError) return blocked("context-personal-profile-unavailable")
    throw error
  }
  return { status: "ready", configResult, teamResult, personalization, binding }
}

function previewFromSources(request: ContextPreviewRequest, sources: ContextPreviewSources): ContextPreviewReadResult {
  const { configResult, teamResult, personalization } = sources
  const projectKey = request.projectKey ?? (sources.binding.status === "bound" ? sources.binding.projectKey : undefined)
  const detected = detectTarget(request.targetPath)
  const teamRules = teamResult.status === "available" ? toTeamContextRules(teamResult.profile) : []
  const productInvariants = invariantRules()
  const commonDefaults = starterRules()
  const allRules = [
    ...productInvariants,
    ...commonDefaults,
    ...teamRules,
    ...personalization.personalRules,
    ...personalization.projectContracts,
    ...personalization.taskDecisions,
  ]
  const topics = selectedTopics(request, allRules)
  if (topics === undefined) return blocked("context-topic-unavailable")

  const resolution = resolveEffectiveContext({
    commonDefaults,
    languageDefaults: [],
    maxCapsules: configResult.config.context.maxCapsules,
    personalRules: personalization.personalRules,
    productInvariants,
    projectContracts: personalization.projectContracts,
    relevance: {
      fileRole: detected.fileRole,
      language: detected.language,
      projectKey,
      skillIds: [],
      taskKey: request.taskKey,
      teamKey: teamResult.status === "available" ? teamResult.profile.teamKey : undefined,
      topics,
    },
    taskDecisions: personalization.taskDecisions,
    teamContracts: teamRules,
  })
  const envelope = buildContextEnvelope({
    budget: {
      maxCapsules: configResult.config.context.maxCapsules,
      maxChars: configResult.config.context.maxChars,
    },
    resolution,
    target: {
      fileRole: detected.fileRole,
      language: detected.language,
      path: request.targetPath,
    },
  })
  return {
    preview: {
      contextEnabled: isContextPersonalizationEnabled(configResult),
      detected,
      envelope: withPersonalizationWarnings(envelope, personalization, { ...request, projectKey }),
      resolution,
    },
    status: "ready",
  }
}

function invariantRules(): readonly ContextRule[] {
  return createProductSafetyInvariants().map(toContextRule)
}

function starterRules(): readonly ContextRule[] {
  return createStarterProfileDefaults().map(toContextRule)
}

function toContextRule(rule: ReturnType<typeof createProductSafetyInvariants>[number]): ContextRule {
  return {
    fileRoles: rule.fileRoles,
    id: rule.id,
    rule: rule.rule,
    scope: contextScope(rule.scope),
    skillIds: rule.skillIds,
    status: rule.status,
    topic: rule.topic,
  }
}

function selectedTopics(request: ContextPreviewRequest, rules: readonly ContextRule[]): readonly string[] | undefined {
  const available = new Set(rules.map((rule) => rule.topic))
  if (request.topics.length === 0) return [...available].sort()
  return request.topics.every((topic) => available.has(topic)) ? request.topics : undefined
}

function detectTarget(targetPath: string): ContextTargetDetection {
  const lowerPath = targetPath.toLowerCase()
  return { fileRole: fileRoleFor(lowerPath), language: languageFor(lowerPath) }
}

function fileRoleFor(lowerPath: string): string {
  if (lowerPath.includes("/test/") || /(?:^|\/)test[^/]*\.[a-z0-9]+$/u.test(lowerPath)) return "test"
  if (lowerPath.includes("controller")) return "controller"
  if (lowerPath.includes("service")) return "service"
  if (lowerPath.includes("repository")) return "repository"
  if (lowerPath.endsWith(".md") || lowerPath.endsWith(".mdx")) return "docs"
  return "source"
}

function languageFor(lowerPath: string): string {
  if (lowerPath.endsWith(".java")) return "java"
  if (lowerPath.endsWith(".kt") || lowerPath.endsWith(".kts")) return "kotlin"
  if (lowerPath.endsWith(".ts") || lowerPath.endsWith(".tsx")) return "typescript"
  if (lowerPath.endsWith(".js") || lowerPath.endsWith(".jsx") || lowerPath.endsWith(".mjs") || lowerPath.endsWith(".cjs")) return "javascript"
  if (lowerPath.endsWith(".md") || lowerPath.endsWith(".mdx")) return "markdown"
  if (lowerPath.endsWith(".json") || lowerPath.endsWith(".jsonc")) return "json"
  return "common"
}

function renderPreview(
  contextEnabled: boolean,
  detected: ContextTargetDetection,
  envelope: ContextEnvelope,
): string {
  const lines = [
    "Context Preview (Experimental)",
    `Target: ${envelope.target.path}`,
    `Detected language: ${detected.language}`,
    `Detected file role: ${detected.fileRole}`,
    `Context enabled: ${contextEnabled}`,
    `Envelope status: ${envelope.status}`,
    `Selected capsules: ${envelope.selected.length}`,
    `Budget: selected=${envelope.budget.usedCapsules} chars=${envelope.budget.usedChars} / capsules=${envelope.budget.maxCapsules} chars=${envelope.budget.maxChars}`,
    `Digest: ${envelope.digest}`,
  ]
  if (envelope.status === "blocked") lines.push(`Block reason: ${envelope.blockReason}`)
  return `${lines.join("\n")}\n`
}

function success(stdout: string): ContextPreviewCommandResult {
  return { status: 0, stderr: "", stdout }
}

function blocked(code: ContextPreviewFailureCode): Extract<ContextPreviewReadResult, { readonly status: "blocked" }> {
  return { code, status: "blocked" }
}

function failure(code: ContextPreviewFailureCode): ContextPreviewCommandResult {
  return { status: 1, stderr: `${code}\n`, stdout: "" }
}
