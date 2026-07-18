import {
  readProjectFinishAttestationBuild,
  readProjectFinishAttestationGradle,
  readProjectFinishAttestationTest,
} from "./project-finish-attestation-receipt-execution.js"
import {
  readProjectFinishAttestationLifecycle,
  readProjectFinishAttestationProject,
  readProjectFinishAttestationRepository,
  readProjectFinishAttestationSource,
  readProjectFinishAttestationWorkflow,
} from "./project-finish-attestation-receipt-context.js"
import {
  PROJECT_FINISH_ATTESTATION_POLICY,
  PROJECT_FINISH_ATTESTATION_SCHEMA,
  type ProjectFinishAttestationDiagnostic,
  type ProjectFinishAttestationReceipt,
} from "./project-finish-attestation-types.js"
import {
  exactKeys,
  isIdentifier,
  isRecord,
} from "./workflow-finish-attestation-receipt-fields.js"

export function readProjectFinishAttestationReceipt(
  value: unknown,
  diagnostics: ProjectFinishAttestationDiagnostic[],
): ProjectFinishAttestationReceipt | undefined {
  const expectedKeys = [
    "build",
    "event",
    "gradle",
    "lifecycle",
    "phVersion",
    "policyMarker",
    "project",
    "ref",
    "repository",
    "schemaVersion",
    "source",
    "test",
    "workflow",
  ] as const
  if (!isRecord(value) || !exactKeys(value, expectedKeys)) {
    diagnostics.push({ code: "invalid-field", path: "predicate.receipt" })
    return undefined
  }
  if (
    value.event !== PROJECT_FINISH_ATTESTATION_POLICY.event
    || value.policyMarker !== PROJECT_FINISH_ATTESTATION_POLICY.policyMarker
    || value.ref !== PROJECT_FINISH_ATTESTATION_POLICY.ref
    || value.schemaVersion !== PROJECT_FINISH_ATTESTATION_SCHEMA
    || !isIdentifier(value.phVersion)
  ) {
    diagnostics.push({ code: "wrong-policy", path: "predicate.receipt" })
    return undefined
  }
  const repository = readProjectFinishAttestationRepository(value.repository, diagnostics)
  const source = readProjectFinishAttestationSource(value.source, diagnostics)
  const project = readProjectFinishAttestationProject(value.project, diagnostics)
  const gradle = readProjectFinishAttestationGradle(value.gradle, diagnostics)
  const test = readProjectFinishAttestationTest(value.test, diagnostics)
  const build = readProjectFinishAttestationBuild(value.build, diagnostics)
  const lifecycle = readProjectFinishAttestationLifecycle(value.lifecycle, diagnostics)
  if (
    repository === undefined
    || source === undefined
    || project === undefined
    || gradle === undefined
    || test === undefined
    || build === undefined
    || lifecycle === undefined
  ) {
    return undefined
  }
  const workflow = readProjectFinishAttestationWorkflow(
    value.workflow,
    {
      lifecycle,
      repositorySlug: repository.slug,
      sourceHead: source.head,
    },
    diagnostics,
  )
  if (workflow === undefined) return undefined
  return {
    build,
    event: "push",
    gradle,
    lifecycle,
    phVersion: value.phVersion,
    policyMarker: PROJECT_FINISH_ATTESTATION_POLICY.policyMarker,
    project,
    ref: "refs/heads/main",
    repository,
    schemaVersion: PROJECT_FINISH_ATTESTATION_SCHEMA,
    source,
    test,
    workflow,
  }
}
