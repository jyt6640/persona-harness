import { isBackendBootstrapTargetFile, resolveBootstrapFileRole, resolveFileRole } from "./file-role.js"
import { loadHarnessConfigResult, type HarnessConfigLoadResult } from "../config/harness-config.js"
import { loadBackendPolicyOverlay } from "../config/policy-overlay.js"
import { loadBackendProjectProfileSummary, readBackendProjectProfileState } from "../config/project-profile.js"
import { loadRulesForRole } from "../rules/rule-loader.js"
import { resolveSharedSkillFileRole, selectSharedSkillsForTarget } from "./shared-skill-router.js"
import { createRuntimeContextSections, runtimeContextDigest } from "./runtime-context.js"
import type { PendingInjection } from "./types.js"
import { isJavaTargetFile } from "./file-role.js"
import {
  createProductSafetyInvariants,
  createStarterProfileDefaults,
  resolveEffectiveProfile,
  type EffectiveProfileRelevance,
  type EffectiveProfileRuleInput,
} from "./effective-profile.js"

const inactivePolicyOverlay: PendingInjection["selectedPolicyOverlay"] = {
  enabled: false,
  sources: [],
  diagnostics: [],
}

export type EffectiveProfileInjectionOptions = {
  readonly available?: boolean
  readonly context?: EffectiveProfileRelevance
  readonly maxCapsules?: number
  readonly personalRules?: readonly EffectiveProfileRuleInput[]
  readonly productInvariants?: readonly EffectiveProfileRuleInput[]
  readonly projectContracts?: readonly EffectiveProfileRuleInput[]
  readonly starterDefaults?: readonly EffectiveProfileRuleInput[]
  readonly taskDecisions?: readonly EffectiveProfileRuleInput[]
}

export type InjectionBlockOptions = {
  readonly configResult?: HarnessConfigLoadResult
  readonly effectiveProfile?: EffectiveProfileInjectionOptions
}

function dedupePolicies(policies: string[]): string[] {
  return Array.from(new Set(policies))
}

function dedupeStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values))
}

function tier0GuidanceLines(): readonly string[] {
  return [
    "Tier0 - source-of-truth boundaries:",
    "- PH guidance is project-local prerelease guidance; it is not generated app product-quality certification.",
    "- `.persona/project-profile.jsonc`, when present, is the stack/source-of-truth boundary before implementation; profile exists but not read → do not implement yet.",
    "- Do not read node_modules, .opencode, package vendor files, .persona/rules, or .persona/evidence as implementation context.",
    "- Use PH-owned surfaces first: accepted plan, injection summary, workflow check/closure, ast-grep conventions, relay handoff, and bearshell.",
    "- Optional external code-nav tools may help only when actually installed; do not present them as PH-owned or token-saving.",
  ]
}

function tier1WorkflowRailLines(): readonly string[] {
  return [
    "Tier1 - advisory workflow boundary:",
    "- If profile, policy, or plan state is incomplete, do not implement yet; report the missing project input.",
    "- A host injection does not start, continue, or repair a workflow. Wait for an explicit user-selected procedure.",
    "- Keep pasted product requirements conversational until the user approves a brief and chooses technical intake or planning.",
    "- Read long README/plan content in bounded chunks and state any unread range before making an implementation claim.",
  ]
}

function tier3ClosureLines(): readonly string[] {
  return [
    "Tier3 - advisory closure boundary:",
    "- Keep read and verification evidence honest; reports do not become authority merely because an adapter mentions them.",
    "- Archive only reviewed/completed tickets; pending tickets remain honest blockers.",
    "- Before claiming done, use the project’s explicit Finish policy and report any blocker instead of inferring success.",
    "- The host adapter cannot close, archive, or continue workflow state.",
  ]
}

