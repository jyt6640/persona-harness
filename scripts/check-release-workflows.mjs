import { readFile } from "node:fs/promises"

const workflowPaths = [
  ".github/workflows/ci.yml",
  ".github/workflows/publish.yml",
  ".github/workflows/release.yml",
  ".github/workflows/canonical-clean-ci-attestation-builder.yml",
  ".github/workflows/persona-harness-project-finish.yml",
  ".github/workflows/persona-harness-project-finish-context-diagnostic.yml",
  ".github/workflows/staged-package-artifact-attestation.yml",
  ".github/workflows/staged-producer-context-diagnostic.yml",
  ".github/workflows/production-integrity-audit.yml",
]

const immutableActionPins = {
  attest: "actions/attest@ce27ba3b4a9a139d9a20a4a07d69fabb52f1e5bc",
  checkout: "actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5",
  setupNode: "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020",
  uploadArtifact: "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02",
}

const expectedActionCounts = {
  ".github/workflows/ci.yml": { checkout: 1, setupNode: 1 },
  ".github/workflows/publish.yml": { checkout: 1, setupNode: 1 },
  ".github/workflows/release.yml": { checkout: 2, setupNode: 2 },
  ".github/workflows/canonical-clean-ci-attestation-builder.yml": {
    attest: 1,
    checkout: 1,
    setupNode: 1,
    uploadArtifact: 2,
  },
  ".github/workflows/persona-harness-project-finish.yml": {
    attest: 1,
    checkout: 2,
    setupNode: 1,
    uploadArtifact: 2,
  },
  ".github/workflows/persona-harness-project-finish-context-diagnostic.yml": {
    checkout: 3,
    uploadArtifact: 1,
  },
  ".github/workflows/staged-package-artifact-attestation.yml": {
    attest: 1,
    checkout: 2,
    setupNode: 1,
    uploadArtifact: 1,
  },
  ".github/workflows/staged-producer-context-diagnostic.yml": {
    checkout: 1,
  },
  ".github/workflows/production-integrity-audit.yml": {
    checkout: 1,
    setupNode: 1,
    uploadArtifact: 1,
  },
}

function countOccurrences(text, value) {
  return text.split(value).length - 1
}

function hasImmutableActionPins(path, text) {
  const expected = expectedActionCounts[path]
  if (expected === undefined) return false
  return Object.entries(immutableActionPins).every(([name, pin]) => {
    const expectedCount = expected[name] ?? 0
    return countOccurrences(text, pin) === expectedCount
  }) && !/actions\/(?:attest|checkout|setup-node|upload-artifact)@v\d+\b/.test(text)
}

function hasContextDiagnosticSafeRuntime(text) {
  const resolveStart = text.indexOf("  resolve:")
  const diagnoseStart = text.indexOf("  diagnose:")
  const resolve = resolveStart >= 0 && diagnoseStart > resolveStart ? text.slice(resolveStart, diagnoseStart) : ""
  const diagnose = diagnoseStart >= 0 ? text.slice(diagnoseStart) : ""
  return resolve.length > 0
    && diagnose.length > 0
    && !resolve.includes("id-token:")
    && diagnose.includes("id-token: write")
    && !/\n\s+run:/u.test(diagnose)
}

function hasContextDiagnosticSummaryBootstrap(text) {
  const bootstrap = text.indexOf('summary.write(failureSummary("bootstrap"))')
  const evaluatorImport = text.indexOf('await import("../../../scripts/diagnose-project-finish-producer-context.mjs")')
  return text.includes('SUMMARY_SCHEMA = "project-finish-attestation-context-diagnostic-summary.1"')
    && bootstrap >= 0
    && evaluatorImport > bootstrap
    && text.includes('failureSummary("runtime-load")')
    && text.includes('failureSummary("runtime")')
    && !text.includes('import { runProjectFinishProducerContextDiagnostic')
    && !text.includes("node_modules")
    && !text.includes("npm install")
}

