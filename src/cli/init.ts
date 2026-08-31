#!/usr/bin/env node
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { formatInitResult } from "./init-output.js"
import { INIT_MANIFEST_RELATIVE_PATH, InitManifestError, serializeInitManifest } from "./init-manifest.js"
import { prepareInit } from "./init-plan.js"
import { commitInitPlan, type InitTransactionOptions } from "./init-transaction.js"
import {
  materializeFreshBootstrapWriteBoundary,
  type BootstrapWriteBoundary,
} from "../io/bootstrap-write-boundary.js"

export { formatInitNonInteractiveInterviewMessage, formatInitResult } from "./init-output.js"

export type InitOptions = {
  readonly bootstrapPersonaState?: {
    readonly kind: "preinitialized"
    readonly manifestProjectRealPath?: string
  }
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

export type FreshBootstrapInitResult = {
  readonly boundary: BootstrapWriteBoundary
  readonly result: InitResult
}

export function initUsage(invocationName: string): string {
  return [
    `Usage: ${invocationName} init [--dry-run]`,
    "",
    "Install or safely re-run Persona Harness config/rules, host skill adapters, and OpenCode plugin config.",
    "",
    "Creates or owns:",
    "- .persona/harness.jsonc",
    "- .persona/conventions/",
    "- .persona/rules/",
    "- .persona/.ph-init-manifest.json",
    "- .agents/skills/persona-harness-*/",
    "- .claude/skills/persona-harness-claude-*/",
    "- .opencode/opencode.json",
    "- .opencode/skills/persona-harness-opencode-*/",
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
      ".agents/skills/",
      ".claude/skills/",
      ".opencode/opencode.json",
      ".opencode/skills/",
      ".gitignore",
    ],
    backups: transaction.backups,
    evidenceCopied: false,
    decision: transaction.decision,
    changed: transaction.changed,
    conflicts: [],
  }
}

export function initializeFreshBootstrapPersonaHarness(options: InitOptions = {}): FreshBootstrapInitResult {
  if (options.dryRun) {
    throw new PersonaInitError("Bootstrap initialization cannot run as a dry run.")
  }
  const prepared = prepareInit(options, defaultPackageRoot())
  if (prepared.currentManifest !== null) {
    throw new PersonaInitError("Bootstrap initialization requires a fresh Persona directory.")
  }
  const personaTargets = prepared.targets.filter((target) => target.relativePath.startsWith(".persona/"))
  const rootTargets = prepared.targets.filter((target) => !target.relativePath.startsWith(".persona/"))
  const personaFiles = [
    ...personaTargets,
    { relativePath: INIT_MANIFEST_RELATIVE_PATH, bytes: serializeInitManifest(prepared.manifest) },
  ]
  let boundary: BootstrapWriteBoundary | undefined
  try {
    options.onBeforeCommit?.()
    boundary = materializeFreshBootstrapWriteBoundary(
      prepared.projectDir,
      personaFiles.map((target) => ({
        bytes: "nextBytes" in target ? target.nextBytes : target.bytes,
        relativePath: target.relativePath,
      })),
    )
    const activeBoundary = boundary
    const changedRootTargets = rootTargets
      .filter((target) => activeBoundary.writeRootFile(target.relativePath, target.nextBytes))
      .map((target) => target.relativePath)
    for (const target of changedRootTargets) options.onAfterCommitFile?.(target)
    for (const target of personaFiles) options.onAfterCommitFile?.(target.relativePath)
    return {
      boundary,
      result: {
        projectDir: prepared.projectDir,
        packageRoot: prepared.packageRoot,
        pluginPath: prepared.pluginPath,
        installed: [
          ".persona/harness.jsonc",
          ".persona/conventions/",
          ".persona/rules/",
          INIT_MANIFEST_RELATIVE_PATH,
          ".agents/skills/",
          ".claude/skills/",
          ".opencode/opencode.json",
          ".opencode/skills/",
          ".gitignore",
        ],
        backups: [],
        evidenceCopied: false,
        decision: "apply",
        changed: [
          ...personaFiles.map((target) => target.relativePath),
          ...changedRootTargets,
        ].sort((left, right) => left.localeCompare(right)),
        conflicts: [],
      },
    }
  } catch (error) {
    boundary?.close()
    if (error instanceof InitManifestError || error instanceof PersonaInitError) throw error
    throw new PersonaInitError("Bootstrap initialization failed.")
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
