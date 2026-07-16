#!/usr/bin/env node
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

const projectRoot = resolve(process.argv[2] ?? process.cwd())

const CHECKOUT_PIN = "actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5"
const SETUP_NODE_PIN = "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020"

const expectedRows = [
  "ubuntu-latest:linux:20:supported",
  "ubuntu-latest:linux:22:supported",
  "ubuntu-latest:linux:24:supported",
  "macos-latest:macos:22:limited-smoke",
].sort()

const supportTable = [
  "| Linux + OpenCode | Supported matrix | Node 20, 22, and 24 each run source-built checks plus a fresh local-tarball installed black-box check. |",
  "| macOS + OpenCode | Limited smoke | macOS Node 22 smoke only; this is not a promise of macOS Node 20/24 coverage. |",
  "| Windows | Unverified / nonblocking | No Windows matrix job or support claim. Lock identity device/inode behavior and stale-lock/concurrency conclusions are not measured or verified. |",
  "| Codex adapter | Planned | No current Codex adapter or Codex product evidence; this is a planned adapter only. |",
].join("\n")

async function main() {
  const [workflow, readme, startHere] = await Promise.all([
    readPolicyFile(".github/workflows/supported-node-matrix.yml"),
    readPolicyFile("README.md"),
    readPolicyFile("docs/START-HERE.md"),
  ])
  const diagnostics = []

  validateWorkflow(workflow, diagnostics)
  validateSupportDocument("README.md", readme, diagnostics)
  validateSupportDocument("docs/START-HERE.md", startHere, diagnostics)

  if (diagnostics.length > 0) {
    throw new Error(`Support Node matrix policy failed: ${diagnostics.join(", ")}`)
  }

  console.log("Support Node matrix policy: PASS")
}

async function readPolicyFile(relativePath) {
  try {
    return await readFile(resolve(projectRoot, relativePath), "utf8")
  } catch {
    throw new Error(`Support Node matrix policy failed: missing required ${relativePath}`)
  }
}

function validateWorkflow(workflow, diagnostics) {
  const actualRows = readMatrixRows(workflow)
  if (JSON.stringify(actualRows) !== JSON.stringify(expectedRows)) {
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
    !workflow.includes("pull_request:")
    || !workflow.includes("push:\n    branches:\n      - main")
    || !workflow.includes("workflow_dispatch:")
  ) {
    diagnostics.push("workflow triggers")
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
  if (countOccurrences(workflow, CHECKOUT_PIN) !== 1 || workflow.includes("actions/checkout@v4")) {
    diagnostics.push("immutable checkout action pin")
  }
  if (countOccurrences(workflow, SETUP_NODE_PIN) !== 1 || workflow.includes("actions/setup-node@v4")) {
    diagnostics.push("immutable setup-node action pin")
  }
}

function validateSupportDocument(path, content, diagnostics) {
  if (!content.includes(supportTable)) {
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

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Support Node matrix policy failed")
  process.exitCode = 1
})
