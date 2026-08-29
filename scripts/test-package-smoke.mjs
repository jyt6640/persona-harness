#!/usr/bin/env node
import { createHash } from "node:crypto"
import { spawnSync } from "node:child_process"
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, dirname, join, resolve } from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

import { runContextCompatibilityManifest } from "./context-compatibility-manifest-runner.mjs"
import { readPackageContentIdentity } from "./package-content-identity.mjs"

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const temporaryRoot = realpathSync(mkdtempSync(join(tmpdir(), "persona-package-smoke-")))
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm"

class PackageSmokeError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

try {
  const packageIdentity = readPackageIdentity(join(repositoryRoot, "package.json"))
  const pack = run(npmCommand, ["pack", "--json", "--pack-destination", temporaryRoot], repositoryRoot, "package-pack")
  const tarball = readPackResult(pack.stdout)
  const tarballPath = join(temporaryRoot, tarball.filename)
  assertRegularFile(tarballPath, "package-tarball")
  assertPackedFiles(tarball.files)

  const consumerRoot = join(temporaryRoot, "consumer")
  writeFileSync(
    join(temporaryRoot, "consumer-package.json"),
    `${JSON.stringify({ name: "persona-package-smoke-consumer", private: true, type: "module" }, null, 2)}\n`,
  )
  run(process.execPath, ["-e", consumerSetupSource(), consumerRoot, join(temporaryRoot, "consumer-package.json")], temporaryRoot, "consumer-setup")
  run(
    npmCommand,
    ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--no-package-lock", tarballPath],
    consumerRoot,
    "package-install",
  )

  const installedRoot = join(consumerRoot, "node_modules", packageIdentity.name)
  assertRegularDirectory(installedRoot, "installed-package-root")
  const cliPath = join(installedRoot, "dist", "cli", "index.js")
  const contextCompatibility = runContextCompatibilityManifest(contextCompatibilityManifest(packageIdentity, tarballPath), {
    archivePath: tarballPath,
    installedPackageRoot: installedRoot,
    sourceRoot: repositoryRoot,
    temporaryRoot,
  })
  if (contextCompatibility.state !== "PASS") throw new PackageSmokeError(contextCompatibility.code)

  const help = run(process.execPath, [cliPath, "--help"], consumerRoot, "installed-cli-help")
  if (!help.stdout.includes("Usage: ph <command>")) throw new PackageSmokeError("installed-cli-help")
  const installedNpmTest = run(npmCommand, ["test"], installedRoot, "installed-npm-test")
  if (
    !installedNpmTest.stdout.includes("Persona Harness installed package smoke")
    || !installedNpmTest.stdout.includes("Usage: ph <command>")
  ) {
    throw new PackageSmokeError("installed-npm-test")
  }
  const version = run(process.execPath, [cliPath, "version"], consumerRoot, "installed-cli-version")
  if (version.stdout.trim() !== packageIdentity.version) throw new PackageSmokeError("installed-cli-version")
  const contextDoctor = run(process.execPath, [cliPath, "context", "doctor"], consumerRoot, "installed-context-doctor")
  if (!contextDoctor.stdout.includes("Context Doctor (Experimental)")) throw new PackageSmokeError("installed-context-doctor")
  const contextInit = run(process.execPath, [cliPath, "context", "init", "--enable"], consumerRoot, "installed-context-init")
  if (!contextInit.stdout.includes("Initialization: enabled")) throw new PackageSmokeError("installed-context-init")
  const enabledContextStatus = run(process.execPath, [cliPath, "context", "status"], consumerRoot, "installed-context-enabled-status")
  if (!enabledContextStatus.stdout.includes("Context enabled: true")) throw new PackageSmokeError("installed-context-enabled-status")
  const contextTarget = join(consumerRoot, "src", "main", "java", "example", "CustomerService.java")
  mkdirSync(dirname(contextTarget), { recursive: true })
  writeFileSync(contextTarget, "package example\n")
  const contextDelivery = run(
    process.execPath,
    ["--input-type=module", "-e", installedContextDeliverySource(), consumerRoot, "src/main/java/example/CustomerService.java"],
    consumerRoot,
    "installed-opencode-context-delivery",
  )
  if (!contextDelivery.stdout.includes("installed-opencode-context-delivery: PASS")) {
    throw new PackageSmokeError("installed-opencode-context-delivery")
  }

  run(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      "await import('persona-harness'); await import('persona-harness/effective-profile'); await import('persona-harness/portable-skill')",
    ],
    consumerRoot,
    "installed-package-exports",
  )

  process.stdout.write("package-smoke: PASS\n")
} catch (error) {
  process.stderr.write(`${error instanceof PackageSmokeError ? error.code : "package-smoke-failed"}\n`)
  process.exitCode = 1
} finally {
  rmSync(temporaryRoot, { force: true, recursive: true })
}

