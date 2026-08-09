import { execFileSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { pathToFileURL } from "node:url"

function readArg(name) {
  const index = process.argv.indexOf(name)
  const value = index === -1 ? undefined : process.argv[index + 1]
  if (index !== -1 && (value === undefined || value.startsWith("--"))) {
    throw new Error(`${name} requires a value`)
  }
  return value
}

function readPackageJson(packageRoot) {
  return JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"))
}

function assertInstalledCatalog(packageRoot, expectedVersion) {
  const packageJson = readPackageJson(packageRoot)
  if (packageJson.name !== "persona-harness" || packageJson.version !== expectedVersion) {
    throw new Error("installed shared-skill package identity mismatch")
  }

  const catalogPath = join(packageRoot, "packages", "shared-skills", "catalog.json")
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8"))
  if (catalog.schemaVersion !== "persona-shared-skill-catalog.1" || !Array.isArray(catalog.skills)) {
    throw new Error("installed shared-skill catalog mismatch")
  }
  for (const skill of catalog.skills) {
    if (typeof skill?.entry !== "string" || !existsSync(join(packageRoot, "packages", "shared-skills", skill.entry))) {
      throw new Error("installed shared-skill entry missing")
    }
  }
  if (existsSync(join(packageRoot, "packages", "shared-skills", "skills", "workflow"))) {
    throw new Error("legacy workflow skills unexpectedly packaged")
  }
}

async function assertInstalledRuntime(packageRoot, consumerRoot) {
  const catalogModule = await import(pathToFileURL(join(packageRoot, "dist", "runtime", "persona-shared-skill-catalog.js")).href)
  const interviewModule = await import(pathToFileURL(join(packageRoot, "dist", "runtime", "product-deep-interview.js")).href)
  const plan = catalogModule.resolvePersonaSharedSkill("plan")
  if (plan.entry !== "skills/plan/SKILL.md") {
    throw new Error("installed shared-skill runtime resolved an unexpected plan entry")
  }
  const tracker = new interviewModule.ProductDeepInterviewTracker()
  const result = tracker.route("installed-package-contract", "I want to build a small product")
  if (result?.kind !== "question" || result.topic !== "target-user" || !result.block.includes("Recommendation:")) {
    throw new Error("installed product interview runtime mismatch")
  }
  if (existsSync(join(consumerRoot, ".persona"))) {
    throw new Error("installed product interview created consumer workflow state")
  }
}

async function main() {
  const tarball = readArg("--tarball")
  const expectedVersion = readArg("--expected-version")
  if (tarball === undefined || expectedVersion === undefined) {
    throw new Error("--tarball and --expected-version are required")
  }

  const absoluteTarball = resolve(tarball)
  if (!existsSync(absoluteTarball)) {
    throw new Error("shared-skill package tarball is missing")
  }

  const consumerRoot = mkdtempSync(join(tmpdir(), "persona-shared-skills-installed-"))
  try {
    writeFileSync(join(consumerRoot, "package.json"), `${JSON.stringify({ private: true })}\n`)
    execFileSync(
      "npm",
      ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--package-lock=false", absoluteTarball],
      { cwd: consumerRoot, encoding: "utf8", stdio: "pipe" },
    )

    const packageRoot = join(consumerRoot, "node_modules", "persona-harness")
    const resolvedPackageRoot = realpathSync(packageRoot)
    const resolvedConsumerRoot = realpathSync(consumerRoot)
    if (dirname(resolvedPackageRoot) !== join(resolvedConsumerRoot, "node_modules")) {
      throw new Error("installed shared-skill package used a source fallback")
    }

    assertInstalledCatalog(resolvedPackageRoot, expectedVersion)
    await assertInstalledRuntime(resolvedPackageRoot, resolvedConsumerRoot)
    process.stdout.write("Persona shared-skills installed package contract: PASS (sourceFallback=false)\n")
  } finally {
    rmSync(consumerRoot, { recursive: true, force: true })
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
