import { spawnSync } from "node:child_process"
import { createHash, randomUUID } from "node:crypto"
import { join, relative, resolve } from "node:path"
import process from "node:process"

import { EVIDENCE_PRIVACY_CLASS } from "../config/evidence-privacy.js"
import { resolveSafeEvidenceRootResult } from "../config/harness-config.js"
import { opaqueEvidenceKey, writePrivateEvidenceJson } from "../runtime/evidence-file.js"
import type { CliRunResult } from "./bearshell.js"
import {
  type AbRunConfig,
  type AbRunRecord,
  EVIDENCE_AB_RUN_USAGE,
  type EvidenceAbRunOptions,
  parseAbRunConfig,
} from "./evidence-ab-run-options.js"

const AB_DIRECTORY = "ab"

type PrivateAbRunRecord = Omit<AbRunRecord, "command"> & {
  readonly commandSummary: {
    readonly argvCount: number
    readonly sha256: string
  }
}

function runCommand(config: AbRunConfig, options: EvidenceAbRunOptions): PrivateAbRunRecord {
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
    commandSummary: {
      argvCount: config.command.length,
      sha256: `sha256:${createHash("sha256").update(JSON.stringify(config.command)).digest("hex")}`,
    },
    continuationApplied: config.closure.continuationApplied,
    earlyCompletionBlocked: config.closure.earlyCompletionBlocked,
    elapsedMs: config.elapsedMs ?? measuredElapsedMs,
    exitStatus,
    finishStatus,
    finishStatusAfter: config.closure.finishStatusAfter,
    finishStatusBefore: config.closure.finishStatusBefore,
    id: config.runId === null ? randomUUID() : opaqueEvidenceKey(config.runId),
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
  run: PrivateAbRunRecord,
  evidenceRoot: string,
): string {
  const scenarioDir = join(evidenceRoot, AB_DIRECTORY, opaqueEvidenceKey(config.scenario))
  const filePath = join(scenarioDir, `${opaqueEvidenceKey(config.condition)}-${opaqueEvidenceKey(run.id)}.json`)
  const evidence = {
    schemaVersion: "persona-ab-measurement.1",
    privacyClass: EVIDENCE_PRIVACY_CLASS.metadataSafe,
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
  writePrivateEvidenceJson(evidenceRoot, filePath, evidence)
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
  const relativePath = relative(projectDir, filePath).replace(/\\/g, "/")
  return {
    status: 0,
    stdout: [
      `A/B evidence written: ${relativePath}`,
      `Scenario: ${opaqueEvidenceKey(config.scenario)}`,
      `Condition: ${opaqueEvidenceKey(config.condition)}`,
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
