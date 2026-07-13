#!/usr/bin/env node
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { formatInitResult } from "./init-output.js"
import { INIT_MANIFEST_RELATIVE_PATH, InitManifestError } from "./init-manifest.js"
import { prepareInit } from "./init-plan.js"
import { commitInitPlan, type InitTransactionOptions } from "./init-transaction.js"

export { formatInitNonInteractiveInterviewMessage, formatInitResult } from "./init-output.js"

export type InitOptions = {
  readonly dryRun?: boolean
  readonly onAfterCommitFile?: (relativePath: string) => void
  readonly onBeforeCommit?: () => void
  readonly packageRoot?: string
  readonly projectDir?: string
}

export type InitDecision = "apply" | "no-op" | "dry-run"

export type InitResult = {
  readonly projectDir: string
  readonly packageRoot: string
  readonly pluginPath: string
  readonly installed: readonly string[]
  readonly backups: readonly string[]
  readonly evidenceCopied: false
  readonly decision: InitDecision
  readonly changed: readonly string[]
  readonly conflicts: readonly string[]
}

export function initUsage(invocationName: string): string {
  return [
    `Usage: ${invocationName} init [--dry-run]`,
    "",
    "Install or safely re-run Persona Harness config/rules and OpenCode plugin config.",
    "",
    "Creates or owns:",
    "- .persona/harness.jsonc",
    "- .persona/conventions/",
    "- .persona/rules/",
    "- .persona/.ph-init-manifest.json",
    "- .opencode/opencode.json",
    "- .gitignore entries for generated/vendor context noise",
    "",
    "Does not create or overwrite:",
    "- AGENTS.md",
    "- .persona/project-profile.jsonc",
    "- .persona/workflow plan/report templates",
    "",
    "Unchanged owned files are safe to re-run; modified or ambiguous files fail closed.",
    "Use --dry-run for a deterministic zero-write preview.",
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

function defaultPackageRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..", "..")
}

export function initializePersonaHarness(options: InitOptions = {}): InitResult {
  const prepared = prepareInit(options, defaultPackageRoot())
  const transactionOptions: InitTransactionOptions = {
    dryRun: options.dryRun,
    onAfterCommitFile: options.onAfterCommitFile,
    onBeforeCommit: options.onBeforeCommit,
  }
  let transaction: ReturnType<typeof commitInitPlan>
  try {
    transaction = commitInitPlan(
      prepared.projectDir,
      prepared.targets,
      prepared.manifest,
      prepared.currentManifest,
      transactionOptions,
    )
  } catch (error) {
    if (error instanceof InitManifestError) {
      throw error
    }
    throw new PersonaInitError(`Init transaction failed: ${error instanceof Error ? error.message : "unknown error"}`)
  }
  return {
    projectDir: prepared.projectDir,
    packageRoot: prepared.packageRoot,
    pluginPath: prepared.pluginPath,
    installed: [
      ".persona/harness.jsonc",
      ".persona/conventions/",
      ".persona/rules/",
      INIT_MANIFEST_RELATIVE_PATH,
      ".opencode/opencode.json",
      ".gitignore",
    ],
    backups: transaction.backups,
    evidenceCopied: false,
    decision: transaction.decision,
    changed: transaction.changed,
    conflicts: [],
  }
}

function parseInitArgs(args: readonly string[]): { readonly kind: "run"; readonly dryRun: boolean } | { readonly kind: "invalid"; readonly message: string } {
  let dryRun = false
  for (const arg of args) {
    if (arg === "--dry-run") {
      if (dryRun) {
        return { kind: "invalid", message: "Duplicate init option: --dry-run" }
      }
      dryRun = true
      continue
    }
    return { kind: "invalid", message: `Unknown init option: ${arg}` }
  }
  return { kind: "run", dryRun }
}

export function runInitCommand(
  args: readonly string[] = [],
  options: InitOptions = {},
): { readonly status: number; readonly stdout: string; readonly stderr: string } {
  const parsed = parseInitArgs(args)
  if (parsed.kind === "invalid") {
    return { status: 1, stdout: "", stderr: `${parsed.message}\n\n${initUsage("ph")}\n` }
  }
  try {
    return {
      status: 0,
      stdout: `${formatInitResult(initializePersonaHarness({ ...options, dryRun: parsed.dryRun }))}\n`,
      stderr: "",
    }
  } catch (error) {
    if (error instanceof PersonaInitError || error instanceof InitManifestError) {
      return {
        status: 1,
        stdout: "",
        stderr: `${error.message}\n`,
      }
    }
    throw error
  }
}
