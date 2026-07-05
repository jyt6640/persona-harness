import { isBackendBootstrapTargetFile, resolveBootstrapFileRole, resolveFileRole } from "./file-role.js"
import { loadHarnessConfigResult, type HarnessConfigLoadResult } from "../config/harness-config.js"
import { loadBackendPolicyOverlay } from "../config/policy-overlay.js"
import { loadBackendProjectProfileSummary, readBackendProjectProfileState } from "../config/project-profile.js"
import { loadRulesForRole } from "../rules/rule-loader.js"
import { resolveSharedSkillFileRole, selectSharedSkillsForTarget } from "./shared-skill-router.js"
import type { PendingInjection } from "./types.js"
import { isJavaTargetFile } from "./file-role.js"

const inactivePolicyOverlay: PendingInjection["selectedPolicyOverlay"] = {
  enabled: false,
  sources: [],
  diagnostics: [],
}

type InjectionBlockOptions = {
  readonly configResult?: HarnessConfigLoadResult
}

function dedupePolicies(policies: string[]): string[] {
  return Array.from(new Set(policies))
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
    "Tier1 - implement/continue workflow rail:",
    "- If `.persona` exists but profile/policy/plan is empty, do not implement yet; in AI/non-TTY shell run `npx ph bootstrap backend`.",
    "- For short implementation requests, run `npx ph workflow implement` first and follow that single rail.",
    "- For pasted requirements, run `npx ph workflow capture --stdin`, `npx ph workflow split`, and `npx ph workflow next` before code.",
    "- If `npx ph workflow implement` fails, stop and report the plan/status blocker instead of coding.",
    "- Read long README/plan content in bounded chunks with `npx ph bearshell`; record unread ranges in implementation-report.",
  ]
}

function tier3ClosureLines(): readonly string[] {
  return [
    "Tier3 - finish/review/archive verification:",
    "- Fill implementation-report with real read/verification evidence before `npx ph plan --report-filled implementation`.",
    "- Fill review-report after review/manual QA, then run `npx ph plan --report-filled review`.",
    "- Archive only reviewed/completed tickets; pending tickets remain honest blockers.",
    "- Before claiming done, run `npx ph workflow finish implement` and do not claim completion if it fails.",
    "- If blocked, use `npx ph workflow closure next --json` or `npx ph workflow continue` for the first actionable blocker.",
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
  }
}
