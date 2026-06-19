import { readdir } from "node:fs/promises"
import { resolve } from "node:path"

const PROJECT_DIR = process.argv[2] === undefined ? process.cwd() : resolve(process.argv[2])

const ROOT_ALLOWED_FILES = new Set(["README.md", "project-progress-board.md"])
const ROOT_ALLOWED_DIRS = new Set(["archive", "current", "evidence-reviews", "phases"])

function suggestedDirectory(fileName) {
  if (fileName.endsWith(".json")) {
    return "docs/current/"
  }
  if (/^(phase-0|phase0-)/.test(fileName)) {
    return "docs/phases/phase0/"
  }
  if (/^phase1-/.test(fileName)) {
    return "docs/phases/phase1/"
  }
  if (/^phase-next-/.test(fileName)) {
    return "docs/phases/phase-next/"
  }
  if (/(ab-review|actual|evidence|report-review|repeat|regrade|result|surface)/.test(fileName)) {
    return "docs/evidence-reviews/"
  }
  if (/(archive|deprecated|old)/.test(fileName)) {
    return "docs/archive/"
  }
  return "docs/current/"
}

async function main() {
  const docsDir = resolve(PROJECT_DIR, "docs")
  const entries = await readdir(docsDir, { withFileTypes: true })
  const diagnostics = []

  for (const entry of entries) {
    if (entry.isFile() && !ROOT_ALLOWED_FILES.has(entry.name)) {
      diagnostics.push(`Move docs/${entry.name} to ${suggestedDirectory(entry.name)}${entry.name}`)
    }
    if (entry.isDirectory() && !ROOT_ALLOWED_DIRS.has(entry.name)) {
      diagnostics.push(`Unexpected docs/${entry.name}/. Add it to the taxonomy or move it under an existing docs package.`)
    }
  }

  const finding = diagnostics.length > 0 ? "WARN" : "PASS"
  console.log(`Docs taxonomy diagnostics finding: ${finding}`)
  console.log(`Docs taxonomy diagnostics count: ${diagnostics.length}`)
  if (diagnostics.length > 0) {
    console.log("")
    for (const diagnostic of diagnostics) {
      console.log(`- ${diagnostic}`)
    }
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
