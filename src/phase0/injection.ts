import { resolveFileRole } from "./file-role.js"
import { loadHarnessConfig } from "./harness-config.js"
import { loadRulesForRole } from "./rule-loader.js"
import { resolveSharedSkillFileRole, selectSharedSkillsForTarget } from "./shared-skill-router.js"
import type { PendingInjection } from "./types.js"
import { isJavaTargetFile } from "./file-role.js"

function dedupePolicies(policies: string[]): string[] {
  return Array.from(new Set(policies))
}

export function createInjectionBlock(targetFile: string, projectDir = process.cwd()): PendingInjection {
  const config = loadHarnessConfig(projectDir)
  const selectedSharedSkills = selectSharedSkillsForTarget(targetFile)
  const fileRole = isJavaTargetFile(targetFile) ? resolveFileRole(targetFile) : resolveSharedSkillFileRole(selectedSharedSkills)
  const loadedRules = isJavaTargetFile(targetFile) ? loadRulesForRole(projectDir, fileRole, targetFile) : []
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
    `현재 파일: ${targetFile}`,
    `파일 역할: ${fileRole}`,
    "",
    "선택 규칙:",
    ...selectedRules.map((rule) => `- ${rule}`),
    "",
    "선택 스킬:",
    ...(selectedSharedSkills.length > 0
      ? selectedSharedSkills.map((skill) => `- ${skill.name} (${skill.domain}): ${skill.path} — ${skill.reason}`)
      : ["- 없음"]),
    "",
    "적용 정책:",
    ...policies.map((policy) => `- ${policy}`),
    "",
    "주의:",
    "이 Phase 0 블록은 .persona/rules 정본과 최소 frontmatter/glob/scenario catalog layer를 읽는 MVP rule-loader 결과이며, 아직 full rule engine은 아니다.",
  ].join("\n")

  return {
    targetFile,
    fileRole,
    selectedRules,
    selectedRuleMetadata,
    selectedSharedSkills,
    policies,
    block,
  }
}
