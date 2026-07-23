import { readdir, readFile } from "node:fs/promises"
import { resolve } from "node:path"

const PROJECT_DIR = process.argv[2] === undefined ? process.cwd() : resolve(process.argv[2])

const ROOT_ALLOWED_FILES = new Set([
  "README.md",
  "project-progress-board.md",
  "START-HERE.md",
  "QUICK-DEMO.md",
  "MEASURED-CLAIMS.md",
])
const ROOT_ALLOWED_DIRS = new Set(["archive", "current", "evidence-reviews", "phases", "releases", "troubleshooting"])
const CURRENT_LIFECYCLE_DOC = "docs/current/workflow-closure-state-machine-design.md"
const HISTORICAL_LIFECYCLE_DOCS = [
  "docs/current/v0.3.0-workflow-report-status-lifecycle.md",
  "docs/current/release/next-version-readiness.md",
  "docs/current/release/rc-release-readiness-decision.md",
]

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

function currentRecordsSection(source) {
  const heading = "## Canonical Current Records"
  const start = source.indexOf(heading)
  if (start === -1) {
    return ""
  }
  const nextHeading = source.indexOf("\n## ", start + heading.length)
  return source.slice(start, nextHeading === -1 ? undefined : nextHeading)
}

async function readCurrentDoc(projectDir, relativePath, diagnostics) {
  try {
    return await readFile(resolve(projectDir, relativePath), "utf8")
  } catch {
    diagnostics.push(`Required current documentation is missing or unreadable: ${relativePath}`)
    return ""
  }
}

async function checkLifecycleDocumentSelection(projectDir, diagnostics) {
  const [canonical, currentReadme, inventory, lifecycle, releaseReadme, ...historical] = await Promise.all([
    readCurrentDoc(projectDir, "docs/current/canonical-docs-index.md", diagnostics),
    readCurrentDoc(projectDir, "docs/current/README.md", diagnostics),
    readCurrentDoc(projectDir, "docs/current/docs-inventory.md", diagnostics),
    readCurrentDoc(projectDir, CURRENT_LIFECYCLE_DOC, diagnostics),
    readCurrentDoc(projectDir, "docs/current/release/README.md", diagnostics),
    ...HISTORICAL_LIFECYCLE_DOCS.map((path) => readCurrentDoc(projectDir, path, diagnostics)),
  ])
  const currentRecords = currentRecordsSection(canonical)
  if (!currentRecords.includes(CURRENT_LIFECYCLE_DOC)) {
    diagnostics.push(`${CURRENT_LIFECYCLE_DOC} must be selected in Canonical Current Records`)
  }
  for (const path of HISTORICAL_LIFECYCLE_DOCS) {
    if (currentRecords.includes(path)) {
      diagnostics.push(`${path} is historical and must not be selected in Canonical Current Records`)
    }
  }
  if (!currentReadme.includes("## Selection Rule") || !currentReadme.includes("workflow-closure-state-machine-design.md")) {
    diagnostics.push("docs/current/README.md must select the current workflow lifecycle document")
  }
  if (!lifecycle.includes("Status: current canonical lifecycle contract.") || !lifecycle.includes("workflow-lifecycle.1")) {
    diagnostics.push(`${CURRENT_LIFECYCLE_DOC} must declare the current workflow-lifecycle.1 contract`)
  }
  if (!releaseReadme.includes("Current Workflow Lifecycle Boundary") || !releaseReadme.includes("not a release state")) {
    diagnostics.push("docs/current/release/README.md must preserve the workflow lifecycle non-release boundary")
  }
  if (!inventory.includes("`docs/current/workflow-closure-state-machine-design.md` | current active pointer/status")) {
    diagnostics.push("docs/current/docs-inventory.md must classify the workflow lifecycle document as current")
  }
  for (const [index, path] of HISTORICAL_LIFECYCLE_DOCS.entries()) {
    if (!historical[index].includes("Status: historical")) {
      diagnostics.push(`${path} must be marked historical`)
    }
    if (!inventory.includes(`\`${path}\``)) {
      diagnostics.push(`docs/current/docs-inventory.md must classify ${path}`)
    }
  }
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

  if (entries.some((entry) => entry.name === "current" && entry.isDirectory())) {
    await checkLifecycleDocumentSelection(PROJECT_DIR, diagnostics)
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
