import {
  loadHarnessConfigResult,
  resolveConfiguredPathResult,
} from "../config/harness-config.js"
import type { ConventionPackDiagnostic } from "./convention-pack-diagnostics.js"
import type { DoctorSummary } from "./doctor-types.js"
import type { RuleDiagnosticReportItem } from "../rules/rule-diagnostics-report.js"

export function formatDoctorSummary(summary: DoctorSummary): string {
  const config = loadHarnessConfigResult(summary.projectDir)
  const rulesRoot = configuredRootDisplay(summary.projectDir, config.config.rulesDir)
  const evidenceRoot = configuredRootDisplay(summary.projectDir, config.config.evidenceDir)
  const staleStatus = summary.staleFixtureFindings.length === 0 ? "PASS" : `WARN (${summary.staleFixtureFindings.length} findings)`
  const staleDetails =
    summary.staleFixtureFindings.length === 0
      ? []
      : [
          "",
          "Stale fixture findings:",
          ...summary.staleFixtureFindings.map(
            (finding) => `- ${finding.relativePath}: ${finding.matches.join(", ")}`,
          ),
        ]
  const rulePackDetails =
    summary.rulePackDiagnosticDetails.length === 0
      ? []
      : [
          "",
          "Rule pack diagnostic details:",
          ...summary.rulePackDiagnosticDetails.map(formatRulePackDiagnostic),
        ]
  const conventionPackDetails =
    summary.conventionPackDiagnosticDetails.length === 0
      ? []
      : [
          "",
          "Convention pack diagnostic details:",
          ...summary.conventionPackDiagnosticDetails.map(formatConventionPackDiagnostic),
        ]
  const legacyDiffRulesDetails =
    summary.legacyDiffRulesPresent
      ? [
          "",
          "Legacy package material:",
          "- .persona/rules/diff-rules/: legacy/unneeded package material from an older Persona Harness install; it is no longer shipped or required. Persona Harness leaves user files untouched; remove it manually only after review.",
        ]
      : []
  const pathSafetyDetails =
    summary.pathSafetyDiagnostics.length === 0
      ? []
      : [
          "",
          "Config/path safety:",
          "- BLOCK: configured paths are read-only inspected with no-follow traversal and bounded limits.",
          ...summary.pathSafetyDiagnostics.map((diagnostic) => `- ${diagnostic}`),
        ]
  return [
    "Persona Harness Doctor",
    "",
    "Project: local workspace (path redacted)",
    `Node: ${summary.node}`,
    `npm: ${summary.npm}`,
    `npx: ${summary.npx}`,
    `OpenCode: ${summary.opencode}`,
    `Node support: ${summary.nodeSupport.status === "supported" ? "PASS" : "BLOCKED"} (${summary.nodeSupport.requiredRange})`,
    `Runtime readiness: ${summary.runtimeReadiness}`,
    ...summary.runtimeFindings.map((finding) => `- ${finding}`),
    `Session reachability: ${summary.reachability.level}`,
    `AGENTS.md steering: ${summary.reachability.agentsState}`,
    `Project-local OpenCode plugin registration: ${summary.reachability.projectPluginState}`,
    `PH-run verification: ${summary.reachability.executeVerification ? "ON" : "OFF"}`,
    `Entry steering: ${summary.entrySteeringEnabled ? "ON (default-off opt-in)" : "OFF"}`,
    `Entry steering decisions: ${summary.entrySteeringStatus.decisions}`,
    `Entry steering fired: ${summary.entrySteeringStatus.fired}`,
    `Entry steering invalid records: ${summary.entrySteeringStatus.invalidRecords}`,
    `Verification receipt authority: ${summary.verificationAuthority.state} (read-only; no receipt grants finish authority)`,
    `Verification receipt diagnostics: ${summary.verificationAuthority.summary}`,
    `Legacy evidence records: ${summary.verificationAuthority.legacyEvidence.files.length} (diagnostic-only; no automatic migration)`,
    `External assurance readiness: ${summary.externalTrust.availability.toUpperCase()} (${summary.externalTrust.state}; ${summary.externalTrust.consumption}; read-only)`,
    `Consumer authority: ${summary.consumerAuthority.authorityEligible ? "TRUSTED" : "BLOCKED"} (${summary.consumerAuthority.state}; ${summary.consumerAuthority.consumptionState}; read-only)`,
    `Consumer authority next: ${summary.consumerAuthority.next}`,
    `Sigstore network readiness: ${summary.sigstoreTrust.networkReadiness.toUpperCase()} (${summary.sigstoreTrust.state})`,
    `Sigstore trust-root readiness: ${summary.sigstoreTrust.trustRootReadiness.toUpperCase()} (${summary.sigstoreTrust.state}; live no-cache check)`,
    ...summary.reachability.findings.map((finding) => `- [${finding.level}] ${finding.message}`),
    ...summary.reachability.followUpLines,
    `Persona package version: ${summary.packageVersion}`,
    `Registry status: ${summary.registryDetails.status}`,
    `Installed channel: ${summary.registryDetails.channels.installed}`,
    `Latest channel: ${summary.registryDetails.channels.latest} (${summary.registryDetails.channelStates.latest})`,
    `Next channel: ${summary.registryDetails.channels.next} (${summary.registryDetails.channelStates.next})`,
    `Staging channel: ${summary.registryDetails.channels.staging} (${summary.registryDetails.channelStates.staging})`,
    `Legacy channel: ${summary.registryDetails.channels.legacy} (${summary.registryDetails.channelStates.legacy})`,
    `Installed deprecation: ${summary.registryDetails.deprecation}`,
    `Registry diagnostics: ${summary.registryDetails.diagnostics.length === 0 ? "none" : summary.registryDetails.diagnostics.join(", ")}`,
    `Finish authority: ${summary.verificationAuthority.authorityEligible ? "ELIGIBLE" : "BLOCKED"}`,
    `npm registry: ${summary.registry} (read-only; channels are not authority)`,
    "",
    "Project integration:",
    `.opencode/opencode.json: ${summary.opencodeConfig}`,
    `Persona plugin path: ${summary.pluginPath}`,
    `.persona/harness.jsonc: ${summary.harnessConfig}`,
    `.persona/rules: ${summary.rules}`,
    `Rules root: ${rulesRoot}`,
    `Evidence root: ${evidenceRoot}`,
    `.persona/workflow/plan.md: ${summary.workflowPlan}`,
    `Rules surface: ${summary.rulesFileCount} files`,
    "",
    "Rule pack diagnostics:",
    `Rules: ${summary.rulePackDiagnostics} (${summary.rulePackDiagnosticCount} diagnostics)`,
    `Conventions: ${summary.conventionPackDiagnostics} (${summary.conventionPackDiagnosticCount} diagnostics)`,
    "Pack diagnostics are report-only; they do not block existing workflow gates.",
    ...rulePackDetails,
    ...conventionPackDetails,
    `Stale fixture scan: ${staleStatus}`,
    ...staleDetails,
    ...pathSafetyDetails,
    ...legacyDiffRulesDetails,
    "",
    "Scope:",
    "- local install / tarball install diagnostics",
    "- no generated app product-quality certification",
  ].join("\n")
}

