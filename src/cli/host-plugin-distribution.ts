import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  type Stats,
} from "node:fs"
import { dirname, join, relative, resolve, sep } from "node:path"

import {
  HOST_SKILL_LAYOUTS,
  buildHostSkillAdapterTargets,
} from "./host-skill-materializer.js"
import { listPersonaSharedSkillsFromPackageRoot, type PersonaSharedSkill } from "../runtime/persona-shared-skill-catalog.js"

const PACKAGE_NAME = "persona-harness"
const HOST_PLUGIN_ROOT = "packages/host-plugins"
const REPOSITORY_URL = "https://github.com/jyt6640/persona-harness"

export const HOST_PLUGIN_HOSTS = ["antigravity", "codex", "claude"] as const

export type HostPluginHost = typeof HOST_PLUGIN_HOSTS[number]

export type HostPluginDistributionTarget = {
  readonly nextBytes: Buffer
  readonly relativePath: string
}

export type HostPluginDistributionPaths = {
  readonly antigravityPluginRoot: string
  readonly claudePluginRoot: string
  readonly codexMarketplaceRoot: string
}

export type HostPluginWriteOptions = {
  readonly replace?: boolean
}

type PackageIdentity = {
  readonly name: typeof PACKAGE_NAME
  readonly version: string
}

type HostPluginLayout = {
  readonly host: HostPluginHost
  readonly sourceLayout: "agents" | "claude"
  readonly skillRoot: string
}

const HOST_PLUGIN_LAYOUTS = [
  {
    host: "antigravity",
    sourceLayout: "agents",
    skillRoot: "packages/host-plugins/antigravity/skills",
  },
  {
    host: "codex",
    sourceLayout: "agents",
    skillRoot: "packages/host-plugins/codex/plugins/persona-harness/skills",
  },
  {
    host: "claude",
    sourceLayout: "claude",
    skillRoot: "packages/host-plugins/claude/skills",
  },
] as const satisfies readonly HostPluginLayout[]

export class HostPluginDistributionError extends Error {
  constructor(readonly code: string) {
    super(code)
    this.name = "HostPluginDistributionError"
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function safeStat(path: string, code: string): Stats {
  try {
    return lstatSync(path)
  } catch {
    throw new HostPluginDistributionError(code)
  }
}

function packageRootPath(packageRoot: string): string {
  const root = resolve(packageRoot)
  const stat = safeStat(root, "host-plugin-distribution-package-root")
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new HostPluginDistributionError("host-plugin-distribution-package-root")
  }
  return root
}

function packagePath(root: string, relativePath: string): string {
  const path = resolve(root, relativePath)
  const escaped = relative(root, path)
  if (escaped === ".." || escaped.startsWith(`..${sep}`) || escaped.startsWith(sep)) {
    throw new HostPluginDistributionError("host-plugin-distribution-path")
  }
  return path
}

function assertNoFollowSegments(root: string, relativePath: string, allowMissing: boolean): void {
  let current = root
  for (const segment of relativePath.split("/")) {
    current = join(current, segment)
    if (!existsSync(current)) {
      if (allowMissing) return
      throw new HostPluginDistributionError("host-plugin-distribution-missing")
    }
    const stat = safeStat(current, "host-plugin-distribution-path")
    if (stat.isSymbolicLink()) {
      throw new HostPluginDistributionError("host-plugin-distribution-symlink")
    }
  }
}

function readPackageIdentity(root: string): PackageIdentity {
  const relativePath = "package.json"
  assertNoFollowSegments(root, relativePath, false)
  const path = packagePath(root, relativePath)
  const stat = safeStat(path, "host-plugin-distribution-package")
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new HostPluginDistributionError("host-plugin-distribution-package")
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"))
  } catch {
    throw new HostPluginDistributionError("host-plugin-distribution-package")
  }
  if (!isRecord(parsed) || parsed.name !== PACKAGE_NAME || typeof parsed.version !== "string" || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u.test(parsed.version)) {
    throw new HostPluginDistributionError("host-plugin-distribution-package")
  }
  return { name: PACKAGE_NAME, version: parsed.version }
}

