import { readFile } from "node:fs/promises"

const workflowPaths = [
  ".github/workflows/ci.yml",
  ".github/workflows/publish.yml",
  ".github/workflows/release.yml",
]

const immutableActionPins = {
  checkout: "actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5",
  setupNode: "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020",
}

const expectedActionCounts = {
  ".github/workflows/ci.yml": { checkout: 1, setupNode: 1 },
  ".github/workflows/publish.yml": { checkout: 1, setupNode: 1 },
  ".github/workflows/release.yml": { checkout: 2, setupNode: 2 },
}

function countOccurrences(text, value) {
  return text.split(value).length - 1
}

function hasImmutableActionPins(path, text) {
  const expected = expectedActionCounts[path]
  if (expected === undefined) return false
  return (
    countOccurrences(text, immutableActionPins.checkout) === expected.checkout &&
    countOccurrences(text, immutableActionPins.setupNode) === expected.setupNode &&
    !/actions\/(?:checkout|setup-node)@v\d+\b/.test(text)
  )
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
