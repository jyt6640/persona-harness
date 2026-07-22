#!/usr/bin/env node
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"

const CHECKOUT_PIN = "actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5"
const SETUP_NODE_PIN = "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020"

const expectedMatrixRows = [
  "ubuntu-latest:linux:22:supported",
  "ubuntu-latest:linux:24:supported",
  "macos-latest:macos:22:limited-smoke",
].sort()

const supportTable = [
  "| Linux + OpenCode | Required Node 20; manual Node 22/24 | Required Verify repository runs Linux Node 20 source-built and fresh local-tarball installed checks on pull requests and main pushes. The dispatch-only support matrix retains Linux Node 22 and 24 on demand. |",
  "| macOS + OpenCode | Manual limited smoke | The dispatch-only support matrix retains macOS Node 22 smoke only; this is not a promise of macOS Node 20/24 coverage. |",
  "| Windows | Unverified / nonblocking | No Windows matrix job or support claim. Lock identity device/inode behavior and stale-lock/concurrency conclusions are not measured or verified. |",
  "| Codex adapter | Planned | No current Codex adapter or Codex product evidence; this is a planned adapter only. |",
].join("\n")

const automaticSupportBoundary = "Automatic CI boundary: Verify repository is the required Linux Node 20 PR/main gate. The dispatch-only support matrix is deferred multi-runtime evidence, not a required PR/main gate. It is distinct from the canonical clean-CI builder's main-push signed evidence and the ordinary path-filtered diagnostic selftest."

export async function collectSupportedNodeMatrixDiagnostics(root = process.cwd()) {
  const projectRoot = resolve(root)
  const [verifyWorkflow, matrixWorkflow, readme, startHere] = await Promise.all([
    readPolicyFile(projectRoot, ".github/workflows/ci.yml"),
    readPolicyFile(projectRoot, ".github/workflows/supported-node-matrix.yml"),
    readPolicyFile(projectRoot, "README.md"),
    readPolicyFile(projectRoot, "docs/START-HERE.md"),
  ])
  const diagnostics = []

  validateVerifyWorkflow(verifyWorkflow, diagnostics)
  validateMatrixWorkflow(matrixWorkflow, diagnostics)
  validateSupportDocument("README.md", readme, diagnostics)
  validateSupportDocument("docs/START-HERE.md", startHere, diagnostics)

  return diagnostics
}

async function main() {
  const diagnostics = await collectSupportedNodeMatrixDiagnostics(process.argv[2] ?? process.cwd())

  if (diagnostics.length > 0) {
    throw new Error(`Support Node matrix policy failed: ${diagnostics.join(", ")}`)
  }

  console.log("Support Node matrix policy: PASS")
}

async function readPolicyFile(projectRoot, relativePath) {
  try {
    return await readFile(resolve(projectRoot, relativePath), "utf8")
  } catch {
    throw new Error(`Support Node matrix policy failed: missing required ${relativePath}`)
  }
}

function validateVerifyWorkflow(workflow, diagnostics) {
  const requiredCommands = [
    "npm ci",
    "node scripts/check-supported-node-matrix.mjs",
    "npm run test:repository",
    "npm run build",
    "npm pack --dry-run --json",
    'scripts/verify-supported-node-surface.mjs --surface source --expected-platform "linux" --expected-node-major "20"',
    'scripts/verify-supported-node-surface.mjs --surface installed --expected-platform "linux" --expected-node-major "20"',
  ]
  if (
    !workflow.includes("name: Verify repository")
    || !workflow.includes("runs-on: ubuntu-latest")
    || !workflow.includes("node-version: 20")
    || !requiredCommands.every((command) => workflow.includes(command))
  ) {
    diagnostics.push("Verify repository Linux Node 20 support surface")
  }
  if (
    !workflow.includes("pull_request:")
    || !workflow.includes("push:\n    branches:\n      - main")
  ) {
    diagnostics.push("Verify repository automatic triggers")
  }
  if (
    !workflow.includes("permissions:\n  contents: read")
    || workflow.includes("id-token: write")
    || workflow.includes("attestations: write")
    || workflow.includes("actions/upload-artifact@")
    || workflow.includes("npm publish")
  ) {
    diagnostics.push("Verify repository read-only boundary")
  }
}

function validateMatrixWorkflow(workflow, diagnostics) {
  const actualRows = readMatrixRows(workflow)
  if (JSON.stringify(actualRows) !== JSON.stringify(expectedMatrixRows)) {
    diagnostics.push("matrix rows")
  }
  if (workflow.toLowerCase().includes("windows")) {
    diagnostics.push("Windows matrix job")
  }
  if (
    workflow.includes("npm publish")
    || workflow.includes("actions/attest@")
    || workflow.includes("id-token: write")
    || workflow.includes("attestations: write")
  ) {
    diagnostics.push("non-support authority or publish action")
  }
  if (
    !workflow.includes("workflow_dispatch:")
    || workflow.includes("pull_request:")
    || workflow.includes("push:")
  ) {
    diagnostics.push("manual-only matrix triggers")
  }
  if (!workflow.includes("name: Support matrix / ${{ matrix.platform }} / Node ${{ matrix.node }} / ${{ matrix.coverage }}")) {
    diagnostics.push("matrix job identity")
  }
  if (!workflow.includes("npm ci") || !workflow.includes("npm run build")) {
    diagnostics.push("source build setup")
  }
  if (!workflow.includes("if: matrix.platform == 'linux'") || !workflow.includes("npm run test:repository")) {
    diagnostics.push("Linux repository checks")
  }
  if (!workflow.includes("node scripts/check-supported-node-matrix.mjs")) {
    diagnostics.push("policy check step")
  }
  if (
    !workflow.includes("scripts/verify-supported-node-surface.mjs --surface source")
    || !workflow.includes("scripts/verify-supported-node-surface.mjs --surface installed")
    || !workflow.includes('--expected-platform "${{ matrix.platform }}"')
    || !workflow.includes('--expected-node-major "${{ matrix.node }}"')
  ) {
    diagnostics.push("source or installed tarball surface")
  }
  if (
    !workflow.includes("permissions:\n  contents: read")
    || workflow.includes("contents: write")
    || workflow.includes("actions/upload-artifact@")
  ) {
    diagnostics.push("matrix read-only boundary")
  }
  if (countOccurrences(workflow, CHECKOUT_PIN) !== 1 || workflow.includes("actions/checkout@v4")) {
    diagnostics.push("immutable checkout action pin")
  }
  if (countOccurrences(workflow, SETUP_NODE_PIN) !== 1 || workflow.includes("actions/setup-node@v4")) {
    diagnostics.push("immutable setup-node action pin")
  }
}

function validateSupportDocument(path, content, diagnostics) {
  if (!content.includes(supportTable) || !content.includes(automaticSupportBoundary)) {
    diagnostics.push(`${path} support table`)
  }
}

function readMatrixRows(workflow) {
  const rows = Array.from(
    workflow.matchAll(
      /^\s*-\s+runner:\s+([a-z0-9.-]+)\s*\n\s+platform:\s+([a-z]+)\s*\n\s+node:\s+(\d+)\s*\n\s+coverage:\s+([a-z-]+)\s*$/gmu,
    ),
    (match) => `${match[1]}:${match[2]}:${match[3]}:${match[4]}`,
  )
  return rows.sort()
}

function countOccurrences(text, value) {
  return text.split(value).length - 1
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Support Node matrix policy failed")
    process.exitCode = 1
  })
}