const requirements = [
  ["ci trigger", ".github/workflows/ci.yml", (text) => text.includes("pull_request:") && text.includes("push:") && text.includes("- main")],
  ["ci checks", ".github/workflows/ci.yml", (text) => ["npm run check:release-workflows", "npm run check:docs", "npm run typecheck", "npm run test:repository", "npm run build", "npm pack --dry-run --json"].every((value) => text.includes(value))],
  ["publish repository tests", ".github/workflows/publish.yml", (text) => text.includes("npm run test:repository")],
  ["release repository tests", ".github/workflows/release.yml", (text) => text.includes("npm run test:repository")],
  ["ci no publish", ".github/workflows/ci.yml", (text) => !text.includes("npm publish")],
  ["publish canonical main", ".github/workflows/publish.yml", (text) => text.includes("canonical-main") && text.includes("refs/remotes/origin/main") && text.includes("git fetch origin main")],
  ["publish staging approval", ".github/workflows/publish.yml", (text) => text.includes("          - staging") && text.includes("          - next") && text.includes("          - latest") && text.includes("          - staging-only") && text.includes("          - next-promotion-approved") && text.includes("          - ga-approved") && text.includes("approval_scope:") && text.includes('--approval-scope "$APPROVAL_SCOPE"')],
  ["publish no automatic tag movement", ".github/workflows/publish.yml", (text) => !text.includes("git tag") && !text.includes("git push")],
  ["publish integrity readback", ".github/workflows/publish.yml", (text) => text.includes("dist.integrity") && text.includes("dist.shasum") && text.includes("gitHead")],
  ["release manual approval", ".github/workflows/release.yml", (text) => text.includes("workflow_dispatch:") && text.includes("approval_scope:") && text.includes("          - ga-approved") && text.includes("inputs.approval_scope == 'ga-approved'") && text.includes("tag-source") && text.includes("git fetch origin main") && !text.includes("\n  push:") && !text.includes("tags:\n")],
  ["release idempotency", ".github/workflows/release.yml", (text) => text.includes("gh release view") && text.includes("release-state") && text.includes("--target \"$tag_commit\"")],
  ["release state fields", ".github/workflows/release.yml", (text) => text.includes("targetCommitish") && text.includes("isPrerelease") && text.includes("gh release create") && text.includes("--expected-prerelease false")],
  ["builder triggers", ".github/workflows/canonical-clean-ci-attestation-builder.yml", (text) => text.includes("  push:\n    branches:\n      - main") && !text.includes("workflow_call:") && !text.includes("workflow_dispatch:") && !text.includes("branches-ignore:")],
  ["builder no caller inputs", ".github/workflows/canonical-clean-ci-attestation-builder.yml", (text) => !text.includes("inputs:")],
  ["builder attestation predicate", ".github/workflows/canonical-clean-ci-attestation-builder.yml", (text) => text.includes("finish-attestation.1") && text.includes("bundle-path")],
  ["builder producer-only boundary", ".github/workflows/canonical-clean-ci-attestation-builder.yml", (text) => text.includes("Build canonical clean CI finish attestation") && !text.includes("workflow finish") && !text.includes("workflow-finish-authority")],
  ["builder least privilege", ".github/workflows/canonical-clean-ci-attestation-builder.yml", (text) => text.includes("contents: read") && text.includes("id-token: write") && text.includes("attestations: write") && text.includes("artifact-metadata: write") && !text.includes("contents: write")],
  ["builder failure artifact", ".github/workflows/canonical-clean-ci-attestation-builder.yml", (text) => text.includes("if: always()") && text.includes("failure-diagnostic.json") && text.includes("canonical-clean-ci-attestation-builder-failure") && text.includes("if-no-files-found: ignore")],
  ["project finish attester trigger", ".github/workflows/persona-harness-project-finish.yml", (text) => text.includes("workflow_call:") && !text.includes("inputs:") && !text.includes("workflow_dispatch:") && !text.includes("pull_request:") && !text.includes("push:")],
  ["project finish attester public push policy", ".github/workflows/persona-harness-project-finish.yml", (text) => text.includes("github.event_name == 'push'") && text.includes("github.ref == 'refs/heads/main'") && text.includes("github.event.repository.private == false") && text.includes("git fetch origin main") && text.includes("git status --porcelain=v1")],
  ["project finish attester reusable binding", ".github/workflows/persona-harness-project-finish.yml", (text) => text.includes("repository: jyt6640/persona-harness") && text.includes("id: producer-pin") && text.includes("CALLER_WORKFLOW_REF: ${{ github.workflow_ref }}") && text.includes("structuredJobs") && text.includes("ref: ${{ steps.producer-pin.outputs.sha }}") && text.includes("PERSONA_HARNESS_PRODUCER_SHA") && text.includes("working-directory: .persona-harness-producer") && text.includes("node scripts/verify-project-finish-producer-checkout.mjs") && !text.includes("ref: ${{ github.workflow_sha }}") && !text.includes("ruby <<") && text.includes("build-project-finish-attestation.mjs")],
  ["project finish attester subject", ".github/workflows/persona-harness-project-finish.yml", (text) => text.includes("project-finish-attestation.1") && text.includes("subject-path: .ci/project-finish-attestation/receipt.json") && text.includes("predicate-path: .ci/project-finish-attestation/predicate.json")],
  ["project finish attester boundary", ".github/workflows/persona-harness-project-finish.yml", (text) => !text.includes("npm publish") && !text.includes("git tag") && !text.includes("git push") && !text.includes("workflow finish") && text.includes("failure-diagnostic.json") && text.includes("if: always()") && text.includes("contents: read") && text.includes("id-token: write") && text.includes("attestations: write") && text.includes("artifact-metadata: write") && !text.includes("contents: write")],
  ["project finish context diagnostic trigger", ".github/workflows/persona-harness-project-finish-context-diagnostic.yml", (text) => text.includes("workflow_call:") && !text.includes("inputs:") && !text.includes("workflow_dispatch:") && !text.includes("pull_request:") && !text.includes("push:")],
  ["project finish context diagnostic public push policy", ".github/workflows/persona-harness-project-finish-context-diagnostic.yml", (text) => text.includes("github.event_name == 'push'") && text.includes("github.ref == 'refs/heads/main'") && text.includes("github.event.repository.private == false") && text.includes("git fetch origin main") && text.includes("git status --porcelain=v1")],
  ["project finish context diagnostic fixed binding", ".github/workflows/persona-harness-project-finish-context-diagnostic.yml", (text) => text.includes("persona-harness-project-finish-context-diagnostic.yml") && text.includes("CALLER_WORKFLOW_REF: ${{ github.workflow_ref }}") && text.includes("matching.length !== 1") && !text.includes("GITHUB_JOB:") && text.includes("ref: ${{ steps.producer-pin.outputs.sha }}") && text.includes("PERSONA_HARNESS_PRODUCER_SHA") && text.includes("node scripts/verify-project-finish-producer-checkout.mjs") && text.includes("needs.resolve.outputs.producer-sha") && text.includes("needs.resolve.outputs.producer-checkout") && text.includes("uses: ./.persona-harness-producer/.github/actions/project-finish-context-diagnostic") && text.includes("diagnostic-caller-workflow-ref: ${{ github.workflow_ref }}") && text.includes("diagnostic-caller-workflow-sha: ${{ github.workflow_sha }}") && text.includes("diagnostic-reusable-workflow-ref: jyt6640/persona-harness/.github/workflows/persona-harness-project-finish-context-diagnostic.yml@refs/heads/main") && !text.includes("command -v node") && !text.includes("env -i") && !text.includes("Setup diagnostic Node") && hasContextDiagnosticSafeRuntime(text)],
  ["project finish context diagnostic boundary", ".github/workflows/persona-harness-project-finish-context-diagnostic.yml", (text) => text.includes("contents: read") && text.includes("id-token: write") && text.includes("project-finish-attestation-context-diagnostic") && text.includes("summary.json") && !text.includes("contents: write") && !text.includes("attestations:") && !text.includes("artifact-metadata:") && !text.includes("actions/attest") && !text.includes("npm ") && !text.includes("build-project-finish-attestation.mjs") && !text.includes("receipt.json") && !text.includes("predicate.json") && !text.includes("git tag") && !text.includes("git push") && !text.includes("workflow finish")],
  ["staged artifact attester trigger", ".github/workflows/staged-package-artifact-attestation.yml", (text) => text.includes("workflow_dispatch:") && !text.includes("workflow_call:") && !text.includes("pull_request:") && !text.includes("push:")],
  ["staged artifact attester fixed inputs", ".github/workflows/staged-package-artifact-attestation.yml", (text) => text.includes("mode:") && text.includes("channel:") && text.includes("version:") && text.includes("          - produce") && text.includes("          - diagnose") && text.includes("          - staging") && text.includes("          - next") && !text.includes("registry_url:") && !text.includes("package_name:") && !text.includes("source_head:")],
  ["staged artifact attester source policy", ".github/workflows/staged-package-artifact-attestation.yml", (text) => text.includes("github.repository == 'jyt6640/persona-harness'") && text.includes("github.ref == 'refs/heads/main'") && text.includes("git fetch origin main") && text.includes("git status --porcelain=v1")],
  ["staged artifact attester subject", ".github/workflows/staged-package-artifact-attestation.yml", (text) => text.includes("staged-package-artifact-binding.1") && text.includes("subject-path: .ci/staged-package-artifact-attestation/package.tgz") && !text.includes("subject-path: .ci/staged-package-artifact-attestation/predicate.json")],
  ["staged artifact attester producer-only boundary", ".github/workflows/staged-package-artifact-attestation.yml", (text) => !text.includes("npm publish") && !text.includes("git tag") && !text.includes("git push") && !text.includes("workflow finish")],
  ["staged artifact attester least privilege", ".github/workflows/staged-package-artifact-attestation.yml", (text) => text.includes("  diagnose:") && text.includes("inputs.mode == 'diagnose'") && text.includes("node scripts/diagnose-native-staged-package-artifact-context.mjs") && text.includes("  attest:") && text.includes("inputs.mode == 'produce'") && text.includes("contents: read") && text.includes("id-token: write") && text.includes("attestations: write") && text.includes("artifact-metadata: write") && !text.includes("contents: write")],
  ["staged artifact attester diagnostic isolation", ".github/workflows/staged-package-artifact-attestation.yml", (text) => {
    const diagnoseStart = text.indexOf("  diagnose:")
    const attestStart = text.indexOf("  attest:")
    const diagnose = diagnoseStart >= 0 && attestStart > diagnoseStart ? text.slice(diagnoseStart, attestStart) : ""
    return diagnose.includes("permissions:\n      contents: read") && !diagnose.includes("id-token:") && !diagnose.includes("attestations:") && !diagnose.includes("artifact-metadata:") && !diagnose.includes("actions/attest") && !diagnose.includes("actions/upload-artifact") && !diagnose.includes("build-staged-package-artifact-attestation") && !diagnose.includes(".ci/staged-package-artifact-attestation") && !diagnose.includes("npm ") && !diagnose.includes("registry") && !diagnose.includes("git tag") && !diagnose.includes("git push")
  }],
  ["staged producer context diagnostic trigger", ".github/workflows/staged-producer-context-diagnostic.yml", (text) => text.includes("workflow_dispatch:") && !text.includes("inputs:") && !text.includes("workflow_call:") && !text.includes("pull_request:") && !text.includes("push:")],
  ["staged producer context diagnostic protected main", ".github/workflows/staged-producer-context-diagnostic.yml", (text) => text.includes("github.repository == 'jyt6640/persona-harness'") && text.includes("github.ref == 'refs/heads/main'") && text.includes("runs-on: ubuntu-latest")],
  ["staged producer context diagnostic no signing or registry", ".github/workflows/staged-producer-context-diagnostic.yml", (text) => text.includes("node scripts/diagnose-staged-package-artifact-context.mjs") && !text.includes("id-token:") && !text.includes("attestations:") && !text.includes("artifact-metadata:") && !text.includes("actions/attest") && !text.includes("actions/upload-artifact") && !text.includes("npm ") && !text.includes("registry") && !text.includes("git tag") && !text.includes("git push")],
  ["staged producer context diagnostic least privilege", ".github/workflows/staged-producer-context-diagnostic.yml", (text) => text.includes("contents: read") && !text.includes("contents: write")],
  ["production audit dispatch only", ".github/workflows/production-integrity-audit.yml", (text) => text.includes("workflow_dispatch:") && !text.includes("inputs:") && !text.includes("pull_request:") && !text.includes("push:")],
  ["production audit protected main", ".github/workflows/production-integrity-audit.yml", (text) => text.includes("github.repository == 'jyt6640/persona-harness'") && text.includes("github.ref == 'refs/heads/main'") && text.includes("contents: read") && !text.includes("contents: write") && !text.includes("id-token:") && !text.includes("attestations:")],
  ["production audit fixed read-only route", ".github/workflows/production-integrity-audit.yml", (text) => text.includes("node scripts/run-production-integrity-audit.mjs") && text.includes("if: always()") && text.includes("production-integrity-audit-summary") && text.includes(".ci/production-integrity-audit/summary.json") && !text.includes("npm publish") && !text.includes("git tag") && !text.includes("git push") && !text.includes("gh release") && !text.includes("workflow finish")],
]

