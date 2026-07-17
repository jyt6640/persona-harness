import { spawnSync } from "node:child_process"
import { copyFileSync, existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const temporaryRoot = mkdtempSync(join(tmpdir(), "persona-installed-package-contract-"))
const consumerNpmCache = join(temporaryRoot, "npm-cache")

try {
  const tarballPath = packCurrentRepository()
  const { consumerDirectory, installedPackage } = installFreshTarball(tarballPath)

  assertRepositoryOnlyFilesAreAbsent(installedPackage)
  assertPackagedVerifierFailsClosedWithoutSourceCheckout(installedPackage, consumerDirectory)
  assertPackagedStagedArtifactVerifierWorksWithoutSourceCheckout(installedPackage, consumerDirectory)
  assertInstalledPackageTestPasses(installedPackage)
  process.stdout.write("installed-package-test-contract: PASS\n")
} finally {
  rmSync(temporaryRoot, { force: true, recursive: true })
}

function packCurrentRepository() {
  const packDirectory = join(temporaryRoot, "pack")
  mkdirSync(packDirectory)
  const result = runNpm(repositoryRoot, ["pack", "--json", "--pack-destination", packDirectory])
  requireSuccess("package pack", result)
  return resolvePackTarball(result.stdout, packDirectory)
}

function installFreshTarball(tarballPath) {
  const consumerDirectory = join(temporaryRoot, "consumer")
  mkdirSync(consumerDirectory)
  mkdirSync(consumerNpmCache)
  writeFileSync(
    join(consumerDirectory, "package.json"),
    `${JSON.stringify({ private: true }, null, 2)}\n`,
  )

  const result = runNpm(consumerDirectory, [
    "install",
    "--cache",
    consumerNpmCache,
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    tarballPath,
  ])
  requireSuccess("fresh package installation", result)
  return {
    consumerDirectory,
    installedPackage: join(consumerDirectory, "node_modules", "persona-harness"),
  }
}

function assertRepositoryOnlyFilesAreAbsent(installedPackage) {
  if (existsSync(join(installedPackage, "tests"))) {
    throw new Error("installed package unexpectedly contains repository tests")
  }
  if (existsSync(join(installedPackage, "scripts", "check-mvp-scope.mjs"))) {
    throw new Error("installed package unexpectedly contains repository scope checks")
  }
}

function assertInstalledPackageTestPasses(installedPackage) {
  const result = runNpm(installedPackage, ["test"])
  requireSuccess("installed package test", result)
  if (!result.stdout.includes("Persona Harness")) {
    throw new Error("installed package test did not reach the packaged CLI help surface")
  }
}

function assertPackagedVerifierFailsClosedWithoutSourceCheckout(installedPackage, consumerDirectory) {
  const workerPath = join(installedPackage, "scripts", "verify-finish-attestation.mjs")
  if (!existsSync(workerPath)) {
    throw new Error("installed package is missing the product-owned verifier worker")
  }
  const bundlePath = join(consumerDirectory, ".persona", "evidence", "finish-attestation", "bundle.json")
  mkdirSync(dirname(bundlePath), { recursive: true })
  copyFileSync(
    join(repositoryRoot, "tests", "fixtures", "finish-attestation", "protected-main-29511625395.bundle.json"),
    bundlePath,
  )
  const modulePath = join(installedPackage, "dist", "cli", "workflow-finish-attestation.js")
  const probe = runNode(consumerDirectory, [
    "--input-type=module",
    "-e",
    `import { verifyExternalFinishAttestation } from ${JSON.stringify(modulePath)}; const result = verifyExternalFinishAttestation(process.cwd(), new Date("2026-07-16T16:00:00.000Z"), { consume: false }); if (result.authorityEligible || result.state !== "source-drift") process.exit(1);`,
  ])
  requireSuccess("installed packaged verifier fail-closed probe", probe)
}

function assertPackagedStagedArtifactVerifierWorksWithoutSourceCheckout(installedPackage, consumerDirectory) {
  const fixtureRoot = join(consumerDirectory, "staged-artifact-fixture")
  const packageFixtureRoot = join(repositoryRoot, "tests", "fixtures", "staged-package-artifact", "rc6")
  const corePath = join(installedPackage, "scripts", "staged-package-artifact-provenance-core.mjs")
  const workerPath = join(installedPackage, "scripts", "verify-staged-package-artifact-attestation.mjs")
  const phPath = join(consumerDirectory, "node_modules", ".bin", "ph")
  mkdirSync(fixtureRoot)
  for (const fileName of ["action-run.json", "bundle.json", "package.tgz"]) {
    copyFileSync(join(packageFixtureRoot, fileName), join(fixtureRoot, fileName))
  }
  if (!existsSync(corePath) || !existsSync(workerPath)) {
    throw new Error("installed package is missing staged artifact provenance code")
  }
  const help = runNode(consumerDirectory, [phPath, "dev", "staged-package-provenance", "--help"])
  requireSuccess("installed staged artifact verifier help", help)
  const probe = runNode(consumerDirectory, [
    "--input-type=module",
    "-e",
    [
      `import { verifyStagedPackageArtifactEvidence } from ${JSON.stringify(pathToFileURL(corePath).href)};`,
      'import { readFileSync } from "node:fs";',
      'import { join } from "node:path";',
      'const fixture = join(process.cwd(), "staged-artifact-fixture");',
      'const read = (name) => JSON.parse(readFileSync(join(fixture, name), "utf8"));',
      'const tarball = readFileSync(join(fixture, "package.tgz"));',
      'const attestation = { bundle: read("bundle.json"), repository_id: 1272008570 };',
      'const result = await verifyStagedPackageArtifactEvidence({',
      '  actionRun: read("action-run.json"),',
      '  attestation,',
      '  attestations: [attestation],',
      '  channel: "staging",',
      '  now: new Date("2026-07-17T12:00:00.000Z"),',
      '  registryIndex: { "dist-tags": { staging: "0.7.0-rc.6" } },',
      '  registryVersion: {',
      '    dist: { integrity: "sha512-Gf3g0U4YZ3fmD327ruboyPCEctMITx+0X9l7iUN9IKD82jWygwxVZS+tiYvYRSAn1udYW5Lq8QwldZ+4n7mY7Q==", shasum: "3fa7e7579e885ee9446f2e4b55bdaa13b1abf80e", tarball: "https://registry.npmjs.org/persona-harness/-/persona-harness-0.7.0-rc.6.tgz" },',
      '    gitHead: "1c8976c58102908329f63dc78286b2646bfc52dd",',
      '    name: "persona-harness",',
      '    version: "0.7.0-rc.6",',
      '  },',
      '  tarballBytes: tarball,',
      '  version: "0.7.0-rc.6",',
      '});',
      'if (result.channel !== "staging" || result.version !== "0.7.0-rc.6" || result.subjectDigest !== "sha256:37f679a0125c354d5f5c5c8ad933fe7a6e7d9e6df6ab892afdf06ed2310b7794") process.exit(1);',
    ].join("\n"),
  ])
  requireSuccess("installed staged artifact verifier exact-byte probe", probe)
}

function runNpm(cwd, args) {
  const result = spawnSync("npm", args, {
    cwd,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 4 * 1024 * 1024,
  })
  if (result.error) {
    throw new Error("npm process could not start")
  }
  return {
    status: result.status,
    stdout: result.stdout ?? "",
  }
}

function runNode(cwd, args) {
  const result = spawnSync(process.execPath, args, {
    cwd,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 4 * 1024 * 1024,
  })
  if (result.error) {
    throw new Error("node process could not start")
  }
  return {
    status: result.status,
    stdout: result.stdout ?? "",
  }
}

function requireSuccess(label, result) {
  if (result.status !== 0) {
    throw new Error(`${label} failed`)
  }
}

function resolvePackTarball(output, packDirectory) {
  const parsed = JSON.parse(output)
  if (!Array.isArray(parsed) || parsed.length !== 1 || !isRecord(parsed[0]) || typeof parsed[0].filename !== "string") {
    throw new TypeError("npm pack did not return exactly one tarball")
  }

  const filename = parsed[0].filename
  const candidate = isAbsolute(filename)
    ? filename
    : join(packDirectory, basename(filename))
  const relativeCandidate = relative(packDirectory, candidate)
  if (relativeCandidate === "" || relativeCandidate.startsWith(`..${sep}`) || isAbsolute(relativeCandidate)) {
    throw new TypeError("npm pack returned a tarball outside the pack directory")
  }
  if (!existsSync(candidate)) {
    throw new TypeError("npm pack tarball is missing")
  }
  return candidate
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
