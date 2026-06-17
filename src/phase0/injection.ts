import { resolveFileRole } from "./file-role.js"
import { loadRulesForRole } from "./rule-loader.js"
import type { PendingInjection } from "./types.js"

const MAX_POLICIES_PER_INJECTION = 12

function dedupePolicies(policies: string[]): string[] {
  return Array.from(new Set(policies))
}

export function createInjectionBlock(targetFile: string, projectDir = process.cwd()): PendingInjection {
  const fileRole = resolveFileRole(targetFile)
  const loadedRules = loadRulesForRole(projectDir, fileRole)
  const selectedRules = loadedRules.map((rule) => rule.path)
  const policies = dedupePolicies(loadedRules.flatMap((rule) => rule.policies)).slice(0, MAX_POLICIES_PER_INJECTION)
  const block = [
    "[Persona Harness Injection]",
    "",
    `현재 파일: ${targetFile}`,
    `파일 역할: ${fileRole}`,
    "",
    "선택 규칙:",
    ...selectedRules.map((rule) => `- ${rule}`),
    "",
    "적용 정책:",
    ...policies.map((policy) => `- ${policy}`),
    "",
    "주의:",
    "이 Phase 0 블록은 .persona/rules 정본을 읽는 MVP rule-loader 결과이며, 아직 full frontmatter/glob engine은 아니다.",
  ].join("\n")

  return {
    targetFile,
    fileRole,
    selectedRules,
    policies,
    block,
  }
}