function serializeJson(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function hostAdapterBytes(
  packageRoot: string,
  skills: readonly PersonaSharedSkill[],
  sourceLayout: HostPluginLayout["sourceLayout"],
): ReadonlyMap<string, Buffer> {
  const layout = HOST_SKILL_LAYOUTS.find((candidate) => candidate.id === sourceLayout)
  if (layout === undefined) throw new HostPluginDistributionError("host-plugin-distribution-layout")
  const adapters = buildHostSkillAdapterTargets(packageRoot)
  const bySkill = new Map<string, Buffer>()
  for (const skill of skills) {
    const expectedPath = `${layout.root}/${layout.namePrefix}-${skill.id}/SKILL.md`
    const adapter = adapters.find((candidate) => candidate.relativePath === expectedPath)
    if (adapter === undefined || bySkill.has(skill.id)) {
      throw new HostPluginDistributionError("host-plugin-distribution-canonical-binding")
    }
    bySkill.set(skill.id, adapter.nextBytes)
  }
  return bySkill
}

function codexPluginManifest(identity: PackageIdentity): Buffer {
  return serializeJson({
    name: PACKAGE_NAME,
    version: identity.version,
    description: "Portable Persona Harness shared skills for Codex.",
    author: {
      name: "Persona Harness",
      url: REPOSITORY_URL,
    },
    homepage: `${REPOSITORY_URL}#portable-host-adapters`,
    repository: REPOSITORY_URL,
    license: "Apache-2.0",
    keywords: ["ai-coding", "codex", "persona-harness", "skills"],
    skills: "./skills/",
    interface: {
      displayName: "Persona Harness",
      shortDescription: "Portable engineering skills for Codex.",
      longDescription: "A versioned, canonical Persona Harness skill catalog for Codex project workflows.",
      developerName: "Persona Harness",
      category: "Productivity",
      capabilities: ["Skills"],
      websiteURL: REPOSITORY_URL,
    },
  })
}

function codexMarketplaceManifest(): Buffer {
  return serializeJson({
    name: PACKAGE_NAME,
    interface: {
      displayName: "Persona Harness",
    },
    plugins: [
      {
        name: PACKAGE_NAME,
        source: {
          source: "local",
          path: "./plugins/persona-harness",
        },
        policy: {
          installation: "AVAILABLE",
          authentication: "ON_INSTALL",
        },
        category: "Productivity",
      },
    ],
  })
}

function antigravityPluginManifest(): Buffer {
  return serializeJson({
    $schema: "https://antigravity.google/schemas/v1/plugin.json",
    name: PACKAGE_NAME,
    description: "Portable Persona Harness shared skills for Antigravity.",
  })
}

function claudePluginManifest(identity: PackageIdentity): Buffer {
  return serializeJson({
    $schema: "https://json.schemastore.org/claude-code-plugin-manifest.json",
    name: PACKAGE_NAME,
    version: identity.version,
    description: "Portable Persona Harness shared skills for Claude Code.",
    author: {
      name: "Persona Harness",
      url: REPOSITORY_URL,
    },
    homepage: `${REPOSITORY_URL}#portable-host-adapters`,
    repository: REPOSITORY_URL,
    license: "Apache-2.0",
    keywords: ["ai-coding", "claude-code", "persona-harness", "skills"],
  })
}

function pluginManifestPath(host: HostPluginHost): string {
  switch (host) {
    case "antigravity":
      return "packages/host-plugins/antigravity/plugin.json"
    case "codex":
      return "packages/host-plugins/codex/plugins/persona-harness/.codex-plugin/plugin.json"
    case "claude":
      return "packages/host-plugins/claude/.claude-plugin/plugin.json"
  }
}

function pluginSkillPath(layout: HostPluginLayout, skill: PersonaSharedSkill): string {
  return `${layout.skillRoot}/${skill.id}/SKILL.md`
}

export function buildHostPluginDistributionTargets(packageRoot: string): readonly HostPluginDistributionTarget[] {
  const root = packageRootPath(packageRoot)
  const identity = readPackageIdentity(root)
  let skills: readonly PersonaSharedSkill[]
  try {
    skills = listPersonaSharedSkillsFromPackageRoot(root)
  } catch {
    throw new HostPluginDistributionError("host-plugin-distribution-catalog")
  }
  const uniqueSkills = new Set(skills.map((skill) => skill.id))
  if (uniqueSkills.size !== skills.length || skills.length === 0) {
    throw new HostPluginDistributionError("host-plugin-distribution-catalog")
  }

  const targets: HostPluginDistributionTarget[] = [
    {
      relativePath: pluginManifestPath("antigravity"),
      nextBytes: antigravityPluginManifest(),
    },
    {
      relativePath: "packages/host-plugins/codex/.agents/plugins/marketplace.json",
      nextBytes: codexMarketplaceManifest(),
    },
    {
      relativePath: pluginManifestPath("codex"),
      nextBytes: codexPluginManifest(identity),
    },
    {
      relativePath: pluginManifestPath("claude"),
      nextBytes: claudePluginManifest(identity),
    },
  ]

  for (const layout of HOST_PLUGIN_LAYOUTS) {
    const adapters = hostAdapterBytes(root, skills, layout.sourceLayout)
    for (const skill of skills) {
      const adapter = adapters.get(skill.id)
      if (adapter === undefined) {
        throw new HostPluginDistributionError("host-plugin-distribution-canonical-binding")
      }
      targets.push({ relativePath: pluginSkillPath(layout, skill), nextBytes: adapter })
    }
  }

  const paths = new Set<string>()
  for (const target of targets) {
    if (!target.relativePath.startsWith(`${HOST_PLUGIN_ROOT}/`) || paths.has(target.relativePath)) {
      throw new HostPluginDistributionError("host-plugin-distribution-targets")
    }
    paths.add(target.relativePath)
  }
  return targets.sort((left, right) => left.relativePath.localeCompare(right.relativePath))
}

function listArtifactFiles(root: string, current: string = root): readonly string[] {
  const entries = readdirSync(current, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))
  const files: string[] = []
  for (const entry of entries) {
    const path = join(current, entry.name)
    const stat = safeStat(path, "host-plugin-distribution-artifact")
    if (stat.isSymbolicLink()) {
      throw new HostPluginDistributionError("host-plugin-distribution-symlink")
    }
    if (stat.isDirectory()) {
      files.push(...listArtifactFiles(root, path))
      continue
    }
    if (!stat.isFile()) {
      throw new HostPluginDistributionError("host-plugin-distribution-artifact")
    }
    files.push(relative(root, path).replace(/\\/g, "/"))
  }
  return files
}