export function doctorJson(summary: DoctorSummary): string {
  const config = loadHarnessConfigResult(summary.projectDir)
  return `${JSON.stringify({
    authority: {
      consumer: summary.consumerAuthority,
      external: summary.externalTrust,
      finish: summary.verificationAuthority.authorityEligible ? "eligible" : "blocked",
      receipt: "diagnostic-only",
    },
    preview: {
      entrySteering: summary.entrySteeringEnabled,
      runtimeInjection: config.config.features.runtimeInjection,
    },
    privacy: {
      diagnostics: "bounded",
      evidence: config.config.evidenceMode,
    },
    reachability: {
      agents: summary.reachability.agentsState,
      level: summary.reachability.level,
      plugin: summary.reachability.projectPluginState,
    },
    registry: summary.registryDetails,
    sigstore: summary.sigstoreTrust,
    runtime: {
      nodeSupport: summary.nodeSupport,
    },
    runtimeReadiness: summary.runtimeReadiness,
    schemaVersion: "doctor.1",
  }, null, 2)}\n`
}

function formatRulePackDiagnostic(item: RuleDiagnosticReportItem): string {
  const field = item.diagnostic.field === undefined ? "-" : item.diagnostic.field
  return `- ${item.path} [${item.diagnostic.code}/${field}]: ${item.diagnostic.message}`
}

function formatConventionPackDiagnostic(item: ConventionPackDiagnostic): string {
  const field = item.field === undefined ? "-" : item.field
  return `- ${item.path} [${item.code}/${field}]: ${item.message}`
}

function configuredRootDisplay(projectDir: string, configuredPath: string): string {
  const configResult = loadHarnessConfigResult(projectDir)
  if (!configResult.safe) {
    return "unavailable"
  }
  const result = resolveConfiguredPathResult(projectDir, configuredPath)
  return result.ok ? result.relativePath : "unavailable"
}
