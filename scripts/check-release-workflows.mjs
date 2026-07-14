import { readFile } from "node:fs/promises"

const workflowPaths = [
  ".github/workflows/ci.yml",
  ".github/workflows/publish.yml",
  ".github/workflows/release.yml",
  ".github/workflows/canonical-clean-ci-attestation-builder.yml",
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

const requirements = [
  ["ci trigger", ".github/workflows/ci.yml", (text) => text.includes("pull_request:") && text.includes("push:") && text.includes("- main")],
  ["ci checks", ".github/workflows/ci.yml", (text) => ["npm run check:release-workflows", "npm run check:docs", "npm run typecheck", "npm test", "npm run build", "npm pack --dry-run --json"].every((value) => text.includes(value))],
  ["ci no publish", ".github/workflows/ci.yml", (text) => !text.includes("npm publish")],
  ["publish canonical main", ".github/workflows/publish.yml", (text) => text.includes("canonical-main") && text.includes("refs/remotes/origin/main") && text.includes("git fetch origin main")],
  ["publish dist tags", ".github/workflows/publish.yml", (text) => text.includes("next") && text.includes("latest") && text.includes("dist-tag")],
  ["publish integrity readback", ".github/workflows/publish.yml", (text) => text.includes("dist.integrity") && text.includes("dist.shasum") && text.includes("gitHead")],
  ["release tag ancestry", ".github/workflows/release.yml", (text) => text.includes("tag-source") && text.includes("git fetch origin main") && text.includes("v*.*.*")],
  ["release idempotency", ".github/workflows/release.yml", (text) => text.includes("gh release view") && text.includes("release-state") && text.includes("--target \"$GITHUB_SHA\"")],
  ["release state fields", ".github/workflows/release.yml", (text) => text.includes("targetCommitish") && text.includes("isPrerelease") && text.includes("gh release create")],
  ["builder triggers", ".github/workflows/canonical-clean-ci-attestation-builder.yml", (text) => text.includes("workflow_call:") && text.includes("workflow_dispatch:") && text.includes("branches-ignore:") && text.includes("- main")],
  ["builder no caller inputs", ".github/workflows/canonical-clean-ci-attestation-builder.yml", (text) => !text.includes("inputs:")],
  ["builder attestation predicate", ".github/workflows/canonical-clean-ci-attestation-builder.yml", (text) => text.includes("clean-ci-builder.1") && text.includes("bundle-path")],
  ["builder least privilege", ".github/workflows/canonical-clean-ci-attestation-builder.yml", (text) => text.includes("contents: read") && text.includes("id-token: write") && text.includes("attestations: write") && text.includes("artifact-metadata: write") && !text.includes("contents: write")],
]

async function main() {
  const contents = new Map(await Promise.all(workflowPaths.map(async (path) => [path, await readFile(path, "utf8")])))
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
  if (failures.length > 0) {
    throw new Error(`Release workflow policy failed: ${failures.join(", ")}`)
  }
  console.log("Release workflow policy: PASS")
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
