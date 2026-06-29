import { existsSync } from "node:fs"
import { join, resolve } from "node:path"
import process from "node:process"

const README_PATH = "README.md"
const PROJECT_PROFILE_PATH = ".persona/project-profile.jsonc"
const PLAN_PATH = ".persona/workflow/plan.md"
const POLICY_OVERLAY_PATH = ".persona/policies/overlay.jsonc"
const COMPANY_POLICY_PATH = ".persona/policies/company/backend.md"
const PERSONAL_POLICY_PATH = ".persona/policies/personal/backend.md"

function projectDirFor(projectDir?: string): string {
  return resolve(projectDir ?? process.cwd())
}

function hasFile(projectDir: string, relativePath: string): boolean {
  return existsSync(join(projectDir, relativePath))
}

function policyContextPaths(projectDir: string): readonly string[] {
  const existingPolicies = [POLICY_OVERLAY_PATH, COMPANY_POLICY_PATH, PERSONAL_POLICY_PATH].filter((relativePath) =>
    hasFile(projectDir, relativePath),
  )
  return existingPolicies.length > 0 ? existingPolicies : [POLICY_OVERLAY_PATH]
}

export function workflowRequiredContextLines(projectDir?: string): readonly string[] {
  const resolvedProjectDir = projectDirFor(projectDir)
  const readmeLine = hasFile(resolvedProjectDir, README_PATH)
    ? `- ${README_PATH}`
    : `- ${README_PATH}: missing; use workflow requirements/task cards instead`
  return [
    readmeLine,
    `- ${PROJECT_PROFILE_PATH}`,
    ...policyContextPaths(resolvedProjectDir).map((relativePath) => `- ${relativePath}`),
    `- ${PLAN_PATH}`,
    "- current workflow ticket/task card when backlog exists",
  ]
}

export function workflowRequiredActionLine(projectDir?: string): string {
  const resolvedProjectDir = projectDirFor(projectDir)
  const policies = policyContextPaths(resolvedProjectDir).join(", ")
  if (!hasFile(resolvedProjectDir, README_PATH)) {
    return `- README.md is missing; read ${PROJECT_PROFILE_PATH}, ${policies}, ${PLAN_PATH}, and the current workflow ticket/requirements source instead.`
  }
  return `- Read ${README_PATH}, ${PROJECT_PROFILE_PATH}, ${policies}, and ${PLAN_PATH}.`
}

export function workflowReadChunkLines(projectDir?: string): readonly string[] {
  const resolvedProjectDir = projectDirFor(projectDir)
  if (!hasFile(resolvedProjectDir, README_PATH)) {
    return [
      "README.md is missing; do not block implementation entry on README.",
      "Read `.persona/workflow/plan.md` and the current workflow ticket/task card through OS-safe bearshell chunks when tool output is truncated.",
      "Windows search scope: do not recurse project root or .persona root; search owned source roots only to avoid node_modules/package vendor matches.",
    ]
  }
  return [
    "Read README completely through OS-safe bearshell chunks:",
    "1. macOS/Linux line count: `npx ph bearshell --shell 'wc -l README.md'`",
    "2. macOS/Linux first chunk: `npx ph bearshell --shell 'sed -n \"1,220p\" README.md'`",
    "3. macOS/Linux next chunk: `npx ph bearshell --shell 'sed -n \"221,440p\" README.md'`.",
    "4. Windows PowerShell first chunk: `npx ph bearshell powershell -NoProfile -Command \"Get-Content README.md -TotalCount 220\"`",
    "5. Windows PowerShell next chunk: `npx ph bearshell powershell -NoProfile -Command \"Get-Content README.md | Select-Object -Skip 220 -First 220\"`.",
    "6. Continue 220-line ranges until README.md and plan are fully covered.",
    "7. Windows search: `npx ph bearshell powershell -NoProfile -Command \"Select-String -Path README.md -Pattern TODO\"`.",
    "8. Windows search scope: do not recurse project root or .persona root; search README.md or owned source roots only to avoid node_modules/package vendor matches.",
    "9. Record README ranges read in `.persona/workflow/implementation-report.md`.",
  ]
}

export function workflowImplementationContextSentence(projectDir?: string): string {
  const resolvedProjectDir = projectDirFor(projectDir)
  const policies = policyContextPaths(resolvedProjectDir).join(", ")
  if (!hasFile(resolvedProjectDir, README_PATH)) {
    return `구현을 시작하기 전에 \`npx ph workflow implement\`를 먼저 실행하고, README.md가 없으면 ${PROJECT_PROFILE_PATH}, ${policies}, ${PLAN_PATH}, current workflow ticket/task card를 읽은 뒤 accepted plan 기준으로 구현해줘.`
  }
  return `구현을 시작하기 전에 \`npx ph workflow implement\`를 먼저 실행하고, 그 단일 레일에 따라 README.md, ${PROJECT_PROFILE_PATH}, ${policies}, ${PLAN_PATH}를 읽은 뒤 accepted plan 기준으로 구현해줘.`
}