function assertExactArtifactTree(root: string, targets: readonly HostPluginDistributionTarget[]): void {
  const artifactRoot = packagePath(root, HOST_PLUGIN_ROOT)
  assertNoFollowSegments(root, HOST_PLUGIN_ROOT, false)
  const rootStat = safeStat(artifactRoot, "host-plugin-distribution-missing")
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new HostPluginDistributionError("host-plugin-distribution-missing")
  }
  const actual = new Set(listArtifactFiles(artifactRoot))
  const expected = new Set(targets.map((target) => target.relativePath.slice(`${HOST_PLUGIN_ROOT}/`.length)))
  if (actual.size !== expected.size || [...actual].some((path) => !expected.has(path))) {
    throw new HostPluginDistributionError("host-plugin-distribution-artifact-set")
  }
  for (const target of targets) {
    assertNoFollowSegments(root, target.relativePath, false)
    const path = packagePath(root, target.relativePath)
    const stat = safeStat(path, "host-plugin-distribution-missing")
    if (!stat.isFile() || stat.isSymbolicLink() || !readFileSync(path).equals(target.nextBytes)) {
      throw new HostPluginDistributionError("host-plugin-distribution-artifact")
    }
  }
}

function distributionPaths(root: string): HostPluginDistributionPaths {
  return {
    antigravityPluginRoot: packagePath(root, "packages/host-plugins/antigravity"),
    claudePluginRoot: packagePath(root, "packages/host-plugins/claude"),
    codexMarketplaceRoot: packagePath(root, "packages/host-plugins/codex"),
  }
}

export function verifyHostPluginDistribution(packageRoot: string): HostPluginDistributionPaths {
  const root = packageRootPath(packageRoot)
  assertExactArtifactTree(root, buildHostPluginDistributionTargets(root))
  return distributionPaths(root)
}

export function hostPluginDistributionPath(packageRoot: string, host: HostPluginHost): string {
  const paths = verifyHostPluginDistribution(packageRoot)
  switch (host) {
    case "antigravity":
      return paths.antigravityPluginRoot
    case "codex":
      return paths.codexMarketplaceRoot
    case "claude":
      return paths.claudePluginRoot
  }
}

export function writeHostPluginDistribution(packageRoot: string, options: HostPluginWriteOptions = {}): HostPluginDistributionPaths {
  const root = packageRootPath(packageRoot)
  const targets = buildHostPluginDistributionTargets(root)
  const artifactRoot = packagePath(root, HOST_PLUGIN_ROOT)

  if (existsSync(artifactRoot)) {
    if (options.replace !== true) {
      return verifyHostPluginDistribution(root)
    }
    assertNoFollowSegments(root, HOST_PLUGIN_ROOT, false)
    const stat = safeStat(artifactRoot, "host-plugin-distribution-artifact")
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new HostPluginDistributionError("host-plugin-distribution-artifact")
    }
    rmSync(artifactRoot, { force: true, recursive: true })
  } else {
    assertNoFollowSegments(root, "packages", false)
  }

  for (const target of targets) {
    const path = packagePath(root, target.relativePath)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, target.nextBytes, { mode: 0o644 })
  }
  return verifyHostPluginDistribution(root)
}
