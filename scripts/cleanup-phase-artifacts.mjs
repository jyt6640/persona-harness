import { promises as fs } from "node:fs"
import { basename, join, relative, resolve } from "node:path"

const DEFAULT_ROOT = "experiments/phase0-runs"
const DEFAULT_MAX_LOG_BYTES = 200_000
const DELETE_DIR_NAMES = new Set(["sandbox", "sandbox-baseline", ".gradle", "build", "node_modules"])
const KEEP_FILE_NAMES = new Set(["run-metadata.json", "prompt.md", "summary.json", "tree.txt"])
const KEEP_FILE_PATTERNS = [/\.status$/i, /-review\.md$/i, /^review\.md$/i, /\.trimmed\.log$/i]

function parseArgs(argv) {
  const options = {
    apply: false,
    root: resolve(DEFAULT_ROOT),
    maxLogBytes: DEFAULT_MAX_LOG_BYTES,
    help: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--apply") {
      options.apply = true
      continue
    }
    if (arg === "--dry-run") {
      options.apply = false
      continue
    }
    if (arg === "--root") {
      const value = argv[index + 1]
      if (value === undefined) {
        throw new Error("--root requires a path")
      }
      options.root = resolve(value)
      index += 1
      continue
    }
    if (arg === "--max-log-bytes") {
      const value = argv[index + 1]
      const maxLogBytes = Number(value)
      if (value === undefined || !Number.isFinite(maxLogBytes) || !Number.isInteger(maxLogBytes) || maxLogBytes < 1) {
        throw new Error("--max-log-bytes requires a positive integer")
      }
      options.maxLogBytes = maxLogBytes
      index += 1
      continue
    }
    if (arg === "--help" || arg === "-h") {
      options.help = true
      continue
    }
    throw new Error(`Unknown argument: ${arg}`)
  }

  return options
}

function printHelp() {
  console.log(`Usage: npm run cleanup:experiments -- [--dry-run] [--apply] [--root <path>] [--max-log-bytes <bytes>]

Defaults to dry-run mode. The cleaner keeps review/metadata files and removes generated code caches only when --apply is passed.
`)
}

async function pathExists(path) {
  try {
    await fs.access(path)
    return true
  } catch {
    return false
  }
}

async function* walk(path, pruneDirNames = new Set()) {
  const entries = await fs.readdir(path, { withFileTypes: true })
  for (const entry of entries) {
    const child = join(path, entry.name)
    if (entry.isDirectory()) {
      yield { path: child, type: "directory", name: entry.name }
      if (!pruneDirNames.has(entry.name)) {
        yield* walk(child, pruneDirNames)
      }
      continue
    }
    if (entry.isFile()) {
      yield { path: child, type: "file", name: entry.name }
    }
  }
}

async function listRunDirectories(root) {
  const stat = await fs.stat(root)
  if (!stat.isDirectory()) {
    throw new Error(`Root is not a directory: ${root}`)
  }

  const entries = await fs.readdir(root, { withFileTypes: true })
  const hasRunMetadata = entries.some((entry) => entry.isFile() && entry.name === "run-metadata.json")
  if (hasRunMetadata) {
    return [root]
  }

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(root, entry.name))
    .sort()
}

async function inspectLogFile(filePath, maxBytes) {
  const stat = await fs.stat(filePath)
  if (stat.size <= maxBytes || filePath.endsWith(".trimmed.log")) {
    return null
  }
  const trimmedPath = filePath.replace(/\.log$/i, ".trimmed.log")
  return { original: filePath, trimmed: trimmedPath, bytes: stat.size }
}

async function trimLogFile(filePath, maxBytes) {
  const logAction = await inspectLogFile(filePath, maxBytes)
  if (logAction === null) {
    return null
  }

  const sliceSize = Math.max(2_000, Math.floor(maxBytes / 4))
  const file = await fs.open(filePath, "r")
  try {
    const headBuffer = Buffer.alloc(Math.min(sliceSize, logAction.bytes))
    await file.read(headBuffer, 0, headBuffer.length, 0)

    const tailLength = Math.min(sliceSize, logAction.bytes)
    const tailBuffer = Buffer.alloc(tailLength)
    await file.read(tailBuffer, 0, tailLength, Math.max(0, logAction.bytes - tailLength))

    const head = headBuffer.toString("utf8")
    const tail = tailBuffer.toString("utf8")

    const body = [
      `# Trimmed log`,
      ``,
      `Original file: ${basename(filePath)}`,
      `Original bytes: ${logAction.bytes}`,
      `Policy max bytes: ${maxBytes}`,
      ``,
      `## Head`,
      "```",
      head.trimEnd(),
      "```",
      ``,
      `## Tail`,
      "```",
      tail.trimEnd(),
      "```",
      "",
    ].join("\n")

    await fs.writeFile(logAction.trimmed, body, "utf8")
    await fs.rm(filePath)
    return logAction
  } finally {
    await file.close()
  }
}

async function collectRunActions(runDir, options) {
  const actions = []
  const trimActions = []

  for await (const entry of walk(runDir, DELETE_DIR_NAMES)) {
    if (entry.type === "directory" && DELETE_DIR_NAMES.has(entry.name)) {
      actions.push({ type: "delete-directory", path: entry.path })
      continue
    }

    if (entry.type === "file" && entry.name.endsWith(".log")) {
      const trimAction = await inspectLogFile(entry.path, options.maxLogBytes)
      if (trimAction !== null) {
        trimActions.push(trimAction)
      }
    }
  }

  return { actions, trimActions }
}

async function applyRunActions(actions, trimActions, options) {
  for (const action of actions) {
    await fs.rm(action.path, { recursive: true, force: true })
  }
  for (const action of trimActions) {
    await trimLogFile(action.original, options.maxLogBytes)
  }
}

function printSummary(root, runReports, options) {
  const deleteCount = runReports.reduce((sum, report) => sum + report.actions.length, 0)
  const trimCount = runReports.reduce((sum, report) => sum + report.trimActions.length, 0)
  const mode = options.apply ? "APPLY" : "DRY-RUN"

  console.log(`Phase artifact cleanup mode: ${mode}`)
  console.log(`Root: ${root}`)
  console.log(`Runs scanned: ${runReports.length}`)
  console.log(`Directories to delete: ${deleteCount}`)
  console.log(`Logs to trim: ${trimCount}`)
  console.log(`Kept files: ${[...KEEP_FILE_NAMES].join(", ")}, *.status, *-review.md, *.trimmed.log`)

  for (const report of runReports) {
    if (report.actions.length === 0 && report.trimActions.length === 0) {
      continue
    }
    console.log("")
    console.log(`Run: ${relative(process.cwd(), report.runDir)}`)
    for (const action of report.actions) {
      console.log(`  delete dir: ${relative(process.cwd(), action.path)}`)
    }
    for (const action of report.trimActions) {
      console.log(`  trim log: ${relative(process.cwd(), action.original)} -> ${relative(process.cwd(), action.trimmed)} (${action.bytes} bytes)`)
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }

  if (!(await pathExists(options.root))) {
    console.log(`Phase artifact cleanup mode: ${options.apply ? "APPLY" : "DRY-RUN"}`)
    console.log(`Root does not exist: ${options.root}`)
    return
  }

  const runDirs = await listRunDirectories(options.root)
  const reports = []

  for (const runDir of runDirs) {
    const report = await collectRunActions(runDir, options)
    reports.push({ runDir, ...report })
    if (options.apply) {
      await applyRunActions(report.actions, report.trimActions, options)
    }
  }

  printSummary(options.root, reports, options)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
