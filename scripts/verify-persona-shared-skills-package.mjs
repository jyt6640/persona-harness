import { execFileSync } from "node:child_process"
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, relative, resolve, sep } from "node:path"
import { pathToFileURL } from "node:url"

import { assertWindowsPackageInstallSurface } from "./package-content-identity.mjs"
import { assertWindowsNpmBinLinkSurface } from "./windows-npm-install-surface.mjs"

const ADVISORY_HOST_TOOLS = [
  "@opencode-ai/plugin",
  "@ast-grep/cli",
  "@colbymchenry/codegraph",
  "@theupsider/lsp-mcp",
]
const PORTABLE_PROVENANCE_DECODER = "snappyjs"
const TARBALL_INSTALL_LIFECYCLE = ["preinstall", "install", "postinstall", "prepublish", "preprepare", "prepare", "postprepare"]

function readArg(name) {
  const index = process.argv.indexOf(name)
  const value = index === -1 ? undefined : process.argv[index + 1]
  if (index !== -1 && (value === undefined || value.startsWith("--"))) {
    throw new Error(`${name} requires a value`)
  }
  return value
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"))
}

function readPackageJson(packageRoot) {
  return readJson(join(packageRoot, "package.json"))
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

  for (const lifecycle of TARBALL_INSTALL_LIFECYCLE) {
    if (typeof scripts[lifecycle] === "string") {
      throw new Error("installed shared-skill package declares a consumer lifecycle script")
    }
  }

  if (existsSync(join(packageRoot, ".npmrc")) || existsSync(join(packageRoot, "package-lock.json"))) {
    throw new Error("installed shared-skill package carries consumer npm configuration")
  }

  if (dependencies.snappy !== undefined || optionalDependencies.snappy !== undefined || dependencies[PORTABLE_PROVENANCE_DECODER] !== "0.7.0") {
    throw new Error("installed shared-skill package retained a native provenance decoder")
  }
  if (existsSync(join(consumerRoot, "node_modules", "snappy")) || existsSync(join(consumerRoot, "node_modules", "@napi-rs"))) {
    throw new Error("installed shared-skill package resolved a native provenance decoder")
  }

  const decoder = readPackageJson(join(consumerRoot, "node_modules", PORTABLE_PROVENANCE_DECODER))
  const decoderScripts = decoder.scripts ?? {}
  if (
    decoder.os !== undefined
    || decoder.cpu !== undefined
    || Object.keys(decoder.dependencies ?? {}).length !== 0
    || Object.keys(decoder.optionalDependencies ?? {}).length !== 0
    || ["preinstall", "install", "postinstall", "prepare"].some((lifecycle) => typeof decoderScripts[lifecycle] === "string")
  ) {
    throw new Error("installed shared-skill package resolved an unsafe provenance decoder")
  }
}

function assertInstalledDependencyGraph(consumerRoot, expectedVersion) {
  const lock = readJson(join(consumerRoot, "package-lock.json"))
  const packages = lock.packages
  if (lock.lockfileVersion !== 3 || typeof packages !== "object" || packages === null || Array.isArray(packages)) {
    throw new Error("installed shared-skill consumer lock is invalid")
  }
  const consumer = packages[""]
  const installed = packages["node_modules/persona-harness"]
  const consumerManifest = readPackageJson(consumerRoot)
  if (
    typeof consumer !== "object"
    || consumer === null
    || Array.isArray(consumer)
    || consumerManifest.private !== true
    || typeof consumer.dependencies !== "object"
    || consumer.dependencies === null
    || Array.isArray(consumer.dependencies)
    || typeof consumer.dependencies["persona-harness"] !== "string"
    || !consumer.dependencies["persona-harness"].startsWith("file:")
    || typeof installed !== "object"
    || installed === null
    || Array.isArray(installed)
    || installed.version !== expectedVersion
    || typeof installed.resolved !== "string"
    || !installed.resolved.startsWith("file:")
  ) {
    throw new Error("installed shared-skill consumer lock is invalid")
  }
  for (const [entry, value] of Object.entries(packages)) {
    if (entry === "") continue
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error("installed shared-skill consumer lock is invalid")
    }
    if (value.hasInstallScript === true || value.os !== undefined || value.cpu !== undefined) {
      throw new Error("installed shared-skill package resolved a platform-sensitive dependency")
    }
    const packageRoot = resolve(consumerRoot, entry)
    if (!isContained(consumerRoot, packageRoot) || !entry.startsWith("node_modules/")) {
      throw new Error("installed shared-skill consumer lock is invalid")
    }
    const stat = lstatSync(packageRoot)
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new Error("installed shared-skill consumer lock is invalid")
    }
    const packageJson = readPackageJson(packageRoot)
    const scripts = packageJson.scripts ?? {}
    if (["preinstall", "install", "postinstall"].some((lifecycle) => typeof scripts[lifecycle] === "string")) {
      throw new Error("installed shared-skill package resolved a consumer lifecycle script")
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
  if (existsSync(join(packageRoot, "scripts", "windows-npm-install-surface.mjs"))) {
    throw new Error("installed shared-skill package carried its source install verifier")
  }
}

