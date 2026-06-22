import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

import type { CliRunResult } from "./bearshell.js"

type DoctorOptions = {
  readonly projectDir?: string
}

function commandVersion(command: string, args: readonly string[]): string {
  try {
    return execFileSync(command, [...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || "available"
  } catch {
    return "missing"
  }
}

function pathStatus(projectDir: string, relativePath: string): "present" | "missing" {
  return existsSync(join(projectDir, relativePath)) ? "present" : "missing"
}

function pluginStatus(projectDir: string): "configured" | "missing" | "unreadable" {
  const configPath = join(projectDir, ".opencode", "opencode.json")
  if (!existsSync(configPath)) {
    return "missing"
  }
  try {
    const content = readFileSync(configPath, "utf8")
    return content.includes("dist/index.js") || content.includes("persona-harness") ? "configured" : "missing"
  } catch {
    return "unreadable"
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function packageVersion(): string {
  const packagePath = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "package.json")
  try {
    const parsed: unknown = JSON.parse(readFileSync(packagePath, "utf8"))
    return isRecord(parsed) && typeof parsed.version === "string" ? parsed.version : "unknown"
  } catch {
    return process.env.npm_package_version ?? "unknown"
  }
}

export function runDoctorCommand(_args: readonly string[], options: DoctorOptions = {}): CliRunResult {
  const projectDir = resolve(options.projectDir ?? process.cwd())
  const lines = [
    "Persona Harness Doctor",
    "",
    `Project: ${projectDir}`,
    `Node: ${process.version}`,
    `npm: ${commandVersion("npm", ["--version"])}`,
    `OpenCode: ${commandVersion("opencode", ["--version"])}`,
    `Persona package version: ${packageVersion()}`,
    "npm registry: unchecked",
    "",
    "Project integration:",
    `.opencode/opencode.json: ${pathStatus(projectDir, ".opencode/opencode.json")}`,
    `Persona plugin path: ${pluginStatus(projectDir)}`,
    `.persona/harness.jsonc: ${pathStatus(projectDir, ".persona/harness.jsonc")}`,
    `.persona/rules: ${pathStatus(projectDir, ".persona/rules")}`,
    `.persona/workflow/plan.md: ${pathStatus(projectDir, ".persona/workflow/plan.md")}`,
    `.persona/evidence: ${pathStatus(projectDir, ".persona/evidence")}`,
    "",
    "Scope:",
    "- local install / tarball install diagnostics",
    "- no generated app product-quality certification",
  ]
  return { status: 0, stdout: `${lines.join("\n")}\n`, stderr: "" }
}
