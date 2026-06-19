import { spawnSync } from "node:child_process"
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, dirname, isAbsolute, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const PROJECT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const KEEP_DEMO_PROJECT = process.argv.includes("--keep")

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? PROJECT_DIR,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  })

  if (result.status !== 0) {
    throw new Error(
      [
        `Command failed: ${[command, ...args].join(" ")}`,
        `cwd: ${options.cwd ?? PROJECT_DIR}`,
        result.stdout.trim(),
        result.stderr.trim(),
      ]
        .filter(Boolean)
        .join("\n"),
    )
  }

  return result.stdout
}

function resolvePackedTarball(packOutput, packDir) {
  const parsed = JSON.parse(packOutput)
  if (!Array.isArray(parsed) || parsed.length !== 1 || typeof parsed[0]?.filename !== "string") {
    throw new Error("npm pack did not return one tarball filename")
  }

  const filename = parsed[0].filename
  return isAbsolute(filename) ? filename : join(packDir, basename(filename))
}

function collectFiles(dir, predicate) {
  if (!existsSync(dir)) {
    return []
  }

  const matches = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const entryPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      matches.push(...collectFiles(entryPath, predicate))
      continue
    }
    if (predicate(entryPath)) {
      matches.push(entryPath)
    }
  }
  return matches
}

function prepareInstalledProject(tempRoot) {
  const packDir = join(tempRoot, "pack")
  mkdirSync(packDir, { recursive: true })
  const packOutput = run("npm", ["pack", "--json", "--pack-destination", packDir])
  const tarballPath = resolvePackedTarball(packOutput, packDir)
  if (!existsSync(tarballPath)) {
    throw new Error(`Packed tarball was not created: ${tarballPath}`)
  }

  const demoProjectDir = join(tempRoot, "demo-project")
  mkdirSync(demoProjectDir, { recursive: true })
  writeFileSync(
    join(demoProjectDir, "package.json"),
    `${JSON.stringify({ private: true, type: "module", dependencies: {} }, null, 2)}\n`,
  )
  run("npm", ["install", "--silent", "--no-audit", "--no-fund", tarballPath], { cwd: demoProjectDir })
  return { demoProjectDir, tarballPath }
}

function verifyInitProject(demoProjectDir) {
  const installedPackageDir = join(demoProjectDir, "node_modules", "persona-harness")
  const binPath = join(demoProjectDir, "node_modules", ".bin", "persona-harness")
  run(binPath, ["init"], { cwd: demoProjectDir })
  run(binPath, ["init"], { cwd: demoProjectDir })

  const opencodeConfigPath = join(demoProjectDir, ".opencode", "opencode.json")
  const opencodeConfig = JSON.parse(readFileSync(opencodeConfigPath, "utf8"))
  const expectedPluginPath = realpathSync(join(installedPackageDir, "dist", "index.js"))
  if (!existsSync(join(demoProjectDir, ".persona", "harness.jsonc"))) {
    throw new Error("Missing initialized .persona/harness.jsonc")
  }
  if (!existsSync(join(demoProjectDir, ".persona", "rules"))) {
    throw new Error("Missing initialized .persona/rules")
  }
  if (existsSync(join(demoProjectDir, ".persona", "evidence"))) {
    throw new Error("Init copied .persona/evidence; evidence must be runtime-only")
  }
  if (
    !Array.isArray(opencodeConfig.plugin) ||
    opencodeConfig.plugin.filter((entry) => typeof entry === "string" && realpathSync(entry) === expectedPluginPath)
      .length !== 1
  ) {
    throw new Error("OpenCode plugin path was not added exactly once")
  }

  return { expectedPluginPath }
}

const tempRoot = mkdtempSync(join(tmpdir(), "persona-init-demo-"))

try {
  const { demoProjectDir, tarballPath } = prepareInstalledProject(tempRoot)
  const { expectedPluginPath } = verifyInitProject(demoProjectDir)

  console.log("Persona init demo: PASS")
  console.log(`Packed tarball: ${tarballPath}`)
  console.log(`Installed plugin path: ${expectedPluginPath}`)
  console.log(`Evidence files after init: ${collectFiles(join(demoProjectDir, ".persona", "evidence"), (file) => file.endsWith(".json")).length}`)
  if (KEEP_DEMO_PROJECT) {
    console.log(`Demo project kept: ${demoProjectDir}`)
  }
} finally {
  if (!KEEP_DEMO_PROJECT) {
    rmSync(tempRoot, { recursive: true, force: true })
  }
}