async function assertInstalledRuntime(packageRoot, consumerRoot) {
  const pluginModule = await import(pathToFileURL(join(packageRoot, "dist", "index.js")).href)
  const catalogModule = await import(pathToFileURL(join(packageRoot, "dist", "runtime", "persona-shared-skill-catalog.js")).href)
  const intentModule = await import(pathToFileURL(join(packageRoot, "dist", "runtime", "top-level-intent-router.js")).href)
  const adapterModule = await import(pathToFileURL(join(packageRoot, "dist", "runtime", "opencode-skill-adapter.js")).href)
  const portableModule = await import(pathToFileURL(join(packageRoot, "dist", "portable-skill.js")).href)
  const interviewModule = await import(pathToFileURL(join(packageRoot, "dist", "runtime", "product-deep-interview.js")).href)
  const provenanceModule = await import(pathToFileURL(join(packageRoot, "scripts", "staged-package-artifact-provenance-network.mjs")).href)
  if (typeof pluginModule.PersonaHarnessPlugin !== "function") {
    throw new Error("installed shared-skill plugin module requires an advisory host tool")
  }
  if (typeof provenanceModule.decodeStagedPackageArtifactSnappy !== "function") {
    throw new Error("installed shared-skill package could not load its provenance decoder")
  }
  const plan = catalogModule.resolvePersonaSharedSkill("plan")
  if (plan.entry !== "skills/plan/SKILL.md") {
    throw new Error("installed shared-skill runtime resolved an unexpected plan entry")
  }
  const automaticIntent = intentModule.detectTopLevelIntent("I want to build a small product")
  if (
    automaticIntent?.primary !== "product-interview"
    || automaticIntent.activation?.decision !== "automatic"
    || automaticIntent.activation.skillId !== "deep-interview"
    || automaticIntent.activation.firstAction !== "one-question-product-interview"
  ) {
    throw new Error("installed shared-skill runtime did not activate the compact product route")
  }
  if (intentModule.detectTopLevelIntent("hello there") !== undefined) {
    throw new Error("installed shared-skill runtime routed an ordinary turn")
  }
  const compactRoute = adapterModule.createOpenCodeSkillRoute({
    decision: "activate",
    firstAction: "one-question-product-interview",
    skillId: "deep-interview",
    reason: "The request remains ambiguous.",
  })
  if (
    !compactRoute.includes("Reference: packages/shared-skills/skills/deep-interview/SKILL.md")
    || compactRoute.includes("# Product Deep Interview")
    || compactRoute.includes("npx ph workflow")
  ) {
    throw new Error("installed shared-skill route loaded more than its compact reference")
  }
  const portableCapsule = portableModule.createPortableSkillCapsule({
    decision: "automatic",
    firstAction: "one-question-product-interview",
    reason: "bounded package contract",
    skillId: "deep-interview",
  })
  const capabilityManifest = (host, overrides = {}) => ({
    schemaVersion: portableModule.HOST_CAPABILITY_MANIFEST_SCHEMA,
    host,
    hostVersion: "1.0.0",
    adapterVersion: "0.9.0",
    capabilities: portableModule.HOST_CAPABILITY_IDS.map((id) => ({
      id,
      state: overrides[id] ?? "supported",
    })),
  })
  const capabilityBinding = (host) => ({
    host,
    hostVersion: "1.0.0",
    adapterVersion: "0.9.0",
  })
  const portableRoutes = [
    portableModule.createCodexSkillAdapter(),
    portableModule.createOpenCodeSkillAdapter(),
    portableModule.createClaudeCodeSkillAdapter(),
    portableModule.createAntigravitySkillAdapter(),
  ].map((adapter) => adapter.consume({
    capsule: portableCapsule,
    manifest: capabilityManifest(adapter.host),
    binding: capabilityBinding(adapter.host),
  }))
  if (
    portableRoutes.length !== 4
    || portableRoutes.some((route) => route.status !== "ready" || route.capsule.skillId !== "deep-interview")
  ) {
    throw new Error("installed portable shared-skill adapters diverged")
  }
  const unsupportedRoute = portableModule.createOpenCodeSkillAdapter().consume({
    capsule: portableCapsule,
    manifest: capabilityManifest("opencode", { "skill-discovery": "unavailable" }),
    binding: capabilityBinding("opencode"),
  })
  if (unsupportedRoute.status !== "unsupported" || unsupportedRoute.code !== "host-assurance-blocked") {
    throw new Error("installed portable shared-skill adapter did not fail closed")
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

function installConsumerTarball(consumerRoot, absoluteTarball, target) {
  const home = join(consumerRoot, "home")
  const cache = join(consumerRoot, "cache")
  const temporary = join(consumerRoot, "tmp")
  mkdirSync(home, { recursive: true })
  mkdirSync(cache, { recursive: true })
  mkdirSync(temporary, { recursive: true })
  writeFileSync(join(consumerRoot, "package.json"), `${JSON.stringify({ private: true })}\n`)
  const userConfig = join(home, "npmrc")
  const globalConfig = join(home, "global-npmrc")
  writeFileSync(userConfig, "", { flag: "wx", mode: 0o600 })
  writeFileSync(globalConfig, "", { flag: "wx", mode: 0o600 })
  const npmTargetConfig = target === undefined
    ? {}
    : {
        npm_config_cpu: target.cpu,
        npm_config_os: target.os,
      }
  execFileSync(
    "npm",
    ["install", "--no-audit", "--no-fund", "--package-lock=true", absoluteTarball],
    {
      cwd: consumerRoot,
      encoding: "utf8",
      env: {
        HOME: home,
        PATH: process.env.PATH ?? "",
        TMP: temporary,
        TMPDIR: temporary,
        USERPROFILE: home,
        npm_config_audit: "false",
        npm_config_bin_links: "true",
        npm_config_cache: cache,
        npm_config_engine_strict: "true",
        npm_config_fund: "false",
        npm_config_global: "false",
        npm_config_globalconfig: globalConfig,
        npm_config_ignore_scripts: "false",
        npm_config_package_lock: "true",
        npm_config_update_notifier: "false",
        npm_config_userconfig: userConfig,
        npm_config_workspaces: "false",
        ...npmTargetConfig,
      },
      stdio: "pipe",
    },
  )
}

async function verifyConsumerInstall(absoluteTarball, expectedVersion, target) {
  const consumerRoot = mkdtempSync(join(tmpdir(), "persona-shared-skills-installed-"))
  try {
    installConsumerTarball(consumerRoot, absoluteTarball, target)
    assertInstalledDependencyGraph(consumerRoot, expectedVersion)

    const packageRoot = join(consumerRoot, "node_modules", "persona-harness")
    const resolvedPackageRoot = realpathSync(packageRoot)
    const resolvedConsumerRoot = realpathSync(consumerRoot)
    if (dirname(resolvedPackageRoot) !== join(resolvedConsumerRoot, "node_modules")) {
      throw new Error("installed shared-skill package used a source fallback")
    }

    assertInstalledCatalog(resolvedPackageRoot, expectedVersion)
    assertPortableConsumerInstallSurface(resolvedPackageRoot, resolvedConsumerRoot)
    if (target?.os === "win32") assertWindowsNpmBinLinkSurface(resolvedConsumerRoot)
    if (target === undefined) await assertInstalledRuntime(resolvedPackageRoot, resolvedConsumerRoot)
  } finally {
    rmSync(consumerRoot, { recursive: true, force: true })
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

  assertWindowsPackageInstallSurface(readFileSync(absoluteTarball))

  await verifyConsumerInstall(absoluteTarball, expectedVersion)
  await verifyConsumerInstall(absoluteTarball, expectedVersion, { cpu: "x64", os: "win32" })
  process.stdout.write("Persona shared-skills installed package contract: PASS (sourceFallback=false)\n")
}

function isContained(root, candidate) {
  const relation = relative(resolve(root), candidate)
  return relation !== "" && !relation.startsWith(`..${sep}`) && relation !== ".." && !relation.startsWith(sep)
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
