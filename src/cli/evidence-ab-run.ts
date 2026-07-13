import { spawnSync } from "node:child_process"
import { mkdirSync } from "node:fs"
import { join, resolve } from "node:path"
import process from "node:process"

import { resolveSafeEvidenceRootResult } from "../config/harness-config.js"
import { writeFileAtomic } from "../io/atomic-file.js"
import type { CliRunResult } from "./bearshell.js"
import {
  type AbRunConfig,
  type AbRunRecord,
  EVIDENCE_AB_RUN_USAGE,
  type EvidenceAbRunOptions,
  parseAbRunConfig,
  safeEvidenceSlug,
} from "./evidence-ab-run-options.js"

const AB_DIRECTORY = "ab"

function runCommand(config: AbRunConfig, options: EvidenceAbRunOptions): AbRunRecord {
  const started = Date.now()
  const result = spawnSync(config.command[0] ?? "", config.command.slice(1), {
    cwd: resolve(options.projectDir ?? process.cwd()),
    encoding: "utf8",
    env: { ...process.env, ...options.env },
    maxBuffer: 1024 * 1024,
  })
  const measuredElapsedMs = Date.now() - started
  const exitStatus = typeof result.status === "number" ? result.status : null
  const finishStatus = config.finishStatus ?? (exitStatus === 0 ? "pass" : "fail")
  return {
    closureBlockerDelta: config.closure.closureBlockerDelta,
    closureBlockersAfter: config.closure.closureBlockersAfter,
    closureBlockersBefore: config.closure.closureBlockersBefore,
    command: config.command,
    continuationApplied: config.closure.continuationApplied,
    earlyCompletionBlocked: config.closure.earlyCompletionBlocked,
    elapsedMs: config.elapsedMs ?? measuredElapsedMs,
    exitStatus,
    finishStatus,
    finishStatusAfter: config.closure.finishStatusAfter,
    finishStatusBefore: config.closure.finishStatusBefore,
    id: config.runId ?? `${safeEvidenceSlug(config.condition)}-${started}`,
    mcpCalls: config.mcpCalls,
    outcome: config.outcome ?? (exitStatus === 0 ? "command-passed" : "command-failed"),
    providerTokens: config.providerTokens,
    readChars: config.readChars,
    retryCapHit: config.closure.retryCapHit,
    runawayRetries: config.closure.runawayRetries,
    signal: result.signal,
    stderrChars: result.stderr.length,
    stdoutChars: result.stdout.length,
    toolCalls: config.toolCalls,
  }
}

function writeRunEvidence(
  config: AbRunConfig,
  run: AbRunRecord,
  evidenceRoot: string,
): string {
  const scenarioDir = join(evidenceRoot, AB_DIRECTORY, safeEvidenceSlug(config.scenario))
  mkdirSync(scenarioDir, { recursive: true })
  const filePath = join(scenarioDir, `${safeEvidenceSlug(config.condition)}-${safeEvidenceSlug(run.id)}.json`)
  const evidence = {
    schemaVersion: "persona-ab-measurement.1",
    scenarioId: config.scenario,
    scenarioLabel: config.scenarioLabel ?? config.scenario,
    source: config.source ?? "ph evidence ab-run",
    surface: {
      defaultState: config.surface.defaultState,
      id: config.surface.id ?? config.scenario,
      label: config.surface.label ?? config.surface.id ?? config.scenario,
    },
    conditions: [
      {
        id: config.condition,
        label: config.conditionLabel ?? config.condition,
        runs: [
          {
            ...run,
            blockedInvalidCompletion: config.blockedInvalidCompletion,
          },
        ],
      },
    ],
  }
  writeFileAtomic(filePath, `${JSON.stringify(evidence, null, 2)}\n`)
  return filePath
}

export function runEvidenceAbRunCommand(args: readonly string[], options: EvidenceAbRunOptions = {}): CliRunResult {
  const config = parseAbRunConfig(args)
  if (config === undefined) {
    return { status: 1, stdout: "", stderr: EVIDENCE_AB_RUN_USAGE }
  }
  const projectDir = resolve(options.projectDir ?? process.cwd())
  const evidenceRoot = resolveSafeEvidenceRootResult(projectDir)
  if (!evidenceRoot.ok) {
    return {
      status: 1,
      stdout: "",
      stderr: "A/B evidence unavailable: configured evidence root is unsafe; read-only recovery is required.\n",
    }
  }
  const run = runCommand(config, options)
  const filePath = writeRunEvidence(config, run, evidenceRoot.path)
  return {
    status: 0,
    stdout: [
      `A/B evidence written: ${filePath}`,
      `Scenario: ${config.scenario}`,
      `Condition: ${config.condition}`,
      `Run: ${run.id}`,
      `Exit status: ${run.exitStatus ?? "signal"}`,
      `Finish status: ${run.finishStatus}`,
      "Decision support only; no token-saving, product-efficacy, or quality claim.",
    ].join("\n") + "\n",
    stderr: "",
  }
}

export function evidenceAbRunUsage(invocationName: string): string {
  return EVIDENCE_AB_RUN_USAGE.replace("ph evidence", `${invocationName} evidence`)
}
