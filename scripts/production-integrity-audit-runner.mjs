import { spawnSync } from "node:child_process"
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { basename, join, relative, resolve, sep } from "node:path"

import {
  assessProductionIntegrityAudit,
  PRODUCTION_INTEGRITY_AUDIT_CHANNEL,
  PRODUCTION_INTEGRITY_AUDIT_PACKAGE,
} from "./production-integrity-audit-core.mjs"
import { runInstalledCompletionIntegrityMatrix } from "./stable-promotion-completion-integrity-runner.mjs"
import { readStagedTarballFacts, StagedTarballError } from "./staged-package-artifact-tarball.mjs"

const REGISTRY = "https://registry.npmjs.org"
const SUMMARY_PATH = ".ci/production-integrity-audit/summary.json"
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024

export function runProductionIntegrityAudit(root = process.cwd(), env = process.env) {
  const projectRoot = resolve(root)
  const temporaryRoot = mkdtempSync(join(tmpdir(), "persona-production-integrity-audit-"))
  try {
    const context = readContext(env)
    const version = readVersion(projectRoot)
    const sourceTests = run("npm", ["run", "test:repository"], projectRoot)
    const sourceBuild = sourceTests.status === 0
      ? run("npm", ["run", "build"], projectRoot)
      : unavailableCommand()
    const sourceReady = sourceTests.status === 0 && sourceBuild.status === 0
    const sourceTarball = sourceReady ? pack(projectRoot, temporaryRoot, [], version) : undefined
    const registryMetadata = sourceReady ? readRegistryMetadata(projectRoot, version) : undefined
    const registryTarball = sourceReady
      ? pack(projectRoot, temporaryRoot, [`${PRODUCTION_INTEGRITY_AUDIT_PACKAGE}@${version}`], version)
      : undefined
    const registryConsumer = sourceReady ? installRegistryConsumer(temporaryRoot, version) : unavailableConsumer()
    const matrix = registryConsumer.consumer === undefined
      ? undefined
      : runInstalledCompletionIntegrityMatrix(registryConsumer.consumer, temporaryRoot)
    const matrixStatus = matrix !== undefined && Object.values(matrix).every((value) => value) ? 0 : 1
    const provenance = sourceReady && registryTarball !== undefined
      ? verifyProvenance(projectRoot, version, context.sourceHead, registryTarball.facts.sha256)
      : unavailableCommand()
    return assessProductionIntegrityAudit({
      commandResults: {
        fixedProvenanceVerifier: provenance.status,
        installedAdversarialMatrix: matrixStatus,
        installedRegistryContract: registryConsumer.status,
        sourceBuild: sourceBuild.status,
        sourceRepositoryContract: sourceTests.status,
      },
      registry: registryMetadata === undefined || registryTarball === undefined
        ? undefined
        : {
            gitHead: registryMetadata.gitHead,
            integrity: registryMetadata.integrity,
            shasum: registryMetadata.shasum,
            stagingVersion: registryMetadata.stagingVersion,
            tarball: registryTarball.facts,
            version: registryMetadata.version,
          },
      sourceHead: context.sourceHead,
      sourceTarball: sourceTarball?.facts,
      version,
    })
  } catch {
    return assessProductionIntegrityAudit({ commandResults: unavailableCommandResults() })
  } finally {
    rmSync(temporaryRoot, { force: true, recursive: true })
  }
}

export function writeProductionIntegrityAuditSummary(root, summary) {
  const projectRoot = resolve(root)
  const outputDirectory = resolve(projectRoot, ".ci", "production-integrity-audit")
  if (!isContained(projectRoot, outputDirectory)) throw new TypeError("audit output root is unsafe")
  ensureDirectory(projectRoot, join(projectRoot, ".ci"))
  ensureDirectory(projectRoot, outputDirectory)
  const output = join(outputDirectory, "summary.json")
  if (existsSync(output) && lstatSync(output).isSymbolicLink()) throw new TypeError("audit output is unsafe")
  const temporary = join(outputDirectory, "summary.json.tmp")
  writeFileSync(temporary, `${JSON.stringify(summary)}\n`, { mode: 0o600 })
  renameSync(temporary, output)
  return SUMMARY_PATH
}

function readContext(env) {
  if (
    env.GITHUB_REPOSITORY !== "jyt6640/persona-harness"
    || env.GITHUB_REF !== "refs/heads/main"
    || typeof env.GITHUB_SHA !== "string"
    || !/^[a-f0-9]{40}$/u.test(env.GITHUB_SHA)
  ) {
    throw new TypeError("audit context is invalid")
  }
  return { sourceHead: env.GITHUB_SHA }
}

function readVersion(root) {
  const parsed = JSON.parse(readFileSync(join(root, "package.json"), "utf8"))
  if (typeof parsed?.version !== "string" || !/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u.test(parsed.version)) {
    throw new TypeError("audit version is invalid")
  }
  return parsed.version
}

