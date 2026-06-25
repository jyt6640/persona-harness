import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import process from "node:process"

import { loadBackendPolicyOverlay } from "../config/policy-overlay.js"
import { loadBackendProjectProfileSummary, readBackendProjectProfileState } from "../config/project-profile.js"
import { createImplementationReportTemplate, createReviewReportTemplate } from "./workflow-templates.js"
import { createWorkflowRoleBoundaryTemplate, ROLE_BOUNDARY_PATH } from "./workflow-roles.js"

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
const EXISTING_CODE_SCAN_ROOTS = ["src/main/java", "src/test/java"] as const
const EXISTING_CODE_SCAN_LIMIT = 40

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

function collectJavaSourceFiles(projectDir: string): readonly string[] {
  const javaFiles: string[] = []
  const visit = (relativeDir: string): void => {
    if (javaFiles.length >= EXISTING_CODE_SCAN_LIMIT) {
      return
    }
    const absoluteDir = join(projectDir, relativeDir)
    if (!existsSync(absoluteDir)) {
      return
    }
    for (const entry of readdirSync(absoluteDir).sort()) {
      const relativePath = `${relativeDir}/${entry}`
      const absolutePath = join(projectDir, relativePath)
      const stat = statSync(absolutePath)
      if (stat.isDirectory()) {
        visit(relativePath)
        continue
      }
      if (stat.isFile() && entry.endsWith(".java")) {
        javaFiles.push(relativePath)
      }
    }
  }

  for (const root of EXISTING_CODE_SCAN_ROOTS) {
    visit(root)
  }
  return javaFiles
}

function packageNameFromJavaFile(projectDir: string, relativePath: string): string | undefined {
  const match = /^package\s+([^;]+);/m.exec(readFileSync(join(projectDir, relativePath), "utf8"))
  return match?.[1]?.trim()
}

function commonPackagePrefix(packages: readonly string[]): string | undefined {
  if (packages.length === 0) {
    return undefined
  }
  const segments = packages[0]?.split(".") ?? []
  let prefixLength = segments.length
  for (const packageName of packages.slice(1)) {
    const current = packageName.split(".")
    while (prefixLength > 0 && segments.slice(0, prefixLength).join(".") !== current.slice(0, prefixLength).join(".")) {
      prefixLength -= 1
    }
  }
  return prefixLength > 0 ? segments.slice(0, prefixLength).join(".") : undefined
}

function layerNamesFromJavaFiles(files: readonly string[]): readonly string[] {
  const layerCandidates = new Set<string>()
  for (const file of files) {
    for (const segment of file.split("/")) {
      if (/^(presentation|application|domain|infrastructure|controller|service|repository|dto|web|global|config|exception)$/i.test(segment)) {
        layerCandidates.add(segment)
      }
    }
  }
  return [...layerCandidates].sort()
}

function projectModeLines(projectDir: string): readonly string[] {
  const javaFiles = collectJavaSourceFiles(projectDir)
  if (javaFiles.length === 0) {
    return [
      "## Project Mode",
      "",
      "Mode: greenfield",
      "",
      "- Goal: create a consistent 0% -> 80% Java/Spring backend baseline for a new project.",
      "- Use the Java/Spring backend baseline package flow when README/profile do not define an existing convention.",
      "- Keep the baseline advisory: user requirements and explicit instructions still win.",
    ]
  }

  const packages = javaFiles
    .map((file) => packageNameFromJavaFile(projectDir, file))
    .filter((packageName): packageName is string => packageName !== undefined)
  const packageRoot = commonPackagePrefix(packages)
  const layers = layerNamesFromJavaFiles(javaFiles)
  return [
    "## Project Mode",
    "",
    "Mode: existing-code",
    "",
    `- Existing source files detected: ${javaFiles.length}`,
    packageRoot === undefined ? "- Existing package root: unknown" : `- Existing package root: ${packageRoot}`,
    layers.length === 0 ? "- Existing layer/style hints: none detected" : `- Existing layer/style hints: ${layers.join(", ")}`,
    "- existing code wins over greenfield guidance: follow current package, naming, layer, repository, DTO, and domain style before introducing the baseline structure.",
    "- If current code conflicts with profile guidance, record the conflict in this plan before implementation.",
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
    ...projectModeLines(projectDir),
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
    "- Read tool 출력이 잘리면 OS별로 안전한 `npx ph bearshell` line range를 나눠 끝까지 읽는다.",
    "- macOS/Linux: `npx ph bearshell --shell 'sed -n \"1,220p\" README.md'`.",
    "- Windows PowerShell: `npx ph bearshell powershell -NoProfile -Command \"Get-Content README.md -TotalCount 220\"`.",
    "- Windows search는 `npx ph bearshell powershell -NoProfile -Command \"Select-String -Path README.md -Pattern TODO\"` 형태를 사용한다.",
    "- Windows search scope: do not recurse project root or .persona root; search README.md or owned source roots only to avoid node_modules/package vendor matches.",
    "- 구현 후에는 Gradle test/build와 manual QA evidence를 별도 report에 남긴다.",
    "- 명령 실행이 필요하면 raw shell보다 `npx ph bearshell`을 우선 사용한다.",
    "",
  ].join("\n")
}

function existingWorkflowPaths(projectDir: string): readonly string[] {
  return [PLAN_PATH, IMPLEMENTATION_REPORT_PATH, REVIEW_REPORT_PATH, ROLE_BOUNDARY_PATH].filter((path) =>
    existsSync(join(projectDir, path)),
  )
}

export function initializeWorkflowPlan(options: PlanOptions = {}, force = false): string {
  const projectDir = resolve(options.projectDir ?? process.cwd())
  const profileState = readBackendProjectProfileState(projectDir)
  if (profileState.status !== "ready") {
    throw new PlanDraftError(
      [
        "Project profile is required before planning.",
        profileState.message,
        "Fast path: run `npx ph intake --default backend --force`.",
        "Custom path: run `npx ph intake --interactive --force`.",
      ].join("\n"),
    )
  }

  const workflowDir = join(projectDir, ".persona", "workflow")
  const planPath = join(projectDir, PLAN_PATH)
  const implementationReportPath = join(projectDir, IMPLEMENTATION_REPORT_PATH)
  const reviewReportPath = join(projectDir, REVIEW_REPORT_PATH)
  const roleBoundaryPath = join(projectDir, ROLE_BOUNDARY_PATH)

  const existingPaths = existingWorkflowPaths(projectDir)
  if (existingPaths.length > 0 && !force) {
    throw new PlanDraftError(`${existingPaths.join(", ")} already exists. Re-run with --force to replace the drafts.`)
  }

  mkdirSync(workflowDir, { recursive: true })
  writeFileSync(planPath, createPlanDraft(projectDir))
  const inputLines = readmeLines(projectDir)
  writeFileSync(implementationReportPath, createImplementationReportTemplate(inputLines))
  writeFileSync(reviewReportPath, createReviewReportTemplate(inputLines))
  writeFileSync(roleBoundaryPath, createWorkflowRoleBoundaryTemplate())
  return planPath
}
