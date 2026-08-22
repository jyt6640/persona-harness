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
  const previous = acceptance.v0824HistoricalRelease
  if (!isRecord(previous) || typeof previous.version !== "string" || previous.version === version) {
    throw new Error("release-truth-historical-authority")
  }

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

  const [history, changelog, packageIndex] = await Promise.all([
    readText(projectRoot, "docs/current/release/history.md"),
    readText(projectRoot, "CHANGELOG.md"),
    readText(projectRoot, "docs/releases/package-index.md"),
  ])
  if (
    !history.includes(`| npm \`latest\` | \`${previous.version}\` |`)
    || !history.includes(`| GitHub latest release | \`v${previous.version}\` |`)
    || !changelog.includes(`## [${previous.version}] - `)
    || !packageIndex.includes(`| \`${previous.version}\` |`)
  ) {
    throw new Error("release-truth-published-history")
  }

  console.log(`Release truth: PASS (${version}, published history ${previous.version})`)
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

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
