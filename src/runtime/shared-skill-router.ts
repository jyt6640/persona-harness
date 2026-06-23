import type { FileRole } from "../runtime/types.js"

export const ACTIVE_SHARED_SKILL_NAMES = ["programming", "frontend"] as const

export const INACTIVE_VENDORED_SHARED_SKILL_NAMES = [
  "debugging",
  "visual-qa",
  "ast-grep",
  "git-master",
  "refactor",
  "review-work",
  "start-work",
  "ulw-plan",
  "ultraresearch",
  "init-deep",
  "remove-ai-slops",
  "lsp-setup",
] as const

export const REMOVED_SHARED_SKILL_NAMES = ["lcx-report-bug", "lcx-contribute-bug-fix", "lcx-doctor"] as const

export type SharedSkillDomain = "programming" | "frontend"

export type SharedSkillName = (typeof ACTIVE_SHARED_SKILL_NAMES)[number]

export type SelectedSharedSkill = {
  readonly name: SharedSkillName
  readonly domain: SharedSkillDomain
  readonly path: string
  readonly reason: string
}

const TYPESCRIPT_FILE_PATTERN = /\.(ts|tsx|mts|cts)$/i
const JAVA_FILE_PATTERN = /\.java$/i
const GRADLE_BUILD_FILE_PATTERN = /(^|\/)(build|settings)\.gradle(\.kts)?$/i
const REACT_FILE_PATTERN = /\.tsx$/i
const FRONTEND_PATH_PATTERN = /(^|\/)(app|components|frontend|pages|routes|ui|web)(\/|$)/i
const INFRA_FILE_PATTERN = /(^|\/)(Dockerfile|docker-compose\.ya?ml|.*\.(tf|tfvars|ya?ml))$/i

function normalizePath(targetFile: string): string {
  return targetFile.replace(/\\/g, "/")
}

function isTypeScriptTarget(normalizedPath: string): boolean {
  return TYPESCRIPT_FILE_PATTERN.test(normalizedPath)
}

function isJavaProgrammingTarget(normalizedPath: string): boolean {
  return JAVA_FILE_PATTERN.test(normalizedPath) || GRADLE_BUILD_FILE_PATTERN.test(normalizedPath)
}

function isGradleBuildFile(normalizedPath: string): boolean {
  return GRADLE_BUILD_FILE_PATTERN.test(normalizedPath)
}

function isFrontendTarget(normalizedPath: string): boolean {
  return REACT_FILE_PATTERN.test(normalizedPath) || FRONTEND_PATH_PATTERN.test(normalizedPath)
}

function isInfraTarget(normalizedPath: string): boolean {
  return INFRA_FILE_PATTERN.test(normalizedPath)
}

export function selectSharedSkillsForTarget(targetFile: string): readonly SelectedSharedSkill[] {
  const normalizedPath = normalizePath(targetFile)
  const selected: SelectedSharedSkill[] = []

  if (isTypeScriptTarget(normalizedPath) || isJavaProgrammingTarget(normalizedPath)) {
    selected.push({
      name: "programming",
      domain: "programming",
      path: "packages/shared-skills/skills/programming/SKILL.md",
      reason: isJavaProgrammingTarget(normalizedPath)
        ? isGradleBuildFile(normalizedPath)
          ? "Gradle Java build file detected; apply shared programming discipline."
          : "Java target detected; apply shared programming discipline."
        : "TypeScript target detected; apply shared programming discipline.",
    })
  }

  if (isTypeScriptTarget(normalizedPath) && isFrontendTarget(normalizedPath)) {
    selected.push({
      name: "frontend",
      domain: "frontend",
      path: "packages/shared-skills/skills/frontend/SKILL.md",
      reason: "React/frontend TypeScript target detected; apply frontend guidance as an overlay.",
    })
  }

  if (isInfraTarget(normalizedPath)) {
    return selected
  }

  return selected
}

export function resolveSharedSkillFileRole(selectedSkills: readonly SelectedSharedSkill[], targetFile = ""): FileRole {
  const normalizedPath = normalizePath(targetFile)

  if (isInfraTarget(normalizedPath)) {
    return "infra"
  }
  if (selectedSkills.some((skill) => skill.domain === "frontend")) {
    return "frontend"
  }
  if (isJavaProgrammingTarget(normalizedPath)) {
    return "java-common"
  }
  if (selectedSkills.some((skill) => skill.domain === "programming")) {
    return "typescript"
  }
  return "shared-skill"
}