export function createInjectionBlock(
  targetFile: string,
  projectDir = process.cwd(),
  options: InjectionBlockOptions = {},
): PendingInjection {
  const configResult = options.configResult ?? loadHarnessConfigResult(projectDir)
  const config = configResult.config
  const selectedSharedSkills = selectSharedSkillsForTarget(targetFile)
  const isJavaTarget = isJavaTargetFile(targetFile)
  const isBootstrapTarget = isBackendBootstrapTargetFile(targetFile)
  const fileRole = isJavaTarget
    ? resolveFileRole(targetFile)
    : isBootstrapTarget
      ? resolveBootstrapFileRole(targetFile)
      : resolveSharedSkillFileRole(selectedSharedSkills, targetFile)
  const shouldLoadJavaRules = isJavaTarget || isBootstrapTarget || fileRole === "java-common"
  const ruleTargetFile = shouldLoadJavaRules ? targetFile : undefined
  const loadedRules = shouldLoadJavaRules ? loadRulesForRole(projectDir, fileRole, ruleTargetFile) : []
  const projectProfileSummary = shouldLoadJavaRules ? loadBackendProjectProfileSummary(projectDir) : []
  const projectProfileState = shouldLoadJavaRules ? readBackendProjectProfileState(projectDir) : undefined
  const policyOverlay = shouldLoadJavaRules
    ? loadBackendPolicyOverlay(projectDir)
    : { summaryLines: [], metadata: inactivePolicyOverlay }
  const selectedRules = loadedRules.map((rule) => rule.path)
  const selectedRuleMetadata = loadedRules.map((rule) => ({
    path: rule.path,
    id: rule.metadata.id,
    source: rule.metadata.source,
    domain: rule.metadata.domain,
    topic: rule.metadata.topic,
    severity: rule.metadata.severity,
  }))
  const policies = dedupePolicies(loadedRules.flatMap((rule) => rule.policies)).slice(0, config.maxRulesPerInjection)
  const profileOptions = options.effectiveProfile
  const profileContext = profileOptions?.context ?? {
    fileRole,
    skillIds: selectedSharedSkills.map((skill) => skill.name),
    topics: dedupeStrings([
      "safety-no-inference",
      "safety-no-sensitive-persistence",
      fileRole,
      ...selectedSharedSkills.map((skill) => skill.name),
      ...selectedRuleMetadata.flatMap((rule) => rule.topic === undefined ? [] : [rule.topic]),
    ]),
  }
  const profileResolution = resolveEffectiveProfile({
    maxCapsules: profileOptions?.maxCapsules ?? Math.min(config.maxRulesPerInjection, 8),
    personalProfileAvailable: profileOptions?.available ?? true,
    personalRules: profileOptions?.personalRules ?? [],
    productInvariants: profileOptions?.productInvariants ?? createProductSafetyInvariants(),
    projectContracts: profileOptions?.projectContracts ?? [],
    relevance: profileContext,
    starterDefaults: profileOptions?.starterDefaults ?? createStarterProfileDefaults(),
    taskDecisions: profileOptions?.taskDecisions ?? [],
  })
  const profileCapsules = profileResolution.status === "resolved" ? profileResolution.capsules : []
  const selectedProfileRuleIds = profileResolution.status === "resolved"
    ? profileResolution.selections.map((selection) => selection.id)
    : []
  const selectedProfileSources = profileResolution.status === "resolved"
    ? profileResolution.selections.map((selection) => selection.source)
    : []
  const profileSelectionReasons = profileResolution.status === "resolved"
    ? profileResolution.selections.map((selection) => selection.reason)
    : []
  const guidanceLines = [
    ...(projectProfileState !== undefined && projectProfileState.status !== "ready"
      ? [
          "Project profile status:",
          `- ${projectProfileState.message}`,
          "- In a user-operated terminal, run `npx ph init` or `npx ph intake --interactive` to complete the profile interview.",
          "- In an AI/non-TTY shell, do not attempt interactive prompts; run `npx ph bootstrap backend`.",
          "- Do not start the Harness workflow implementation rail until the profile is ready.",
          "",
        ]
      : []),
    ...(configResult.diagnostics.length > 0
      ? [
          "Config diagnostics:",
          ...configResult.diagnostics.map((diagnostic) => `- ${diagnostic.code}: ${diagnostic.message}`),
          "",
        ]
      : []),
    "Notes:",
    ...tier0GuidanceLines(),
    ...(shouldLoadJavaRules ? ["", ...tier1WorkflowRailLines(), "", ...tier3ClosureLines()] : []),
  ]
  const block = [
    "[Persona Harness Injection]",
    "",
    `Current file: ${targetFile}`,
    `File role: ${fileRole}`,
    "",
    ...(projectProfileSummary.length > 0 ? [...projectProfileSummary, ""] : []),
    ...(projectProfileState !== undefined && projectProfileState.status !== "ready"
      ? [
          "Project profile status:",
          `- ${projectProfileState.message}`,
          "- In a user-operated terminal, run `npx ph init` or `npx ph intake --interactive` to complete the profile interview.",
          "- In an AI/non-TTY shell, do not attempt interactive prompts; run `npx ph bootstrap backend`.",
          "- Do not start the Harness workflow implementation rail until the profile is ready.",
          "",
        ]
      : []),
    ...(policyOverlay.summaryLines.length > 0 ? [...policyOverlay.summaryLines, ""] : []),
    ...(profileCapsules.length > 0
      ? [
          "Selected profile capsules:",
          ...profileCapsules.map((capsule) => `- ${capsule.id} (${capsule.source}/${capsule.topic})`),
          "",
        ]
      : []),
    "Selected rules:",
    ...selectedRules.map((rule) => `- ${rule}`),
    "",
    "Selected skills:",
    ...(selectedSharedSkills.length > 0
      ? selectedSharedSkills.map((skill) => `- ${skill.name} (${skill.domain}): ${skill.reason}`)
      : ["- None"]),
    "",
    ...(configResult.diagnostics.length > 0
      ? [
          "Config diagnostics:",
          ...configResult.diagnostics.map((diagnostic) => `- ${diagnostic.code}: ${diagnostic.message}`),
          "",
        ]
      : []),
    "Applied policies:",
    ...policies.map((policy) => `- ${policy}`),
    "",
    "Notes:",
    ...tier0GuidanceLines(),
    ...(shouldLoadJavaRules ? ["", ...tier1WorkflowRailLines(), "", ...tier3ClosureLines()] : []),
  ].join("\n")

  const semanticSections = createRuntimeContextSections({
    target: { targetFile, fileRole },
    profile: projectProfileSummary,
    overlay: {
      metadata: policyOverlay.metadata,
      summaryLines: policyOverlay.summaryLines,
    },
    rules: {
      policies,
      selectedRuleMetadata,
      selectedRules,
    },
    skills: selectedSharedSkills,
    capsules: profileCapsules,
    guidance: guidanceLines,
  })

  return {
    targetFile,
    fileRole,
    selectedHarnessConfigDiagnostics: configResult.diagnostics,
    selectedRules,
    selectedRuleMetadata,
    selectedSharedSkills,
    selectedPolicyOverlay: policyOverlay.metadata,
    policies,
    block,
    semanticSections,
    contextDigest: runtimeContextDigest(semanticSections),
    selectedProfileRuleIds,
    selectedProfileSources,
    profileSelectionReasons,
  }
}