function readRegistryMetadata(root, version) {
  const metadataResult = run("npm", ["view", `${PRODUCTION_INTEGRITY_AUDIT_PACKAGE}@${version}`, "version", "gitHead", "dist.shasum", "dist.integrity", "--json", "--registry", REGISTRY], root)
  const tagsResult = run("npm", ["view", PRODUCTION_INTEGRITY_AUDIT_PACKAGE, "dist-tags", "--json", "--registry", REGISTRY], root)
  if (metadataResult.status !== 0 || tagsResult.status !== 0) return undefined
  try {
    const metadata = JSON.parse(metadataResult.stdout)
    const tags = JSON.parse(tagsResult.stdout)
    if (
      typeof metadata !== "object" || metadata === null || Array.isArray(metadata)
      || typeof tags !== "object" || tags === null || Array.isArray(tags)
      || metadata.version !== version
      || typeof metadata.gitHead !== "string"
      || !/^[a-f0-9]{40}$/u.test(metadata.gitHead)
      || typeof metadata["dist.integrity"] !== "string"
      || !/^sha512-[A-Za-z0-9+/=]+$/u.test(metadata["dist.integrity"])
      || typeof metadata["dist.shasum"] !== "string"
      || !/^[a-f0-9]{40}$/u.test(metadata["dist.shasum"])
      || typeof tags[PRODUCTION_INTEGRITY_AUDIT_CHANNEL] !== "string"
    ) {
      return undefined
    }
    return {
      gitHead: metadata.gitHead,
      integrity: metadata["dist.integrity"],
      shasum: metadata["dist.shasum"],
      stagingVersion: tags[PRODUCTION_INTEGRITY_AUDIT_CHANNEL],
      version: metadata.version,
    }
  } catch {
    return undefined
  }
}

function pack(root, temporaryRoot, specifier, version) {
  const outputDirectory = mkdtempSync(join(temporaryRoot, "pack-"))
  const result = run("npm", ["pack", ...specifier, "--json", "--pack-destination", outputDirectory, "--registry", REGISTRY], root)
  if (result.status !== 0) return undefined
  try {
    const parsed = JSON.parse(result.stdout)
    if (!Array.isArray(parsed) || parsed.length !== 1 || typeof parsed[0]?.filename !== "string") return undefined
    const path = resolve(outputDirectory, basename(parsed[0].filename))
    if (!isContained(outputDirectory, path) || !existsSync(path) || lstatSync(path).isSymbolicLink()) return undefined
    const facts = readStagedTarballFacts(readFileSync(path), PRODUCTION_INTEGRITY_AUDIT_PACKAGE, version)
    return { facts, path }
  } catch (error) {
    if (error instanceof StagedTarballError) return undefined
    return undefined
  }
}

function installRegistryConsumer(temporaryRoot, version) {
  const consumerDirectory = join(temporaryRoot, "registry-consumer")
  const cache = join(temporaryRoot, "registry-consumer-cache")
  mkdirSync(consumerDirectory, { recursive: true })
  mkdirSync(cache, { recursive: true })
  writeFileSync(join(consumerDirectory, "package.json"), "{\"private\":true}\n", { mode: 0o600 })
  const install = run("npm", [
    "install",
    "--cache",
    cache,
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    "--no-save",
    "--package-lock=false",
    "--registry",
    REGISTRY,
    `${PRODUCTION_INTEGRITY_AUDIT_PACKAGE}@${version}`,
  ], consumerDirectory)
  if (install.status !== 0) return { consumer: undefined, status: install.status }
  const packageRoot = join(consumerDirectory, "node_modules", PRODUCTION_INTEGRITY_AUDIT_PACKAGE)
  const cliPath = join(packageRoot, "dist", "cli", "index.js")
  if (!existsSync(join(packageRoot, "package.json")) || !existsSync(cliPath)) return { consumer: undefined, status: 1 }
  try {
    const packageJson = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"))
    if (packageJson?.name !== PRODUCTION_INTEGRITY_AUDIT_PACKAGE || packageJson?.version !== version) return { consumer: undefined, status: 1 }
    return {
      consumer: {
        cliPath,
        consumerDir: consumerDirectory,
        consumerRoot: resolve(consumerDirectory),
        packageName: packageJson.name,
        packageRoot,
        version: packageJson.version,
      },
      status: 0,
    }
  } catch {
    return { consumer: undefined, status: 1 }
  }
}

function verifyProvenance(root, version, sourceHead, subjectDigest) {
  const result = run(process.execPath, [
    join(root, "dist", "cli", "index.js"),
    "dev",
    "staged-package-provenance",
    "--channel",
    PRODUCTION_INTEGRITY_AUDIT_CHANNEL,
    "--version",
    version,
    "--json",
  ], root)
  if (result.status !== 0) return { status: result.status }
  try {
    const parsed = JSON.parse(result.stdout)
    const verified = parsed?.verificationStatus === "verified"
      && parsed?.authorityEligible === false
      && parsed?.promotionAuthorized === false
      && parsed?.promotionDecision === "release-approval-required"
      && parsed?.registryMutation === "not-performed"
      && parsed?.sourceHead === sourceHead
      && parsed?.subjectDigest === subjectDigest
    return { status: verified ? 0 : 1 }
  } catch {
    return { status: 1 }
  }
}

function unavailableConsumer() {
  return { consumer: undefined, status: 1 }
}

function unavailableCommand() {
  return { status: 1 }
}

function unavailableCommandResults() {
  return {
    fixedProvenanceVerifier: 1,
    installedAdversarialMatrix: 1,
    installedRegistryContract: 1,
    sourceBuild: 1,
    sourceRepositoryContract: 1,
  }
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, npm_config_registry: REGISTRY },
    maxBuffer: MAX_OUTPUT_BYTES,
    stdio: ["ignore", "pipe", "pipe"],
  })
  return {
    status: typeof result.status === "number" ? result.status : 1,
    stdout: result.stdout ?? "",
  }
}

function ensureDirectory(root, directory) {
  if (existsSync(directory)) {
    if (!lstatSync(directory).isDirectory() || lstatSync(directory).isSymbolicLink()) throw new TypeError("audit output is unsafe")
    return
  }
  if (!isContained(root, directory)) throw new TypeError("audit output root is unsafe")
  mkdirSync(directory, { mode: 0o700 })
}

function isContained(root, candidate) {
  const relativePath = relative(root, candidate)
  return relativePath !== "" && !relativePath.startsWith(`..${sep}`) && !relativePath.includes(`..${sep}`) && !relativePath.startsWith("..") && !relativePath.startsWith(sep)
}
