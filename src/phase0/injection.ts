import { isBackendBootstrapTargetFile, resolveBootstrapFileRole, resolveFileRole } from "./file-role.js"
import { loadHarnessConfig } from "./harness-config.js"
import { loadBackendProjectProfileSummary } from "./project-profile.js"
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
    ...(projectProfileSummary.length > 0 ? [...projectProfileSummary, ""] : []),
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
    "repo inspection, CLI smoke test, 큰 출력 확인은 `ph bearshell`을 우선 사용한다.",
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
