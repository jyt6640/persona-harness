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
const REACT_FILE_PATTERN = /\.tsx$/i
const FRONTEND_PATH_PATTERN = /(^|\/)(app|components|frontend|pages|routes|ui|web)(\/|$)/i
const INFRA_FILE_PATTERN = /(^|\/)(Dockerfile|docker-compose\.ya?ml|.*\.(tf|tfvars|ya?ml))$/i

function normalizePath(targetFile: string): string {
  return targetFile.replace(/\\/g, "/")
}

function isTypeScriptTarget(normalizedPath: string): boolean {
  return TYPESCRIPT_FILE_PATTERN.test(normalizedPath)
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

  if (isTypeScriptTarget(normalizedPath)) {
    selected.push({
      name: "programming",
      domain: "programming",
      path: "packages/shared-skills/skills/programming/SKILL.md",
      reason: "TypeScript target detected; apply shared programming discipline.",
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

export function resolveSharedSkillFileRole(selectedSkills: readonly SelectedSharedSkill[]): "typescript" | "frontend" | "shared-skill" {
  if (selectedSkills.some((skill) => skill.domain === "frontend")) {
    return "frontend"
  }
  if (selectedSkills.some((skill) => skill.domain === "programming")) {
    return "typescript"
  }
  return "shared-skill"
}
