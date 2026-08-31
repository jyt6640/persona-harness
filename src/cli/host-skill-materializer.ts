import { lstatSync, readFileSync, type Stats } from "node:fs"
import { join, relative, resolve, sep } from "node:path"

import {
  listPersonaSharedSkillsFromPackageRoot,
  type PersonaSharedSkill,
} from "../runtime/persona-shared-skill-catalog.js"
import { InitManifestError } from "./init-manifest.js"
import type { InitTarget } from "./init-transaction.js"

export type HostSkillLayout = {
  readonly id: "agents" | "claude" | "opencode"
  readonly namePrefix: string
  readonly openCodeAutoinvoke: boolean
  readonly root: string
}

export const HOST_SKILL_LAYOUTS = [
  {
    id: "agents",
    namePrefix: "persona-harness",
    openCodeAutoinvoke: false,
    root: ".agents/skills",
  },
  {
    id: "claude",
    namePrefix: "persona-harness-claude",
    openCodeAutoinvoke: false,
    root: ".claude/skills",
  },
  {
    id: "opencode",
    namePrefix: "persona-harness-opencode",
    openCodeAutoinvoke: true,
    root: ".opencode/skills",
  },
] as const satisfies readonly HostSkillLayout[]

const HOST_SKILL_ROOTS = HOST_SKILL_LAYOUTS.map((layout) => `${layout.root}/`)
const SHARED_SKILLS_ROOT = "packages/shared-skills"

type CanonicalSkillSource = {
  readonly body: string
  readonly description: string
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function sourceStat(path: string): Stats {
  try {
    return lstatSync(path)
  } catch {
    throw new InitManifestError("Persona shared-skill source is unavailable; no files were changed.")
  }
}

function assertSafeSourceFile(packageRoot: string, relativePath: string): string {
  const root = resolve(packageRoot)
  const path = resolve(root, relativePath)
  const escaped = relative(root, path)
  if (escaped === ".." || escaped.startsWith(`..${sep}`) || escaped.startsWith(sep)) {
    throw new InitManifestError("Persona shared-skill source escapes the package root; no files were changed.")
  }
  const rootStat = sourceStat(root)
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new InitManifestError("Persona shared-skill package root is unsafe; no files were changed.")
  }
  const segments = relativePath.split("/")
  let current = root
  for (const [index, segment] of segments.entries()) {
    current = join(current, segment)
    const stat = sourceStat(current)
    if (stat.isSymbolicLink()) {
      throw new InitManifestError("Persona shared-skill source contains a symbolic link; no files were changed.")
    }
    if (index < segments.length - 1 && !stat.isDirectory()) {
      throw new InitManifestError("Persona shared-skill source parent is invalid; no files were changed.")
    }
    if (index === segments.length - 1 && !stat.isFile()) {
      throw new InitManifestError("Persona shared-skill source is not a regular file; no files were changed.")
    }
  }
  return path
}

function readPackageVersion(packageRoot: string): string {
  const source = readFileSync(assertSafeSourceFile(packageRoot, "package.json"), "utf8")
  let parsed: unknown
  try {
    parsed = JSON.parse(source)
  } catch {
    throw new InitManifestError("Persona shared-skill package binding is malformed; no files were changed.")
  }
  if (!isRecord(parsed) || parsed.name !== "persona-harness" || typeof parsed.version !== "string") {
    throw new InitManifestError("Persona shared-skill package binding is unavailable; no files were changed.")
  }
  return parsed.version
}

function readCanonicalSkillSource(packageRoot: string, skill: PersonaSharedSkill): CanonicalSkillSource {
  const source = readFileSync(assertSafeSourceFile(packageRoot, `${SHARED_SKILLS_ROOT}/${skill.entry}`), "utf8")
  if (!source.startsWith("---\n")) {
    throw new InitManifestError("Persona shared-skill source front matter is malformed; no files were changed.")
  }
  const closing = source.indexOf("\n---\n", 4)
  if (closing < 4) {
    throw new InitManifestError("Persona shared-skill source front matter is malformed; no files were changed.")
  }
  const frontMatter = source.slice(4, closing)
  const descriptionLine = frontMatter.split("\n").find((line) => line.startsWith("description: "))
  const description = descriptionLine?.slice("description: ".length).trim()
  const body = source.slice(closing + "\n---\n".length).trim()
  if (description === undefined || description.length === 0 || body.length === 0) {
    throw new InitManifestError("Persona shared-skill source metadata is incomplete; no files were changed.")
  }
  return { body, description }
}

function renderHostSkillAdapter(
  layout: HostSkillLayout,
  skill: PersonaSharedSkill,
  source: CanonicalSkillSource,
  packageVersion: string,
): Buffer {
  const name = `${layout.namePrefix}-${skill.id}`
  return Buffer.from([
    "---",
    `name: ${name}`,
    `description: ${JSON.stringify(source.description)}`,
    'license: "Apache-2.0"',
    `compatibility: ${JSON.stringify(layout.id === "agents" ? "Codex and Antigravity" : layout.id === "claude" ? "Claude Code" : "OpenCode")}`,
    "metadata:",
    `  persona-harness/canonical-skill: ${skill.id}`,
    `  persona-harness/adapter-layout: ${layout.id}`,
    `  persona-harness/adapter-version: ${packageVersion}`,
    `  opencode/autoinvoke: \"${layout.openCodeAutoinvoke ? "true" : "false"}\"`,
    "---",
    "",
    `# Persona Harness Adapter: ${skill.title}`,
    "",
    "This adapter exposes the canonical Persona Harness skill to this host only. Discovery alone does not authorize workflow, shell, network, GitHub, authority, evidence, or external actions.",
    "",
    source.body,
    "",
  ].join("\n"), "utf8")
}

export function isHostSkillAdapterTarget(relativePath: string): boolean {
  return HOST_SKILL_ROOTS.some((root) => relativePath.startsWith(root))
}

export function buildHostSkillAdapterTargets(packageRoot: string): readonly InitTarget[] {
  assertSafeSourceFile(packageRoot, `${SHARED_SKILLS_ROOT}/catalog.json`)
  const packageVersion = readPackageVersion(packageRoot)
  let skills: readonly PersonaSharedSkill[]
  try {
    skills = listPersonaSharedSkillsFromPackageRoot(packageRoot)
  } catch {
    throw new InitManifestError("Persona shared-skill catalog is unavailable; no files were changed.")
  }
  const targets: InitTarget[] = []
  for (const layout of HOST_SKILL_LAYOUTS) {
    for (const skill of skills) {
      const source = readCanonicalSkillSource(packageRoot, skill)
      const name = `${layout.namePrefix}-${skill.id}`
      targets.push({
        relativePath: `${layout.root}/${name}/SKILL.md`,
        nextBytes: renderHostSkillAdapter(layout, skill, source, packageVersion),
      })
    }
  }
  return targets.sort((left, right) => left.relativePath.localeCompare(right.relativePath))
}
