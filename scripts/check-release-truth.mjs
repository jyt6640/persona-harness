import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

import { renderReleaseBody } from "./generate-github-release-notes.mjs"

async function main() {
  const projectRoot = process.cwd()
  const packageJson = await readJson(projectRoot, "package.json")
  const version = packageJson.version
  if (typeof version !== "string" || !/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error("release-truth-current-version")
  }

  const releaseNotesPath = `docs/current/release/v${version}-release-notes.md`
  const releaseNotes = await readText(projectRoot, releaseNotesPath)
  const acceptance = await readJson(projectRoot, `docs/current/release/consumer-authority-v${version.replaceAll(".", "")}-acceptance.json`)
  const previous = readHistoricalRelease(acceptance, version)

  const body = renderReleaseBody({
    tagName: `v${version}`,
    version,
    distTag: "latest",
    releaseNotes,
    releaseNotesPath,
  })
  if (!body.includes("## Release Status") || !body.includes("registry/provenance readback")) {
    throw new Error("release-truth-release-body")
  }

  const [releaseOperations, history, changelog, packageIndex, releaseDocs] = await Promise.all([
    readText(projectRoot, "docs/current/release/README.md"),
    readText(projectRoot, "docs/current/release/history.md"),
    readText(projectRoot, "CHANGELOG.md"),
    readText(projectRoot, "docs/releases/package-index.md"),
    readText(projectRoot, "docs/releases/README.md"),
  ])
  assertLiveReleaseLookup(releaseOperations, "release-operations")
  assertLiveReleaseLookup(beforeHeading(history, "## Retained Workflow Lifecycle Boundary"), "release-history")
  assertLiveReleaseLookup(beforeHeading(packageIndex, "## Reading Rules"), "package-index")
  if (!releaseDocs.includes("live lookup links")) {
    throw new Error("release-truth-release-docs-lookup")
  }
  if (
    !changelog.includes(`## [${previous.version}] - `)
    || !packageIndex.includes(`| \`${previous.version}\` |`)
  ) {
    throw new Error("release-truth-published-history")
  }

  console.log(`Release truth: PASS (${version}, immutable history ${previous.version})`)
}

async function readText(projectRoot, path) {
  return readFile(resolve(projectRoot, path), "utf8")
}

async function readJson(projectRoot, path) {
  return JSON.parse(await readText(projectRoot, path))
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function readHistoricalRelease(acceptance, version) {
  const current = parseVersion(version)
  const records = Object.entries(acceptance)
    .filter(([key, value]) => /^v\d+HistoricalRelease$/.test(key) && isRecord(value))
    .map(([, value]) => ({
      value,
      version: typeof value.version === "string" ? parseVersion(value.version) : null,
    }))
    .filter((record) => record.version !== null && compareVersions(record.version, current) < 0)
    .sort((left, right) => compareVersions(right.version, left.version))
  if (records.length === 0 || records[0].version === null) {
    throw new Error("release-truth-historical-authority")
  }
  return records[0].value
}

function parseVersion(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value)
  if (match === null) throw new Error("release-truth-historical-authority")
  return match.slice(1).map(Number)
}

function compareVersions(left, right) {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index]
  }
  return 0
}

function assertLiveReleaseLookup(value, label) {
  if (
    !value.includes("https://www.npmjs.com/package/persona-harness?activeTab=versions")
    || !value.includes("https://github.com/jyt6640/persona-harness/releases")
    || /(?:\|\s*(?:npm `latest`|GitHub latest release)\s*\|\s*`?v?\d|(?:npm `latest`|GitHub's latest release)\s*:\s*`?v?\d)/i.test(value)
  ) {
    throw new Error(`release-truth-live-state-${label}`)
  }
}

function beforeHeading(value, heading) {
  return value.split(heading, 1)[0]
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