function readPackageIdentity(path) {
  const parsed = parseJson(readFileSync(path, "utf8"), "package-identity")
  if (!isRecord(parsed) || typeof parsed.name !== "string" || typeof parsed.version !== "string") {
    throw new PackageSmokeError("package-identity")
  }
  return { name: parsed.name, version: parsed.version }
}

function contextCompatibilityManifest(packageIdentity, tarballPath) {
  const tarball = readFileSync(tarballPath)
  return {
    package: {
      contentIdentity: readPackageContentIdentity(tarball),
      name: packageIdentity.name,
      tarballSha256: sha256(tarball),
      version: packageIdentity.version,
    },
    requiredPackagePaths: [
      "dist/cli/context-command.js",
      "dist/cli/index.js",
      "dist/context-core/context-envelope-builder.js",
      "dist/context-core/index.js",
    ],
    scenarios: [
      "status-default",
      "preview-safe-target",
      "explain-safe-target",
      "init-preview-no-write",
      "init-enable-no-overwrite",
      "invalid-config",
    ],
    schemaVersion: "persona-context-compatibility-manifest.1",
    sourceFallback: false,
  }
}

function readPackResult(stdout) {
  const parsed = parseJson(stdout, "package-pack-output")
  if (!Array.isArray(parsed) || parsed.length !== 1 || !isRecord(parsed[0])) {
    throw new PackageSmokeError("package-pack-output")
  }
  const record = parsed[0]
  if (
    typeof record.filename !== "string"
    || basename(record.filename) !== record.filename
    || !record.filename.endsWith(".tgz")
    || !Array.isArray(record.files)
  ) {
    throw new PackageSmokeError("package-pack-output")
  }
  return { filename: record.filename, files: record.files }
}

function assertPackedFiles(files) {
  const paths = new Set()
  for (const entry of files) {
    if (!isRecord(entry) || typeof entry.path !== "string") throw new PackageSmokeError("package-file-list")
    paths.add(entry.path)
  }
  for (const required of ["dist/cli/index.js", "dist/index.js", "package.json"]) {
    if (!paths.has(required)) throw new PackageSmokeError("package-file-list")
  }
}

function assertRegularFile(path, code) {
  if (!existsSync(path)) throw new PackageSmokeError(code)
  const stat = lstatSync(path)
  if (!stat.isFile() || stat.isSymbolicLink()) throw new PackageSmokeError(code)
}

function assertRegularDirectory(path, code) {
  if (!existsSync(path)) throw new PackageSmokeError(code)
  const stat = lstatSync(path)
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new PackageSmokeError(code)
}

function run(command, args, cwd, code) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      APPDATA: join(temporaryRoot, "appdata"),
      HOME: join(temporaryRoot, "home"),
      PH_HOME: join(temporaryRoot, "persona-state"),
      USERPROFILE: join(temporaryRoot, "home"),
      XDG_CONFIG_HOME: join(temporaryRoot, "xdg-config"),
      npm_config_audit: "false",
      npm_config_cache: join(temporaryRoot, "npm-cache"),
      npm_config_fund: "false",
    },
    maxBuffer: 16 * 1024 * 1024,
    timeout: 120_000,
  })
  if (result.error !== undefined || result.status !== 0) throw new PackageSmokeError(code)
  return { stderr: result.stderr, stdout: result.stdout }
}

function parseJson(source, code) {
  try {
    return JSON.parse(source)
  } catch {
    throw new PackageSmokeError(code)
  }
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex")
}

function consumerSetupSource() {
  return [
    "const fs=require('node:fs')",
    "const [root, source]=process.argv.slice(1)",
    "fs.mkdirSync(root,{recursive:true})",
    "fs.copyFileSync(source,require('node:path').join(root,'package.json'))",
  ].join(";")
}

function installedContextDeliverySource() {
  return [
    "const [projectDir,targetFile]=process.argv.slice(1)",
    "const { PersonaHarnessPlugin }=await import('persona-harness')",
    "const sessionID='package-context'",
    "const hooks=await PersonaHarnessPlugin({client:{},directory:projectDir,experimental_workspace:{register:()=>{}},project:{},serverUrl:new URL('http://localhost'),worktree:projectDir,$:{}},{})",
    "await hooks['tool.execute.after']?.({args:{filePath:targetFile},callID:'call-1',sessionID,tool:'read'},{metadata:{},output:'ok',title:'read'})",
    "const output={messages:[{info:{agent:'build',id:'message-1',model:{modelID:'test-model',providerID:'test'},role:'user',sessionID,time:{created:1}},parts:[{id:'part-1',messageID:'message-1',sessionID,text:'Create the service.',type:'text'}]}]}",
    "await hooks['experimental.chat.messages.transform']?.({},output)",
    "const text=output.messages[0]?.parts[0]?.text",
    "if(typeof text!=='string'||!text.includes('[Persona Harness Context]')||text.includes('[Persona Harness Runtime Context]'))process.exit(1)",
    "process.stdout.write('installed-opencode-context-delivery: PASS\\n')",
  ].join(";")
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
