import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs"
import { join, sep } from "node:path"

import { isRecord, stripJsonComments } from "../config/jsonc.js"
import { sha256Bytes, sha256Text } from "./init-manifest.js"
import type { InitPackageBinding } from "./init-manifest.js"
import type { InitTarget } from "./init-transaction.js"
import { InitManifestError } from "./init-manifest.js"

export const OPENCODE_CONFIG_PATH = ".opencode/opencode.json"

const PROJECT_NOISE_IGNORE_ENTRIES = [
  "node_modules/",
  ".opencode/node_modules/",
  ".persona/rules/",
  ".persona/evidence/",
  ".persona/.init-backups/",
  ".gradle/",
  "build/",
] as const

const PUBLIC_INIT_EXCLUDED_RULES = new Set([
  "backend/step1-api-contract.md",
  "backend/step2-3-api-contract.md",
])
const LEGACY_DIFF_RULES_DIR = "diff-rules"

export function isMissing(path: string): boolean {
  try {
    lstatSync(path)
    return false
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return true
    }
    throw error
  }
}

export function ensureRegularOrMissing(path: string, label: string): void {
  if (isMissing(path)) {
    return
  }
  const stat = lstatSync(path)
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new InitManifestError(`${label} is not a regular file.`)
  }
}

export function readOpencodeConfig(configPath: string): Record<string, unknown> {
  ensureRegularOrMissing(configPath, OPENCODE_CONFIG_PATH)
  if (isMissing(configPath)) {
    return {}
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(stripJsonComments(readFileSync(configPath, "utf8")))
  } catch {
    throw new InitManifestError(`Failed to parse ${OPENCODE_CONFIG_PATH}; no files were changed.`)
  }
  if (!isRecord(parsed)) {
    throw new InitManifestError(`${OPENCODE_CONFIG_PATH} must contain a JSON object; no files were changed.`)
  }
  if (
    parsed.plugin !== undefined
    && typeof parsed.plugin !== "string"
    && !Array.isArray(parsed.plugin)
  ) {
    throw new InitManifestError(`${OPENCODE_CONFIG_PATH} has an ambiguous plugin value; no files were changed.`)
  }
  return { ...parsed }
}

export function mergePluginPath(config: Record<string, unknown>, pluginPath: string): Record<string, unknown> {
  const plugin = config.plugin
  const existingPlugins =
    typeof plugin === "string"
      ? [plugin]
      : Array.isArray(plugin)
        ? plugin.filter((entry): entry is string => typeof entry === "string")
        : []
  return {
    ...config,
    plugin: existingPlugins.includes(pluginPath) ? existingPlugins : [...existingPlugins, pluginPath],
  }
}

export function buildProjectNoiseIgnore(projectDir: string): Buffer {
  const gitignorePath = join(projectDir, ".gitignore")
  ensureRegularOrMissing(gitignorePath, ".gitignore")
  const existing = isMissing(gitignorePath) ? "" : readFileSync(gitignorePath, "utf8")
  const existingLines = new Set(existing.split(/\r?\n/).map((line) => line.trim()))
  const missingEntries = PROJECT_NOISE_IGNORE_ENTRIES.filter((entry) => !existingLines.has(entry))
  if (missingEntries.length === 0) {
    return Buffer.from(existing, "utf8")
  }
  const prefix = existing.length > 0 && !existing.endsWith("\n") ? "\n" : ""
  const sectionHeader = existingLines.has("# Persona Harness generated context noise")
    ? []
    : ["# Persona Harness generated context noise"]
  return Buffer.from(`${existing}${prefix}${[...sectionHeader, ...missingEntries].join("\n")}\n`, "utf8")
}

function normalizeTemplateRelativePath(sourcePath: string, sourceRoot: string): string {
  return sourcePath === sourceRoot ? "" : sourcePath.slice(sourceRoot.length + sep.length).replace(/\\/g, "/")
}

function shouldCopyPublicRuleTemplate(sourcePath: string, sourceRulesDir: string): boolean {
  const relativePath = normalizeTemplateRelativePath(sourcePath, sourceRulesDir)
  const isLegacyDiffRule = relativePath === LEGACY_DIFF_RULES_DIR || relativePath.startsWith(`${LEGACY_DIFF_RULES_DIR}/`)
  return relativePath === "" || (!isLegacyDiffRule && !PUBLIC_INIT_EXCLUDED_RULES.has(relativePath))
}

