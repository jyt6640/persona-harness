import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import process from "node:process"

import { loadBackendPolicyOverlay } from "../phase0/policy-overlay.js"
import { loadBackendProjectProfileSummary } from "../phase0/project-profile.js"

export type PlanOptions = { readonly projectDir?: string }

export class PlanDraftError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PlanDraftError"
  }
}

export const PLAN_PATH = ".persona/workflow/plan.md"
export const IMPLEMENTATION_REPORT_PATH = ".persona/workflow/implementation-report.md"
export const REVIEW_REPORT_PATH = ".persona/workflow/review-report.md"
const README_PATH = "README.md"

function readReadmeHeading(projectDir: string): string | undefined {
  const readmePath = join(projectDir, README_PATH)
  if (!existsSync(readmePath)) {
    return undefined
  }

  const readme = readFileSync(readmePath, "utf8")
  for (const line of readme.split(/\r?\n/)) {
    const heading = line.match(/^#\s+(.+)$/)
    if (heading?.[1] !== undefined) {
      return heading[1].trim()
    }
  }
  return undefined
}

function profileSummaryLines(projectDir: string): readonly string[] {
  const summary = loadBackendProjectProfileSummary(projectDir)
  if (summary.length > 0) {
    return summary
  }

  return [
    "프로젝트 프로필 요약:",
    "- 응답된 항목 없음",
    "",
    "프로필 사용 원칙:",
    "- 이 요약은 구현 전 architecture/technology plan 참고용이다.",
    "- 사용자의 README/요구사항과 명시 지시가 우선한다.",
    "- 이 요약은 rule enforcement나 product-quality 보증이 아니다.",
  ]
}

function policyOverlayLines(projectDir: string): readonly string[] {
  return loadBackendPolicyOverlay(projectDir).summaryLines
}

function readmeLines(projectDir: string): readonly string[] {
  const heading = readReadmeHeading(projectDir)
  return [
    `Requirements source: \`${README_PATH}\``,
    heading === undefined ? "README status: missing" : `README heading: ${heading}`,
  ]
}

function createPlanDraft(projectDir: string): string {
  const policyOverlaySummary = policyOverlayLines(projectDir)
  return [
    "# Blackbear Architecture Plan",
    "",
    "Role: `blackbear`",
    "Status: draft",
    "",
    "## Inputs",
    "",
    ...readmeLines(projectDir),
    "",
    ...profileSummaryLines(projectDir),
    ...(policyOverlaySummary.length > 0 ? ["", ...policyOverlaySummary] : []),
    "",
    "## Architecture / Technology Plan",
    "",
    "- [ ] 요구사항의 핵심 유스케이스를 README 기준으로 정리한다.",
    "- [ ] Java/Spring Gradle 기준의 기술 선택을 명시한다.",
    "- [ ] package/layer 구조를 정한다.",
    "- [ ] storage/persistence 선택과 repository boundary를 정한다.",
    "- [ ] DTO boundary와 domain behavior 기준을 정한다.",
    "",
    "## Non-Goals",
    "",
    "- rule enforcement가 아니다.",
    "- generated app product-quality 보증이 아니다.",
    "- frontend/infra workflow가 아니다.",
    "- TDD workflow 강제가 아니다.",
    "- autonomous subagent 실행이 아니다.",
    "",
    "## Acceptance",
    "",
    "- implementation must not start until this plan is reviewed or accepted.",
    "- 긴 README나 plan은 한 번에 읽었다고 가정하지 않는다.",
    "- Read tool 출력이 잘리면 `npx ph bearshell --shell 'sed -n \"1,220p\" README.md'`처럼 line range를 나눠 끝까지 읽는다.",
    "- 구현 후에는 Gradle test/build와 manual QA evidence를 별도 report에 남긴다.",
    "- 명령 실행이 필요하면 raw shell보다 `npx ph bearshell`을 우선 사용한다.",
    "",
  ].join("\n")
}

function createImplementationReportTemplate(projectDir: string): string {
  return [
    "# Jaeki Implementation Report",
    "",
    "Role: `jaeki`",
    "Status: template",
    "",
    "## Inputs",
    "",
    ...readmeLines(projectDir),
    "",
    "Plan source: `.persona/workflow/plan.md`",
    "",
    "## Read Coverage",
    "",
    "- README read method:",
    "- README ranges read:",
    "- Plan read method:",
    "- Plan ranges read:",
    "- Unread ranges:",
    "- Read evidence notes:",
    "",
    "## Implemented Files",
    "",
    "- [ ] 작성/수정한 production files",
    "- [ ] 작성/수정한 configuration files",
    "- [ ] 작성/수정한 test files",
    "",
    "## Verification",
    "",
    "- [ ] `npx ph bearshell gradle test`",
    "- [ ] `npx ph bearshell gradle build`",
    "- [ ] 실행 가능한 Spring Boot 앱에서 `:bootJar SKIPPED`가 나오면 build 통과로 기록하지 않는다.",
    "- [ ] `bootJar`가 실패하면 `bootJar`를 끄지 말고 Spring Boot plugin / Gradle wrapper / JDK toolchain 호환성을 맞춘다.",
    "- [ ] 실행 가능한 Spring Boot 앱이면 `npx ph bearshell --shell 'gradle bootRun --args=\"--server.port=<port>\"'`",
    "- [ ] raw shell을 직접 썼다면 `npx ph bearshell`을 쓰지 못한 이유를 기록한다.",
    "",
    "## Manual QA",
    "",
    "- [ ] HTTP happy path를 curl 또는 동등한 HTTP client로 실행했다.",
    "- [ ] HTTP failure path를 curl 또는 동등한 HTTP client로 실행했다.",
    "- [ ] Manual QA가 불가능하면 사유와 stderr/핵심 로그를 기록한다.",
    "",
    "## Status Lifecycle",
    "",
    "- 채운 뒤에는 `npx ph plan --report-filled implementation`을 실행한다.",
    "",
    "## Notes",
    "",
    "- 구현 중 바뀐 결정:",
    "- 남은 한계:",
    "",
    "## Continuation",
    "",
    "- 중간에 멈추면 이 섹션을 채우고 완료했다고 말하지 않는다.",
    "- 마지막으로 완료한 요구사항/파일:",
    "- 남은 README/plan 범위:",
    "- 남은 구현 범위:",
    "- 다음에 이어서 실행할 명령/작업:",
    "",
  ].join("\n")
}

function createReviewReportTemplate(projectDir: string): string {
  return [
    "# Roach Review Report",
    "",
    "Role: `roach`",
    "Status: template",
    "",
    "## Inputs",
    "",
    ...readmeLines(projectDir),
    "",
    "Plan source: `.persona/workflow/plan.md`",
    "Implementation report: `.persona/workflow/implementation-report.md`",
    "",
    "## Requirements Check",
    "",
    "- [ ] README/plan read method와 ranges가 implementation report에 남아 있다.",
    "- [ ] README 요구사항이 구현 결과와 대응된다.",
    "- [ ] 미구현 요구사항이 있으면 명시한다.",
    "",
    "## Boundary Review",
    "",
    "- [ ] Controller는 HTTP request/response와 Service 위임만 담당한다.",
    "- [ ] Application Service는 use-case 흐름만 조율한다.",
    "- [ ] Repository port는 domain에 있고 구현체는 infrastructure에 있다.",
    "- [ ] Request/Response DTO와 Command/Result DTO 경계가 분리된다.",
    "- [ ] Domain model은 자신의 상태 판단/행동을 스스로 가진다.",
    "",
    "## Verification Review",
    "",
    "- [ ] `npx ph bearshell gradle test` 결과를 확인했다.",
    "- [ ] `npx ph bearshell gradle build` 결과를 확인했다.",
    "- [ ] 실행 가능한 Spring Boot 앱에서 `:bootJar SKIPPED` 없이 build가 통과했는지 확인했다.",
    "- [ ] 실행 가능한 Spring Boot 앱이면 `npx ph bearshell --shell 'gradle bootRun --args=\"--server.port=<port>\"'` 결과를 확인했다.",
    "- [ ] HTTP happy path / failure path manual QA evidence를 확인했다.",
    "",
    "## Status Lifecycle",
    "",
    "- 채운 뒤에는 `npx ph plan --report-filled review`를 실행한다.",
    "",
    "## Remaining Limits",
    "",
    "- product-quality 보증이 아닌 smoke/review evidence로 남긴다.",
    "- 남은 리스크:",
    "",
  ].join("\n")
}

function existingWorkflowPaths(projectDir: string): readonly string[] {
  return [PLAN_PATH, IMPLEMENTATION_REPORT_PATH, REVIEW_REPORT_PATH].filter((path) => existsSync(join(projectDir, path)))
}

export function initializeWorkflowPlan(options: PlanOptions = {}, force = false): string {
  const projectDir = resolve(options.projectDir ?? process.cwd())
  const workflowDir = join(projectDir, ".persona", "workflow")
  const planPath = join(projectDir, PLAN_PATH)
  const implementationReportPath = join(projectDir, IMPLEMENTATION_REPORT_PATH)
  const reviewReportPath = join(projectDir, REVIEW_REPORT_PATH)

  const existingPaths = existingWorkflowPaths(projectDir)
  if (existingPaths.length > 0 && !force) {
    throw new PlanDraftError(`${existingPaths.join(", ")} already exists. Re-run with --force to replace the drafts.`)
  }

  mkdirSync(workflowDir, { recursive: true })
  writeFileSync(planPath, createPlanDraft(projectDir))
  writeFileSync(implementationReportPath, createImplementationReportTemplate(projectDir))
  writeFileSync(reviewReportPath, createReviewReportTemplate(projectDir))
  return planPath
}
