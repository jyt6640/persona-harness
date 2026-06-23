import { isBackendBootstrapTargetFile, resolveBootstrapFileRole, resolveFileRole } from "./file-role.js"
import { loadHarnessConfigResult } from "../config/harness-config.js"
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

function dedupePolicies(policies: string[]): string[] {
  return Array.from(new Set(policies))
}

export function createInjectionBlock(targetFile: string, projectDir = process.cwd()): PendingInjection {
  const configResult = loadHarnessConfigResult(projectDir)
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
    `현재 파일: ${targetFile}`,
    `파일 역할: ${fileRole}`,
    "",
    ...(projectProfileSummary.length > 0 ? [...projectProfileSummary, ""] : []),
    ...(projectProfileState !== undefined && projectProfileState.status !== "ready"
      ? [
          "프로젝트 프로필 상태:",
          `- ${projectProfileState.message}`,
          "- 사용자 직접 터미널에서는 `npx ph init` 또는 `npx ph intake --interactive`로 프로필 인터뷰를 완료한다.",
          "- AI/non-TTY shell에서는 interactive prompt를 시도하지 말고 `npx ph bootstrap backend`를 실행한다.",
          "- 프로필이 ready가 되기 전에는 하네스 workflow 구현 레일을 시작하지 않는다.",
          "",
        ]
      : []),
    ...(policyOverlay.summaryLines.length > 0 ? [...policyOverlay.summaryLines, ""] : []),
    "선택 규칙:",
    ...selectedRules.map((rule) => `- ${rule}`),
    "",
    "선택 스킬:",
    ...(selectedSharedSkills.length > 0
      ? selectedSharedSkills.map((skill) => `- ${skill.name} (${skill.domain}): ${skill.reason}`)
      : ["- 없음"]),
    "",
    ...(configResult.diagnostics.length > 0
      ? [
          "설정 진단:",
          ...configResult.diagnostics.map((diagnostic) => `- ${diagnostic.code}: ${diagnostic.message}`),
          "",
        ]
      : []),
    "적용 정책:",
    ...policies.map((policy) => `- ${policy}`),
    "",
    "주의:",
    "이 Phase 0 블록은 .persona/rules 정본과 최소 frontmatter/glob/scenario catalog layer를 읽는 MVP rule-loader 결과이며, 아직 full rule engine은 아니다.",
    "코드 구조 분석이나 변경 영향 파악이 필요하면 raw file read보다 codegraph MCP를 먼저 사용한다. codegraph를 사용할 수 없을 때만 필요한 파일 범위를 직접 읽고 그 이유를 남긴다.",
    "repo inspection, CLI smoke test, 큰 출력 확인은 `ph bearshell`을 우선 사용한다.",
    "`.persona`가 있는데 프로젝트 프로필/정책/계획이 비어 있으면 구현하지 말고, AI/non-TTY shell에서는 먼저 `npx ph bootstrap backend`를 실행한다.",
    "사용자가 직접 터미널을 쓰는 상황이면 `npx ph init` 또는 `npx ph intake --interactive`로 프로필 인터뷰를 완료하게 안내한다.",
    "`.persona`가 없는 일반 프로젝트에는 Persona Harness workflow를 강제하지 않는다. 하네스를 쓰려면 사용자가 `npx ph init`으로 opt in한다.",
    "짧은 구현 지시(예: '플랜 보고 구현해줘', '계획대로 해줘', '이제 구현해줘')를 받으면 먼저 `npx ph workflow implement`를 실행하고, 그 단일 레일을 따른다.",
    "프롬프트에 요구사항이 직접 들어오면 구현 전에 `npx ph workflow capture --stdin`, `npx ph workflow split`, `npx ph workflow next`로 요구사항 분석과 backlog를 먼저 남긴다.",
    "`npx ph workflow split`은 Step heading이 없어도 `.persona/workflow/requirements-analysis.md`와 fallback task ticket을 만든다.",
    "`npx ph workflow implement`가 실패하면 구현하지 말고 plan/status 문제를 사용자에게 보고한다.",
    "긴 README/plan은 `npx ph bearshell --shell 'sed -n \"1,220p\" <file>'`처럼 범위를 나눠 끝까지 읽는다.",
    "중간에 멈추면 implementation-report에 남은 범위를 기록한다.",
    "최종 답변 전에는 review-report를 채우고 `npx ph plan --report-filled review`와 `npx ph workflow finish implement`를 실행한다.",
    "`npx ph workflow finish implement`가 실패하면 완료 보고를 하지 말고 부족한 workflow evidence를 먼저 채운다.",
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
