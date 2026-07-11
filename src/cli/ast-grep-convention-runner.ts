import { existsSync, readFileSync } from "node:fs"
import { delimiter, join, relative, resolve } from "node:path"
import { spawnSync } from "node:child_process"

import type { ConventionDefinition } from "../config/convention-registry.js"
import { isRecord } from "../config/jsonc.js"
import {
  collectConventionFiles,
  readBooleanMeta,
  readLevel,
  readPersonaMeta,
  readYamlScalar,
  slugFor,
} from "./convention-pack.js"

export type AstGrepConventionFinding = {
  readonly line: number
  readonly message: string
  readonly path: string
}

export type AstGrepConventionResult =
  | { readonly findings: readonly AstGrepConventionFinding[]; readonly status: "checked" }
  | { readonly status: "inactive" }
  | { readonly status: "skipped"; readonly warning: string }

const DEFAULT_SCAN_ROOT = join("src", "main", "java")

function lookupExecutable(candidate: string): string | undefined {
  const trimmed = candidate.trim()
  if (trimmed === "") {
    return undefined
  }
  if (trimmed.includes("/") || trimmed.includes("\\")) {
    return existsSync(trimmed) ? trimmed : undefined
  }

  const extensions = process.platform === "win32" ? ["", ".cmd", ".exe", ".ps1"] : [""]
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    if (dir.trim() === "") {
      continue
    }
    for (const extension of extensions) {
      const resolved = join(dir, `${trimmed}${extension}`)
      if (existsSync(resolved)) {
        return resolved
      }
    }
  }
  return undefined
}

function verifiedAstGrepExecutable(candidate: string): string | undefined {
  const executable = lookupExecutable(candidate)
  if (executable === undefined) {
    return undefined
  }
  const version = spawnSync(executable, ["--version"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024,
    timeout: 5_000,
  })
  if (version.error !== undefined || version.status !== 0) {
    return undefined
  }
  const identity = `${version.stdout}\n${version.stderr}`.trim()
  return /^ast-grep(?:\s+|$)/u.test(identity) ? executable : undefined
}

export function findAstGrepBinary(): string | undefined {
  const override = process.env.PH_AST_GREP_BIN
  if (override !== undefined && override.trim() !== "") {
    return verifiedAstGrepExecutable(override)
  }
  return verifiedAstGrepExecutable("ast-grep") ?? verifiedAstGrepExecutable("sg")
}

function stringValue(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key]
  return typeof value === "string" && value.trim() !== "" ? value : undefined
}

function numberValue(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key]
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function parseAstGrepJson(stdout: string): readonly AstGrepConventionFinding[] | undefined {
  let parsed: unknown
  try {
    parsed = JSON.parse(stdout)
  } catch {
    return undefined
  }
  if (!Array.isArray(parsed)) {
    return undefined
  }

  const findings: AstGrepConventionFinding[] = []
  for (const item of parsed) {
    if (!isRecord(item)) {
      continue
    }
    const filePath = stringValue(item, "file")
    if (filePath === undefined) {
      continue
    }
    const message = stringValue(item, "message") ?? "ast-grep convention matched"
    const range = item.range
    const start = isRecord(range) && isRecord(range.start) ? range.start : undefined
    const zeroBasedLine = start === undefined ? undefined : numberValue(start, "line")
    findings.push({
      line: zeroBasedLine === undefined ? 1 : zeroBasedLine + 1,
      message,
      path: filePath,
    })
  }
  return findings
}

function targetSuffixApplies(definition: ConventionDefinition, filePath: string): boolean {
  const suffixes = definition.targetFileSuffixes
  return suffixes === undefined || suffixes.some((suffix) => filePath.replace(/\\/g, "/").endsWith(suffix))
}

export function runAstGrepConvention(projectDir: string, definition: ConventionDefinition): AstGrepConventionResult {
  if (definition.check.kind !== "ast-grep") {
    return { status: "inactive" }
  }

  const rulePath = resolve(projectDir, definition.check.rule)
  if (!existsSync(rulePath)) {
    return { status: "inactive" }
  }

  const binary = findAstGrepBinary()
  if (binary === undefined) {
    return {
      status: "skipped",
      warning: `${definition.id} skipped: ast-grep binary not found; install sg/ast-grep or set PH_AST_GREP_BIN`,
    }
  }

  const scanRoot = join(projectDir, DEFAULT_SCAN_ROOT)
  if (!existsSync(scanRoot)) {
    return { findings: [], status: "checked" }
  }

  const result = spawnSync(binary, ["scan", "--json", "--rule", rulePath, scanRoot], {
    cwd: projectDir,
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  })
  if (result.error !== undefined || result.status !== 0) {
    const details = result.error?.message ?? result.stderr.trim() ?? "ast-grep scan failed"
    return { status: "skipped", warning: `${definition.id} skipped: ${details}` }
  }

  const parsed = parseAstGrepJson(result.stdout)
  if (parsed === undefined) {
    return { status: "skipped", warning: `${definition.id} skipped: ast-grep returned non-JSON output` }
  }

  const findings = parsed.flatMap((finding) => {
    const absolutePath = resolve(projectDir, finding.path)
    if (!targetSuffixApplies(definition, absolutePath)) {
      return []
    }
    return [{
      line: finding.line,
      message: finding.message,
      path: relative(projectDir, absolutePath).replace(/\\/g, "/"),
    }]
  })
  return { findings, status: "checked" }
}

export function loadAstGrepConventionDefinitions(projectDir: string): readonly ConventionDefinition[] {
  return collectConventionFiles(projectDir).flatMap((filePath) => {
    const source = readFileSync(filePath, "utf8")
    const id = readYamlScalar(source, "id")
    if (id === undefined) {
      return []
    }
    const message = readYamlScalar(source, "message") ?? `ast-grep convention ${id} matched`
    const relativeRulePath = relative(projectDir, filePath).replace(/\\/g, "/")
    const slug = slugFor(id)
    const targetSuffix = readPersonaMeta(source, "target-suffix")
    return [{
      actionableMessage: message,
      blockAllowed: readBooleanMeta(readPersonaMeta(source, "block-allowed")),
      blockerId: `architecture-${slug}`,
      check: { kind: "ast-grep", rule: relativeRulePath },
      defaultLevel: readLevel(readPersonaMeta(source, "level")),
      fixPath: readPersonaMeta(source, "fix-path") ?? `Review and fix ast-grep convention ${id}.`,
      highPrecision: readBooleanMeta(readPersonaMeta(source, "high-precision")),
      id,
      profileScope: readPersonaMeta(source, "profile-scope") === "java-spring-service-architecture"
        ? "java-spring-service-architecture"
        : undefined,
      scope: readPersonaMeta(source, "scope") === "tree" ? "tree" : "single-file",
      stepId: readPersonaMeta(source, "step-id") ?? `fix-${slug}`,
      targetFileSuffixes: targetSuffix === undefined ? undefined : [targetSuffix],
      writeGuard: false,
    }]
  })
}
