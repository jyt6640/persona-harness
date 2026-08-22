const workflowInputs = [
  ["ciWorkflow", ".github/workflows/ci.yml"],
  ["publishWorkflow", ".github/workflows/publish.yml"],
  ["releaseWorkflow", ".github/workflows/release.yml"],
  ["canonicalBuilderWorkflow", ".github/workflows/canonical-clean-ci-attestation-builder.yml"],
  ["projectFinishWorkflow", ".github/workflows/persona-harness-project-finish.yml"],
  ["contextDiagnosticWorkflow", ".github/workflows/persona-harness-project-finish-context-diagnostic.yml"],
  ["contextDiagnosticSelftestWorkflow", ".github/workflows/project-finish-context-diagnostic-selftest.yml"],
  ["stagedArtifactWorkflow", ".github/workflows/staged-package-artifact-attestation.yml"],
  ["stagedProducerContextWorkflow", ".github/workflows/staged-producer-context-diagnostic.yml"],
  ["productionAuditWorkflow", ".github/workflows/production-integrity-audit.yml"],
]

const supportInputs = [
  ["contextActionMetadata", ".github/actions/project-finish-context-diagnostic/action.yml"],
  ["contextActionEntrypoint", ".github/actions/project-finish-context-diagnostic/index.mjs"],
  ["contextActionBridge", ".github/actions/project-finish-context-diagnostic/oidc-capability-bridge.cjs"],
  ["contextActionBridgeSummary", ".github/actions/project-finish-context-diagnostic/oidc-capability-bridge-summary.cjs"],
  ["selftestActionMetadata", ".github/actions/project-finish-context-diagnostic-selftest/action.yml"],
  ["selftestActionEntrypoint", ".github/actions/project-finish-context-diagnostic-selftest/index.mjs"],
  ["selftestCore", ".github/actions/project-finish-context-diagnostic-selftest/selftest.mjs"],
  ["nativeSelftestActionMetadata", ".github/actions/project-finish-context-diagnostic-native-selftest/action.yml"],
  ["nativeSelftestActionEntrypoint", ".github/actions/project-finish-context-diagnostic-native-selftest/index.mjs"],
  ["nativeSelftestCore", ".github/actions/project-finish-context-diagnostic-native-selftest/native-selftest.mjs"],
  ["nativeSelftestRuntime", ".github/actions/project-finish-context-diagnostic-selftest/native.mjs"],
  ["fallbackActionMetadata", ".github/actions/project-finish-context-diagnostic-fallback/action.yml"],
  ["fallbackActionEntrypoint", ".github/actions/project-finish-context-diagnostic-fallback/index.mjs"],
  ["finalizerActionMetadata", ".github/actions/project-finish-context-diagnostic-finalizer/action.yml"],
  ["finalizerActionEntrypoint", ".github/actions/project-finish-context-diagnostic-finalizer/index.mjs"],
  ["observerGhProvisioner", ".github/scripts/prepare-observer-gh-tool.mjs"],
  ["observerGhSelector", "scripts/consumer-authority-observer-gh-workflow-selector.mjs"],
  ["observerGhPackageRecord", "scripts/consumer-authority-observer-gh-package-record.mjs"],
  ["observerGhTool", "scripts/consumer-authority-observer-gh-tool.mjs"],
  ["packageManifest", "package.json"],
  ["v0824AcceptanceManifest", "docs/current/release/consumer-authority-v0824-acceptance.json"],
]

export const RELEASE_WORKFLOW_CHECKER_INPUTS = Object.freeze([
  ...workflowInputs,
  ...supportInputs,
].map(([name, path]) => Object.freeze({ name, path })))

export const RELEASE_WORKFLOW_CHECKER_RUNTIME_FILES = Object.freeze([
  "scripts/check-release-workflows.mjs",
  "scripts/release-workflow-checker-inputs.mjs",
])

export function releaseWorkflowCheckerWorkflowPaths() {
  return workflowInputs.map(([, path]) => path)
}

export function releaseWorkflowCheckerInputName(path) {
  const input = RELEASE_WORKFLOW_CHECKER_INPUTS.find((candidate) => candidate.path === path)
  if (input === undefined) throw new Error("release-workflow-checker-input")
  return input.name
}

export function releaseWorkflowCheckerFixturePaths() {
  return [
    ...RELEASE_WORKFLOW_CHECKER_RUNTIME_FILES,
    ...RELEASE_WORKFLOW_CHECKER_INPUTS.map(({ path }) => path),
  ]
}
