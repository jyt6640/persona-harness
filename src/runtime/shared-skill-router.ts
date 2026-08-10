import type { FileRole } from "../runtime/types.js"
import {
  PERSONA_OPTIONAL_SKILL_IDS,
  personaSharedSkillPath,
  type PersonaSharedSkillId,
} from "./persona-shared-skill-catalog.js"

export const ACTIVE_SHARED_SKILL_NAMES = ["programming"] as const

export const OPTIONAL_SHARED_SKILL_NAMES = PERSONA_OPTIONAL_SKILL_IDS

export const REMOVED_SHARED_SKILL_NAMES = [
  "advanced/superpowers-driver",
  "debugging",
  "git-master",
  "init-deep",
  "remove-ai-slops",
  "review-work",
  "start-work",
  "ultraresearch",
  "ulw-plan",
] as const

export type SharedSkillDomain = "programming"

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

function selectProgrammingSkill(reason: string): SelectedSharedSkill {
  const skillId: PersonaSharedSkillId = "programming"
  return {
    name: skillId,
    domain: "programming",
    path: personaSharedSkillPath(skillId),
    reason,
  }
}

export function selectSharedSkillsForTarget(targetFile: string): readonly SelectedSharedSkill[] {
  const normalizedPath = normalizePath(targetFile)

  if (isInfraTarget(normalizedPath)) {
    return []
  }
  if (isJavaProgrammingTarget(normalizedPath)) {
    return [
      selectProgrammingSkill(
        isGradleBuildFile(normalizedPath)
          ? "Gradle Java build file detected; apply the Persona programming discipline."
          : "Java target detected; apply the Persona programming discipline.",
      ),
    ]
  }
  if (isTypeScriptTarget(normalizedPath)) {
    return [selectProgrammingSkill("TypeScript target detected; apply the Persona programming discipline.")]
  }
  return []
}

export function resolveSharedSkillFileRole(selectedSkills: readonly SelectedSharedSkill[], targetFile = ""): FileRole {
  const normalizedPath = normalizePath(targetFile)

  if (isInfraTarget(normalizedPath)) {
    return "infra"
  }
  if (isFrontendTarget(normalizedPath)) {
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
