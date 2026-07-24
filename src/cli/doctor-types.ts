import type { HarnessConfigDiagnostic } from "../config/harness-config.js"
import type { EntrySteeringStatusSummary } from "../runtime/entry-steering-status.js"
import type { SigstoreNodeRuntimeAssessment } from "../../scripts/node-runtime-floor.mjs"
import type { ConventionPackDiagnostic } from "./convention-pack-diagnostics.js"
import type {
  DoctorCommandFinder,
  DoctorCommandRunner,
} from "./doctor-command-detection.js"
import type { DoctorReachabilitySummary } from "./doctor-reachability.js"
import type { DoctorRegistryReader } from "./doctor-registry-readback.js"
import type { DoctorRegistrySummary } from "./doctor-registry.js"
import type { FinishAttestationAssessment } from "./workflow-finish-attestation.js"
import type { VerificationAuthorityAssessment } from "./workflow-verification-receipt.js"
import type { RuleDiagnosticReportItem } from "../rules/rule-diagnostics-report.js"
import type { AuthorityStatus } from "./authority-command.js"
import type { ProjectFinishTrustReadiness } from "./project-finish-trust-readiness.js"

export type DoctorOptions = {
  readonly authorityStoreRoot?: string
  readonly consumerAuthorityInspector?: (projectDir: string) => AuthorityStatus
  readonly projectDir?: string
  readonly env?: Readonly<Record<string, string | undefined>>
  readonly platform?: NodeJS.Platform
  readonly commandFinder?: DoctorCommandFinder
  readonly commandRunner?: DoctorCommandRunner
  readonly externalTrustInspector?: (projectDir: string) => FinishAttestationAssessment
  readonly nodeVersion?: string
  readonly registryReader?: DoctorRegistryReader
  readonly sigstoreTrustInspector?: () => ProjectFinishTrustReadiness
}

export type StaleFixtureFinding = {
  readonly relativePath: string
  readonly matches: readonly string[]
}

export type DoctorExternalTrustSummary = {
  readonly availability: "missing" | "trusted" | "untrusted"
  readonly consumption: FinishAttestationAssessment["consumptionState"]
  readonly state: FinishAttestationAssessment["state"]
}

export type DoctorSummary = {
  readonly projectDir: string
  readonly node: string
  readonly npm: string
  readonly npx: string
  readonly opencode: string
  readonly runtimeReadiness: "PASS" | "WARN"
  readonly nodeSupport: SigstoreNodeRuntimeAssessment
  readonly runtimeFindings: readonly string[]
  readonly reachability: DoctorReachabilitySummary
  readonly packageVersion: string
  readonly registry: string
  readonly registryDetails: DoctorRegistrySummary
  readonly opencodeConfig: "present" | "missing"
  readonly pluginPath: "configured" | "missing" | "unreadable"
  readonly harnessConfig: "present" | "missing" | "invalid"
  readonly rules: "present" | "missing" | "invalid"
  readonly workflowPlan: "present" | "missing"
  readonly evidence: "present" | "missing" | "invalid"
  readonly configDiagnostics: readonly HarnessConfigDiagnostic[]
  readonly pathSafetyDiagnostics: readonly string[]
  readonly rulesFileCount: number
  readonly rulePackDiagnostics: "PASS" | "WARN"
  readonly rulePackDiagnosticCount: number
  readonly rulePackDiagnosticDetails: readonly RuleDiagnosticReportItem[]
  readonly conventionPackDiagnostics: "PASS" | "WARN"
  readonly conventionPackDiagnosticCount: number
  readonly conventionPackDiagnosticDetails: readonly ConventionPackDiagnostic[]
  readonly staleFixtureFindings: readonly StaleFixtureFinding[]
  readonly legacyDiffRulesPresent: boolean
  readonly entrySteeringEnabled: boolean
  readonly entrySteeringStatus: EntrySteeringStatusSummary
  readonly externalTrust: DoctorExternalTrustSummary
  readonly consumerAuthority: AuthorityStatus
  readonly sigstoreTrust: ProjectFinishTrustReadiness
  readonly verificationAuthority: VerificationAuthorityAssessment
}