async function main() {
  const contents = new Map(await Promise.all(workflowPaths.map(async (path) => [path, await readFile(path, "utf8")])))
  const [contextActionMetadata, contextActionEntrypoint] = await Promise.all([
    readFile(".github/actions/project-finish-context-diagnostic/action.yml", "utf8"),
    readFile(".github/actions/project-finish-context-diagnostic/index.mjs", "utf8"),
  ])
  const failures = []
  for (const [name, path, predicate] of requirements) {
    const text = contents.get(path)
    if (text === undefined || !predicate(text)) {
      failures.push(`${name} (${path})`)
    }
  }
  for (const path of workflowPaths) {
    if (!hasImmutableActionPins(path, contents.get(path) ?? "")) {
      failures.push(`immutable action pin (${path})`)
    }
  }
  for (const [path, text] of contents) {
    if (text.includes("pull_request_target")) {
      failures.push(`forbidden pull_request_target (${path})`)
    }
  }
  if (
    !contextActionMetadata.includes("using: node20")
    || !contextActionMetadata.includes("main: index.mjs")
    || contextActionMetadata.includes("using: composite")
    || contextActionMetadata.includes("run:")
    || contextActionEntrypoint.includes("node:child_process")
    || contextActionEntrypoint.includes("process.env.PATH")
    || !hasContextDiagnosticSummaryBootstrap(contextActionEntrypoint)
  ) {
    failures.push("project finish context diagnostic local runtime")
  }
  if (failures.length > 0) {
    throw new Error(`Release workflow policy failed: ${failures.join(", ")}`)
  }
  console.log("Release workflow policy: PASS")
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
