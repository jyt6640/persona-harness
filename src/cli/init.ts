#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { dirname, isAbsolute, join, resolve } from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

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

class PersonaInitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PersonaInitError"
  }
}

const OPENCODE_CONFIG_PATH = ".opencode/opencode.json"

function stripJsonComments(input: string): string {
  let output = ""
  let index = 0
  let inString = false
  let escaped = false

  while (index < input.length) {
    const current = input[index]
    const next = input[index + 1]

    if (inString) {
      output += current
      if (escaped) {
        escaped = false
      } else if (current === "\\") {
        escaped = true
      } else if (current === "\"") {
        inString = false
      }
      index += 1
      continue
    }

    if (current === "\"") {
      inString = true
      output += current
      index += 1
      continue
    }

    if (current === "/" && next === "/") {
      while (index < input.length && input[index] !== "\n") {
        index += 1
      }
      continue
    }

    if (current === "/" && next === "*") {
      index += 2
      while (index < input.length && !(input[index] === "*" && input[index + 1] === "/")) {
        index += 1
      }
      index += 2
      continue
    }

    output += current
    index += 1
  }

  return output
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

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

export function initializePersonaHarness(options: InitOptions = {}): InitResult {
  const projectDir = resolve(options.projectDir ?? process.cwd())
  const packageRoot = resolve(options.packageRoot ?? defaultPackageRoot())
  const personaDir = join(projectDir, ".persona")
  const sourceHarnessConfig = join(packageRoot, ".persona", "harness.jsonc")
  const sourceRulesDir = join(packageRoot, ".persona", "rules")
  const targetHarnessConfig = join(personaDir, "harness.jsonc")
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
  cpSync(sourceRulesDir, targetRulesDir, { recursive: true })
  const backups = writeOpencodeConfig(projectDir, pluginPath)

  return {
    projectDir,
    packageRoot,
    pluginPath: isAbsolute(pluginPath) ? pluginPath : resolve(pluginPath),
    installed: [".persona/harness.jsonc", ".persona/rules/", ".opencode/opencode.json"],
    backups,
    evidenceCopied: false,
  }
}

function formatInitResult(result: InitResult): string {
  const backupLines = result.backups.length > 0 ? ["", "Backups:", ...result.backups.map((backup) => `- ${backup}`)] : []

  return [
    "Persona Harness initialized.",
    "",
    "Installed:",
    ...result.installed.map((item) => `- ${item}`),
    ...backupLines,
    "",
    "Next:",
    'opencode run --dir . --model openai/gpt-5.4-mini-fast "README.md를 끝까지 읽고, 요구사항 전체를 Gradle 기반 Spring 백엔드로 구현해줘."',
    "",
    "Scope:",
    "- Java/Spring backend Clean Code injection",
    "- Gradle-first backend product code shape guidance",
    "",
    "Not guaranteed:",
    "- generated app product quality",
    "- test quality",
    "- rule enforcement",
    "- frontend/infra/multi-domain productization",
    "",
    "Evidence:",
    "- .persona/evidence/",
    "- .persona/evidence/ was not copied from the template; it is created only when hooks run.",
  ].join("\n")
}

function runCli(): void {
  const command = process.argv[2]
  if (command !== "init") {
    console.error("Usage: persona-harness init")
    process.exitCode = 1
    return
  }

  try {
    console.log(formatInitResult(initializePersonaHarness()))
  } catch (error) {
    if (error instanceof PersonaInitError) {
      console.error(error.message)
      process.exitCode = 1
      return
    }
    throw error
  }
}

function isCliEntrypoint(): boolean {
  const entrypoint = process.argv[1]
  if (entrypoint === undefined) {
    return false
  }
  return (
    entrypoint === fileURLToPath(import.meta.url) ||
    entrypoint.replace(/\\/g, "/").endsWith("/persona-harness") ||
    entrypoint.replace(/\\/g, "/").endsWith("/init.js")
  )
}

if (isCliEntrypoint()) {
  runCli()
}