function listTemplateFiles(root: string, predicate: (path: string) => boolean = () => true): readonly string[] {
  if (isMissing(root)) {
    return []
  }
  const stat = lstatSync(root)
  if (stat.isSymbolicLink()) {
    throw new InitManifestError(`Init template contains a symbolic link: ${root}`)
  }
  if (!stat.isDirectory()) {
    throw new InitManifestError(`Init template root is not a directory: ${root}`)
  }
  const files: string[] = []
  const pending = [root]
  while (pending.length > 0) {
    const current = pending.pop()
    if (current === undefined) {
      continue
    }
    for (const entry of readdirSync(current).sort()) {
      const path = join(current, entry)
      const entryStat = lstatSync(path)
      if (entryStat.isSymbolicLink()) {
        throw new InitManifestError(`Init template contains a symbolic link: ${path}`)
      }
      if (entryStat.isDirectory()) {
        pending.push(path)
      } else if (entryStat.isFile() && predicate(path)) {
        files.push(path)
      } else if (!entryStat.isFile()) {
        throw new InitManifestError(`Init template contains an unsupported entry: ${path}`)
      }
    }
  }
  return files.sort()
}

export function profileDigest(projectDir: string): string | null {
  const profilePath = join(projectDir, ".persona", "project-profile.jsonc")
  if (isMissing(profilePath)) {
    return null
  }
  ensureRegularOrMissing(profilePath, ".persona/project-profile.jsonc")
  return sha256Bytes(readFileSync(profilePath))
}

export function packageBinding(packageRoot: string, templateDigest: string): InitPackageBinding {
  const packagePath = join(packageRoot, "package.json")
  ensureRegularOrMissing(packagePath, "package.json")
  if (isMissing(packagePath)) {
    throw new InitManifestError("Package binding is unavailable; no files were changed.")
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(packagePath, "utf8"))
  } catch {
    throw new InitManifestError("Package binding is malformed; no files were changed.")
  }
  if (!isRecord(parsed) || parsed.name !== "persona-harness" || typeof parsed.version !== "string") {
    throw new InitManifestError("Package binding does not identify Persona Harness; no files were changed.")
  }
  return { name: parsed.name, version: parsed.version, templateDigest }
}

export function sourceTemplateDigest(targets: readonly InitTarget[]): string {
  const sourceFiles = targets
    .filter(({ relativePath }) => relativePath.startsWith(".persona/"))
    .map(({ relativePath, nextBytes }) => ({ path: relativePath, digest: sha256Bytes(nextBytes) }))
  return sha256Text(JSON.stringify(sourceFiles))
}

export function buildTargets(projectDir: string, packageRoot: string, pluginPath: string): readonly InitTarget[] {
  const sourcePersonaDir = join(packageRoot, ".persona")
  const sourceHarnessConfig = join(sourcePersonaDir, "harness.jsonc")
  const sourceConventionsDir = join(sourcePersonaDir, "conventions")
  const sourceRulesDir = join(sourcePersonaDir, "rules")
  if (isMissing(sourceHarnessConfig)) {
    throw new InitManifestError(`Missing template: ${sourceHarnessConfig}`)
  }
  if (isMissing(sourceRulesDir)) {
    throw new InitManifestError(`Missing template: ${sourceRulesDir}`)
  }
  const targets: InitTarget[] = [
    { relativePath: ".persona/harness.jsonc", nextBytes: readFileSync(sourceHarnessConfig) },
  ]
  if (!isMissing(sourceConventionsDir)) {
    for (const sourcePath of listTemplateFiles(sourceConventionsDir)) {
      const relativePath = normalizeTemplateRelativePath(sourcePath, sourceConventionsDir)
      targets.push({ relativePath: `.persona/conventions/${relativePath}`, nextBytes: readFileSync(sourcePath) })
    }
  }
  for (const sourcePath of listTemplateFiles(sourceRulesDir, (path) => shouldCopyPublicRuleTemplate(path, sourceRulesDir))) {
    const relativePath = normalizeTemplateRelativePath(sourcePath, sourceRulesDir)
    targets.push({ relativePath: `.persona/rules/${relativePath}`, nextBytes: readFileSync(sourcePath) })
  }
  const opencodePath = join(projectDir, OPENCODE_CONFIG_PATH)
  const mergedConfig = mergePluginPath(readOpencodeConfig(opencodePath), pluginPath)
  targets.push({
    relativePath: OPENCODE_CONFIG_PATH,
    nextBytes: Buffer.from(`${JSON.stringify(mergedConfig, null, 2)}\n`, "utf8"),
  })
  targets.push({ relativePath: ".gitignore", nextBytes: buildProjectNoiseIgnore(projectDir) })
  return targets.sort((left, right) => left.relativePath.localeCompare(right.relativePath))
}
