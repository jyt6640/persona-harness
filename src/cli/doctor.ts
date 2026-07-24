import { existsSync } from "node:fs"
import { join, resolve } from "node:path"
import process from "node:process"

import {
  loadHarnessConfigResult,
  resolveConfiguredPathResult,
} from "../config/harness-config.js"
import { walkBoundedFiles } from "../io/bounded-path-walker.js"
import { readEntrySteeringStatusSummary } from "../runtime/entry-steering-status.js"
import { summarizeRuleDiagnostics } from "../rules/rule-diagnostics-report.js"
import { summarizeConventionPackDiagnostics } from "./convention-pack-diagnostics.js"
import type { CliRunResult } from "./bearshell.js"
import {
  commandVersion,
  opencodeVersion,
  packageVersion,
  pathStatus,
  platformFindings,
  registrySummary,
  runtimeBlockedExternalTrust,
  scanStaleFixtureRules,
  summarizeDoctorExternalTrust,
} from "./doctor-inspection.js"
import { doctorJson, formatDoctorSummary } from "./doctor-output.js"
import { readDoctorReachability } from "./doctor-reachability.js"
import type { DoctorOptions, DoctorSummary } from "./doctor-types.js"
import {
  SIGSTORE_NODE_ENGINE_RANGE,
  assessSigstoreNodeRuntime,
} from "../../scripts/node-runtime-floor.mjs"
import { verifyExternalFinishAttestationForClosure } from "./workflow-finish-attestation.js"
import { assessVerificationAuthority } from "./workflow-verification-receipt.js"

export { formatDoctorSummary } from "./doctor-output.js"
export { summarizeDoctorExternalTrust } from "./doctor-inspection.js"
export type {
  DoctorExternalTrustSummary,
  DoctorOptions,
  DoctorSummary,
  StaleFixtureFinding,
} from "./doctor-types.js"

export function readDoctorSummary(options: DoctorOptions = {}): DoctorSummary {
  const projectDir = resolve(options.projectDir ?? process.cwd())
  const configResult = loadHarnessConfigResult(projectDir)
  const harnessConfig = configResult.config
  const rulesPath = configResult.safe
    ? resolveConfiguredPathResult(projectDir, harnessConfig.rulesDir)
    : undefined
  const evidencePath = configResult.safe
    ? resolveConfiguredPathResult(projectDir, harnessConfig.evidenceDir)
    : undefined
  const rulesScan = rulesPath?.ok === true
    ? scanStaleFixtureRules(projectDir, rulesPath.path, rulesPath.relativePath || harnessConfig.rulesDir)
    : {
        pathSafetyDiagnostics: [],
        rulesFileCount: 0,
        staleFixtureFindings: [],
      }
  const evidenceScan = evidencePath?.ok === true
    ? walkBoundedFiles(evidencePath.path, projectDir, {
        displayRoot: evidencePath.relativePath || harnessConfig.evidenceDir,
        includeText: false,
      })
    : undefined
  const configPathDiagnostics = configResult.diagnostics.map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`)
  const pathSafetyDiagnostics = [
    ...configPathDiagnostics,
    ...rulesScan.pathSafetyDiagnostics,
    ...(evidenceScan?.diagnostics.map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`) ?? []),
  ]
  const rulePackDiagnostics = summarizeRuleDiagnostics(projectDir)
  const conventionPackDiagnostics = summarizeConventionPackDiagnostics(projectDir)
  const opencode = opencodeVersion(options)
  const reachability = readDoctorReachability(projectDir)
  const packageVersionValue = packageVersion()
  const registryDetails = registrySummary(packageVersionValue, options)
  const nodeSupport = assessSigstoreNodeRuntime(options.nodeVersion ?? process.versions.node)
  const externalTrust = nodeSupport.status === "supported"
    ? summarizeDoctorExternalTrust((options.externalTrustInspector ?? verifyExternalFinishAttestationForClosure)(projectDir))
    : runtimeBlockedExternalTrust()
  const verificationAuthority = assessVerificationAuthority(projectDir)
  const runtimeFindings = [
    ...platformFindings(options.platform ?? process.platform),
    ...(opencode === "missing"
      ? ["OpenCode CLI is missing; Persona Harness plugin runtime attachment cannot be verified."]
      : []),
    ...(pathSafetyDiagnostics.length > 0
      ? ["Harness configuration/path safety is blocked; read-only recovery is required."]
      : []),
    ...(registryDetails.status === "available"
      ? []
      : ["npm registry facts are unavailable or malformed; channel drift and deprecation are not verified."]),
    ...(nodeSupport.status === "supported"
      ? []
      : [`Node.js does not satisfy the required Sigstore runtime range ${SIGSTORE_NODE_ENGINE_RANGE}; authority verification is blocked.`]),
  ]
  return {
    projectDir,
    node: process.version,
    npm: commandVersion("npm", ["--version"], options),
    npx: commandVersion("npx", ["--version"], options),
    opencode,
    runtimeReadiness: runtimeFindings.length === 0 ? "PASS" : "WARN",
    nodeSupport,
    runtimeFindings,
    reachability,
    packageVersion: packageVersionValue,
    registry: registryDetails.text,
    registryDetails,
    opencodeConfig: pathStatus(join(projectDir, ".opencode/opencode.json")),
    pluginPath:
      reachability.projectPluginState === "configured"
        ? "configured"
        : reachability.projectPluginState === "unreadable"
          ? "unreadable"
          : "missing",
    harnessConfig: configResult.diagnostics.length > 0
      ? "invalid"
      : pathStatus(join(projectDir, ".persona", "harness.jsonc")),
    rules: rulesScan.pathSafetyDiagnostics.length > 0
      ? "invalid"
      : rulesPath?.ok === true
        ? pathStatus(rulesPath.path)
        : "invalid",
    workflowPlan: pathStatus(join(projectDir, ".persona", "workflow", "plan.md")),
    evidence: evidenceScan?.safe === false
      ? "invalid"
      : evidencePath?.ok === true
        ? pathStatus(evidencePath.path)
        : "invalid",
    configDiagnostics: configResult.diagnostics,
    pathSafetyDiagnostics,
    entrySteeringEnabled: harnessConfig.features.entrySteering,
    entrySteeringStatus: readEntrySteeringStatusSummary(projectDir, harnessConfig),
    externalTrust,
    verificationAuthority,
    legacyDiffRulesPresent: rulesPath?.ok === true && existsSync(join(rulesPath.path, "diff-rules")),
    rulePackDiagnostics: rulePackDiagnostics.finding,
    rulePackDiagnosticCount: rulePackDiagnostics.diagnosticCount,
    rulePackDiagnosticDetails: rulePackDiagnostics.diagnostics,
    conventionPackDiagnostics: conventionPackDiagnostics.finding,
    conventionPackDiagnosticCount: conventionPackDiagnostics.diagnosticCount,
    conventionPackDiagnosticDetails: conventionPackDiagnostics.diagnostics,
    rulesFileCount: rulesScan.rulesFileCount,
    staleFixtureFindings: rulesScan.staleFixtureFindings,
  }
}

export function runDoctorCommand(args: readonly string[], options: DoctorOptions = {}): CliRunResult {
  const summary = readDoctorSummary(options)
  const status = summary.reachability.level === "BLOCK" || summary.pathSafetyDiagnostics.length > 0 ? 1 : 0
  return args.length === 1 && args[0] === "--json"
    ? { status, stdout: doctorJson(summary), stderr: "" }
    : { status, stdout: `${formatDoctorSummary(summary)}\n`, stderr: "" }
}
