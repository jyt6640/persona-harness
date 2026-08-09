import { execFileSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { pathToFileURL } from "node:url"

const ADVISORY_HOST_TOOLS = [
  "@opencode-ai/plugin",
  "@ast-grep/cli",
  "@colbymchenry/codegraph",
  "@theupsider/lsp-mcp",
]

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

function assertPortableConsumerInstallSurface(packageRoot, consumerRoot) {
  const packageJson = readPackageJson(packageRoot)
  const dependencies = packageJson.dependencies ?? {}
  const optionalDependencies = packageJson.optionalDependencies ?? {}
  const peerDependencies = packageJson.peerDependencies ?? {}
  const peerDependenciesMeta = packageJson.peerDependenciesMeta ?? {}
  const scripts = packageJson.scripts ?? {}

  for (const name of ADVISORY_HOST_TOOLS) {
    if (dependencies[name] !== undefined || optionalDependencies[name] !== undefined) {
      throw new Error("installed shared-skill package made an advisory host tool mandatory")
    }
    if (typeof peerDependencies[name] !== "string" || peerDependenciesMeta[name]?.optional !== true) {
      throw new Error("installed shared-skill package lost its optional host-tool contract")
    }
    if (existsSync(join(consumerRoot, "node_modules", ...name.split("/")))) {
      throw new Error("installed shared-skill package resolved an advisory host tool")
    }
  }

  for (const lifecycle of ["preinstall", "install", "postinstall"]) {
    if (typeof scripts[lifecycle] === "string") {
      throw new Error("installed shared-skill package declares a consumer lifecycle script")
    }
  }
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
  const pluginModule = await import(pathToFileURL(join(packageRoot, "dist", "index.js")).href)
  const catalogModule = await import(pathToFileURL(join(packageRoot, "dist", "runtime", "persona-shared-skill-catalog.js")).href)
  const interviewModule = await import(pathToFileURL(join(packageRoot, "dist", "runtime", "product-deep-interview.js")).href)
  if (pluginModule.default?.id !== "persona-harness") {
    throw new Error("installed shared-skill plugin module requires an advisory host tool")
  }
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

  const originalEnvironment = new Map(
    ["PATH", "PH_AST_GREP_BIN", "PH_CODEGRAPH_BIN", "PH_LSP_MCP_BIN", "PH_LSP_JAVA_SERVER"].map((name) => [name, process.env[name]]),
  )
  try {
    process.env.PATH = ""
    delete process.env.PH_AST_GREP_BIN
    delete process.env.PH_CODEGRAPH_BIN
    delete process.env.PH_LSP_MCP_BIN
    delete process.env.PH_LSP_JAVA_SERVER

    const astGrepModule = await import(pathToFileURL(join(packageRoot, "dist", "cli", "ast-grep-convention-runner.js")).href)
    const codegraphModule = await import(pathToFileURL(join(packageRoot, "packages", "codegraph-mcp", "lib", "codegraph-core.mjs")).href)
    const lspModule = await import(pathToFileURL(join(packageRoot, "packages", "lsp-mcp", "lib", "lsp-mcp-core.mjs")).href)
    if (astGrepModule.findAstGrepBinary() !== undefined) {
      throw new Error("installed shared-skill package bundled an advisory AST tool")
    }
    if (codegraphModule.capabilities({ PATH: "" }).codegraph.status !== "unavailable") {
      throw new Error("installed shared-skill package bundled an advisory CodeGraph tool")
    }
    if (lspModule.capabilities({ PATH: "" }).lspBridge.status !== "unavailable") {
      throw new Error("installed shared-skill package bundled an advisory LSP tool")
    }
  } finally {
    for (const [name, value] of originalEnvironment) {
      if (value === undefined) {
        delete process.env[name]
      } else {
        process.env[name] = value
      }
    }
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
      ["install", "--no-audit", "--no-fund", "--package-lock=false", absoluteTarball],
      { cwd: consumerRoot, encoding: "utf8", stdio: "pipe" },
    )

    const packageRoot = join(consumerRoot, "node_modules", "persona-harness")
    const resolvedPackageRoot = realpathSync(packageRoot)
    const resolvedConsumerRoot = realpathSync(consumerRoot)
    if (dirname(resolvedPackageRoot) !== join(resolvedConsumerRoot, "node_modules")) {
      throw new Error("installed shared-skill package used a source fallback")
    }

    assertInstalledCatalog(resolvedPackageRoot, expectedVersion)
    assertPortableConsumerInstallSurface(resolvedPackageRoot, resolvedConsumerRoot)
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
