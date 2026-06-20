import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import process from "node:process"

import type { CliRunResult } from "./bearshell.js"
import { loadBackendProjectProfileSummary } from "../phase0/project-profile.js"

type PlanOptions = {
  readonly projectDir?: string
}

type ParsedPlanArgs =
  | { readonly kind: "run"; readonly force: boolean }
  | { readonly kind: "help" }
  | { readonly kind: "invalid"; readonly message: string }

class PlanDraftError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PlanDraftError"
  }
}

const PLAN_PATH = ".persona/workflow/plan.md"
const README_PATH = "README.md"

export function planUsage(invocation = "ph"): string {
  return [
    `Usage: ${invocation} plan [--force]`,
    "",
    "Creates a blackbear architecture plan draft before implementation.",
    "",
    "Output:",
    `- ${PLAN_PATH}`,
    "",
    "Scope:",
    "- Java/Spring backend Clean Code planning surface",
    "- Uses README and backend project profile as planning context",
    "- No rule enforcement",
    "- No autonomous implementation",
  ].join("\n")
}

function parsePlanArgs(args: readonly string[]): ParsedPlanArgs {
  let force = false

  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      return { kind: "help" }
    }
    if (arg === "--force") {
      force = true
      continue
    }
    return { kind: "invalid", message: `Unknown option: ${arg}` }
  }

  return { kind: "run", force }
}

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

function readmeLines(projectDir: string): readonly string[] {
  const heading = readReadmeHeading(projectDir)
  return [
    `Requirements source: \`${README_PATH}\``,
    heading === undefined ? "README status: missing" : `README heading: ${heading}`,
  ]
}

function createPlanDraft(projectDir: string): string {
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
    "- 구현 후에는 Gradle test/build와 manual QA evidence를 별도 report에 남긴다.",
    "",
  ].join("\n")
}

export function initializeWorkflowPlan(options: PlanOptions = {}, force = false): string {
  const projectDir = resolve(options.projectDir ?? process.cwd())
  const workflowDir = join(projectDir, ".persona", "workflow")
  const planPath = join(projectDir, PLAN_PATH)

  if (existsSync(planPath) && !force) {
    throw new PlanDraftError(`${PLAN_PATH} already exists. Re-run with --force to replace the draft.`)
  }

  mkdirSync(workflowDir, { recursive: true })
  writeFileSync(planPath, createPlanDraft(projectDir))
  return planPath
}

export function runPlanCommand(args: readonly string[], options: PlanOptions = {}, invocationName = "ph"): CliRunResult {
  const parsed = parsePlanArgs(args)

  if (parsed.kind === "help") {
    return { status: 0, stdout: `${planUsage(invocationName)}\n`, stderr: "" }
  }

  if (parsed.kind === "invalid") {
    return { status: 1, stdout: "", stderr: `${parsed.message}\n\n${planUsage(invocationName)}\n` }
  }

  try {
    const planPath = initializeWorkflowPlan(options, parsed.force)
    return {
      status: 0,
      stdout: [
        "Persona Harness blackbear plan draft created.",
        "",
        `Plan: ${planPath}`,
        "",
        "Next:",
        `- Review and complete ${PLAN_PATH} before implementation.`,
        "- Keep implementation, review, and QA evidence in separate workflow artifacts.",
      ].join("\n") + "\n",
      stderr: "",
    }
  } catch (error) {
    if (error instanceof PlanDraftError) {
      return { status: 1, stdout: "", stderr: `${error.message}\n` }
    }
    throw error
  }
}
