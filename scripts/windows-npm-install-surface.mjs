import { spawnSync } from "node:child_process"
import { existsSync, lstatSync, realpathSync } from "node:fs"
import { dirname, isAbsolute, join, resolve } from "node:path"

const MAX_CHILD_OUTPUT_BYTES = 1024
const CHILD_SUCCESS = "windows-npm-bin-link: PASS\n"

export function assertWindowsNpmBinLinkSurface(consumerRoot) {
  const root = canonicalDirectory(consumerRoot)
  const binLinksRoot = resolveBundledBinLinksRoot()
  const result = spawnSync(process.execPath, ["-e", CHILD_PROGRAM], {
    encoding: "utf8",
    env: {
      HOME: process.env.HOME ?? "",
      NPM_BIN_LINKS_ROOT: binLinksRoot,
      PATH: process.env.PATH ?? "",
      PERSONA_WINDOWS_NPM_CONSUMER_ROOT: root,
      __TESTING_BIN_LINKS_PLATFORM__: "win32",
    },
    maxBuffer: MAX_CHILD_OUTPUT_BYTES,
    stdio: "pipe",
  })
  if (result.status !== 0 || result.stdout !== CHILD_SUCCESS) {
    throw new Error("windows-npm-install-bin-link")
  }
}

function canonicalDirectory(value) {
  if (typeof value !== "string" || !isAbsolute(value) || !existsSync(value)) {
    throw new Error("windows-npm-install-bin-link")
  }
  const stat = lstatSync(value)
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("windows-npm-install-bin-link")
  return realpathSync(value)
}

function resolveBundledBinLinksRoot() {
  const executableDirectory = dirname(process.execPath)
  const candidates = [
    resolve(executableDirectory, "..", "lib", "node_modules", "npm", "node_modules", "bin-links"),
    join(executableDirectory, "node_modules", "npm", "node_modules", "bin-links"),
  ]
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue
    const stat = lstatSync(candidate)
    if (!stat.isDirectory() || stat.isSymbolicLink()) continue
    return realpathSync(candidate)
  }
  throw new Error("windows-npm-install-bin-link")
}

const CHILD_PROGRAM = String.raw`
const fs = require("node:fs")
const path = require("node:path")

const root = process.env.PERSONA_WINDOWS_NPM_CONSUMER_ROOT
const binLinksRoot = process.env.NPM_BIN_LINKS_ROOT
if (typeof root !== "string" || typeof binLinksRoot !== "string") process.exit(1)

const lockPath = path.join(root, "package-lock.json")
let lock
try {
  lock = JSON.parse(fs.readFileSync(lockPath, "utf8"))
} catch {
  process.exit(1)
}
if (typeof lock !== "object" || lock === null || Array.isArray(lock) || typeof lock.packages !== "object" || lock.packages === null || Array.isArray(lock.packages)) {
  process.exit(1)
}

const contained = (candidate) => {
  const relation = path.relative(root, candidate)
  return relation !== "" && !relation.startsWith(".." + path.sep) && relation !== ".." && !path.isAbsolute(relation)
}
const directory = (candidate) => {
  const stat = fs.lstatSync(candidate)
  return stat.isDirectory() && !stat.isSymbolicLink()
}

const entries = Object.keys(lock.packages)
  .filter((entry) => entry.startsWith("node_modules/"))
  .sort((left, right) => left.split("/").length - right.split("/").length || (left < right ? -1 : left > right ? 1 : 0))
const binLinks = require(binLinksRoot)
const expected = []

async function run() {
  binLinks.resetSeen()
  for (const entry of entries) {
    const packageRoot = path.resolve(root, entry)
    if (!contained(packageRoot) || !directory(packageRoot)) process.exit(1)
    let packageJson
    try {
      packageJson = JSON.parse(fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"))
    } catch {
      process.exit(1)
    }
    if (typeof packageJson !== "object" || packageJson === null || Array.isArray(packageJson) || packageJson.bin === undefined) continue
    await binLinks({ force: true, global: false, path: packageRoot, pkg: packageJson, top: false })
    for (const output of binLinks.getPaths({ global: false, path: packageRoot, pkg: packageJson, top: false })) {
      const resolved = path.resolve(output)
      if (!contained(resolved)) process.exit(1)
      expected.push(resolved)
    }
  }

  if (expected.length === 0) process.exit(1)
  for (const output of expected) {
    const stat = fs.lstatSync(output)
    if (!stat.isFile() || stat.isSymbolicLink()) process.exit(1)
  }
  process.stdout.write("windows-npm-bin-link: PASS\n")
}

run().catch(() => process.exit(1))
`
