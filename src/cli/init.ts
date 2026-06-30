#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { dirname, isAbsolute, join, resolve, sep } from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

import { isRecord, stripJsonComments } from "../config/jsonc.js"
import { formatInitResult } from "./init-output.js"

export { formatInitNonInteractiveInterviewMessage, formatInitResult } from "./init-output.js"

type InitOptions = {
  readonly projectDir?: string
  readonly packageRoot?: string
}

export type InitResult = {
  readonly projectDir: string
  readonly packageRoot: string
  readonly pluginPath: string
  readonly installed: readonly string[]
  readonly backups: readonly string[]
  readonly evidenceCopied: false
}

export function initUsage(invocationName: string): string {
  return [
    `Usage: ${invocationName} init`,
    "",
    "Install Persona Harness config/rules and OpenCode plugin config.",
    "",
    "Creates:",
    "- .persona/harness.jsonc",
    "- .persona/conventions/",
    "- .persona/rules/",
    "- .opencode/opencode.json",
    "- .gitignore entries for generated/vendor context noise",
    "",
    "Does not create:",
    "- AGENTS.md",
    "- .persona/project-profile.jsonc",
    "- .persona/workflow plan/report templates",
    "",
    "Next for backend projects: npx ph bootstrap backend",
  ].join("\n")
}

class PersonaInitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PersonaInitError"
  }
}

const OPENCODE_CONFIG_PATH = ".opencode/opencode.json"
const PROJECT_NOISE_IGNORE_ENTRIES = [
  "node_modules/",
  ".opencode/node_modules/",
  ".persona/rules/",
  ".persona/evidence/",
  ".gradle/",
  "build/",
] as const

const PUBLIC_INIT_EXCLUDED_RULES = new Set([
  "backend/step1-api-contract.md",
  "backend/step2-3-api-contract.md",
])

function defaultPackageRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..", "..")
}

function readOpencodeConfig(configPath: string): Record<string, unknown> {
  if (!existsSync(configPath)) {
    return {}
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(stripJsonComments(readFileSync(configPath, "utf8")))
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new PersonaInitError(`Failed to parse ${OPENCODE_CONFIG_PATH}. Fix the JSON/JSONC syntax and run init again.`)
    }
    throw error
  }

  if (!isRecord(parsed)) {
    throw new PersonaInitError(`${OPENCODE_CONFIG_PATH} must contain a JSON object.`)
  }

  return { ...parsed }
}

function mergePluginPath(config: Record<string, unknown>, pluginPath: string): Record<string, unknown> {
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

function backupAmbiguousOpencodeConfig(configPath: string, config: Record<string, unknown>): string | undefined {
  const plugin = config.plugin
  if (plugin === undefined || typeof plugin === "string" || Array.isArray(plugin)) {
    return undefined
  }

  const backupPath = `${configPath}.bak`
  renameSync(configPath, backupPath)
  return backupPath
}

function relativePath(projectDir: string, filePath: string): string {
  const normalized = filePath.startsWith(projectDir) ? filePath.slice(projectDir.length + 1) : filePath
  return normalized.replace(/\\/g, "/")
}

function writeOpencodeConfig(projectDir: string, pluginPath: string): readonly string[] {
  const opencodeDir = join(projectDir, ".opencode")
  const configPath = join(opencodeDir, "opencode.json")
  mkdirSync(opencodeDir, { recursive: true })

  const config = readOpencodeConfig(configPath)
  const backupPath = existsSync(configPath) ? backupAmbiguousOpencodeConfig(configPath, config) : undefined
  const merged = mergePluginPath(backupPath === undefined ? config : {}, pluginPath)
  writeFileSync(configPath, `${JSON.stringify(merged, null, 2)}\n`)

  return backupPath === undefined ? [] : [relativePath(projectDir, backupPath)]
}

function writeProjectNoiseIgnore(projectDir: string): void {
  const gitignorePath = join(projectDir, ".gitignore")
  const existing = existsSync(gitignorePath) ? readFileSync(gitignorePath, "utf8") : ""
  const existingLines = new Set(existing.split(/\r?\n/).map((line) => line.trim()))
  const missingEntries = PROJECT_NOISE_IGNORE_ENTRIES.filter((entry) => !existingLines.has(entry))
  if (missingEntries.length === 0) {
    return
  }

  const prefix = existing.length > 0 && !existing.endsWith("\n") ? "\n" : ""
  const sectionHeader = existingLines.has("# Persona Harness generated context noise") ? [] : ["# Persona Harness generated context noise"]
  const nextContent = `${existing}${prefix}${[...sectionHeader, ...missingEntries].join("\n")}\n`
  writeFileSync(gitignorePath, nextContent)
}

function normalizeTemplateRelativePath(sourcePath: string, sourceRoot: string): string {
  return sourcePath === sourceRoot ? "" : sourcePath.slice(sourceRoot.length + sep.length).replace(/\\/g, "/")
}

function shouldCopyPublicRuleTemplate(sourcePath: string, sourceRulesDir: string): boolean {
  const relative = normalizeTemplateRelativePath(sourcePath, sourceRulesDir)
  return relative === "" || !PUBLIC_INIT_EXCLUDED_RULES.has(relative)
}

export function initializePersonaHarness(options: InitOptions = {}): InitResult {
  const projectDir = resolve(options.projectDir ?? process.cwd())
  const packageRoot = resolve(options.packageRoot ?? defaultPackageRoot())
  const personaDir = join(projectDir, ".persona")
  const sourceHarnessConfig = join(packageRoot, ".persona", "harness.jsonc")
  const sourceConventionsDir = join(packageRoot, ".persona", "conventions")
  const sourceRulesDir = join(packageRoot, ".persona", "rules")
  const targetHarnessConfig = join(personaDir, "harness.jsonc")
  const targetConventionsDir = join(personaDir, "conventions")
  const targetRulesDir = join(personaDir, "rules")
  const pluginPath = join(packageRoot, "dist", "index.js")

  if (!existsSync(sourceHarnessConfig)) {
    throw new PersonaInitError(`Missing template: ${sourceHarnessConfig}`)
  }
  if (!existsSync(sourceRulesDir)) {
    throw new PersonaInitError(`Missing template: ${sourceRulesDir}`)
  }

  mkdirSync(personaDir, { recursive: true })
  cpSync(sourceHarnessConfig, targetHarnessConfig)
  if (existsSync(sourceConventionsDir)) {
    cpSync(sourceConventionsDir, targetConventionsDir, { recursive: true })
  }
  cpSync(sourceRulesDir, targetRulesDir, {
    recursive: true,
    filter: (sourcePath) => shouldCopyPublicRuleTemplate(sourcePath, sourceRulesDir),
  })
  const backups = writeOpencodeConfig(projectDir, pluginPath)
  writeProjectNoiseIgnore(projectDir)

  return {
    projectDir,
    packageRoot,
    pluginPath: isAbsolute(pluginPath) ? pluginPath : resolve(pluginPath),
    installed: [
      ".persona/harness.jsonc",
      ".persona/conventions/",
      ".persona/rules/",
      ".opencode/opencode.json",
      ".gitignore",
    ],
    backups,
    evidenceCopied: false,
  }
}

export function runInitCommand(options: InitOptions = {}): { readonly status: number; readonly stdout: string; readonly stderr: string } {
  try {
    return {
      status: 0,
      stdout: `${formatInitResult(initializePersonaHarness(options))}\n`,
      stderr: "",
    }
  } catch (error) {
    if (error instanceof PersonaInitError) {
      return {
        status: 1,
        stdout: "",
        stderr: `${error.message}\n`,
      }
    }
    throw error
  }
}
