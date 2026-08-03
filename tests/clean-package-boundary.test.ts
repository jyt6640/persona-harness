import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  assertBundleHeadBinding,
  assertCheckoutPackageBinding,
  assertNpmExecutionPolicy,
  assertPackageExecutionBinding,
  assertPackRecordBinding,
  assertSourcePackageIdentity,
} from "../scripts/clean-package-boundary-core.mjs"

const BASE = "a".repeat(40)
const HEAD = "b".repeat(40)
const SHA = "c".repeat(64)
const CANDIDATE_REF = "refs/heads/fix/consumer-authority-beta18-bundle-ref-binding"
const IDENTITY = {
  name: "persona-harness",
  version: "0.8.0-beta.15",
}

describe("clean package boundary", () => {
  it("accepts the configured canonical candidate branch without a literal HEAD alias", () => {
    expect(assertBundleHeadBinding([
      { ref: CANDIDATE_REF, sha: HEAD },
      { ref: "refs/remotes/origin/main", sha: BASE },
    ], { base: BASE, candidateRef: CANDIDATE_REF, head: HEAD })).toEqual({
      base: BASE,
      candidateRef: CANDIDATE_REF,
      head: HEAD,
    })
  })

  it("rejects a wrong, absent, or conflicting canonical candidate branch", () => {
    const expected = { base: BASE, candidateRef: CANDIDATE_REF, head: HEAD }

    expect(() => assertBundleHeadBinding([
      { ref: "refs/heads/foreign", sha: HEAD },
      { ref: "refs/remotes/origin/main", sha: BASE },
    ], expected)).toThrow("clean-package-bundle-candidate-ref")
    expect(() => assertBundleHeadBinding([
      { ref: "HEAD", sha: HEAD },
      { ref: "refs/remotes/origin/main", sha: BASE },
    ], expected)).toThrow("clean-package-bundle-candidate-ref")
    expect(() => assertBundleHeadBinding([
      { ref: CANDIDATE_REF, sha: HEAD },
      { ref: "refs/heads/foreign", sha: HEAD },
      { ref: "refs/remotes/origin/main", sha: BASE },
    ], expected)).toThrow("clean-package-bundle-candidate-ambiguity")
  })

  it("rejects a candidate SHA mismatch, only-base bundle, and stale or foreign HEAD alias", () => {
    const expected = { base: BASE, candidateRef: CANDIDATE_REF, head: HEAD }

    expect(() => assertBundleHeadBinding([
      { ref: CANDIDATE_REF, sha: BASE },
      { ref: "refs/remotes/origin/main", sha: BASE },
    ], expected)).toThrow("clean-package-bundle-candidate-sha")
    expect(() => assertBundleHeadBinding([
      { ref: "refs/remotes/origin/main", sha: BASE },
    ], expected)).toThrow("clean-package-bundle-candidate-ref")
    expect(() => assertBundleHeadBinding([
      { ref: "HEAD", sha: BASE },
      { ref: CANDIDATE_REF, sha: HEAD },
      { ref: "refs/remotes/origin/main", sha: BASE },
    ], expected)).toThrow("clean-package-bundle-head")
    expect(() => assertBundleHeadBinding([
      { ref: CANDIDATE_REF, sha: HEAD },
      { ref: "refs/remotes/origin/main", sha: HEAD },
    ], expected)).toThrow("clean-package-bundle-main")
  })

  it("rejects duplicate or unknown bundle refs before package work", () => {
    const expected = { base: BASE, candidateRef: CANDIDATE_REF, head: HEAD }

    expect(() => assertBundleHeadBinding([
      { ref: CANDIDATE_REF, sha: HEAD },
      { ref: "refs/remotes/origin/main", sha: BASE },
      { ref: "refs/tags/foreign", sha: HEAD },
    ], expected)).toThrow("clean-package-bundle-ref")
    expect(() => assertBundleHeadBinding([
      { ref: CANDIDATE_REF, sha: HEAD },
      { ref: "refs/remotes/origin/main", sha: BASE },
      { ref: "HEAD", sha: HEAD },
      { ref: "HEAD", sha: HEAD },
    ], expected)).toThrow("clean-package-bundle-shape")
    expect(() => assertBundleHeadBinding([
      { ref: CANDIDATE_REF, sha: HEAD },
      { ref: "refs/remotes/origin/main", sha: BASE },
    ], { ...expected, candidateRef: "refs/tags/foreign" })).toThrow("clean-package-bundle-shape")
  })

  it("rejects package and lock version drift before packing", () => {
    expect(() => assertSourcePackageIdentity(
      { name: IDENTITY.name, version: IDENTITY.version },
      { packages: { "": { name: IDENTITY.name, version: "0.8.0-beta.1" } } },
    )).toThrow("clean-package-lock-version")
  })

  it("rejects an npm pack record from an old package version", () => {
    expect(() => assertPackRecordBinding({
      filename: "persona-harness-0.8.0-beta.1.tgz",
      name: IDENTITY.name,
      version: "0.8.0-beta.1",
    }, IDENTITY)).toThrow("clean-package-pack-version")
  })

  it("rejects a stale package root even when its manifest shape is valid", () => {
    expect(() => assertCheckoutPackageBinding({
      gitRoot: "/fresh/bundle-checkout",
      headLockSha256: SHA,
      headPackageSha256: SHA,
      lockSha256: SHA,
      npmPrefix: "/stale/beta1-checkout",
      packageSha256: SHA,
      root: "/fresh/bundle-checkout",
    })).toThrow("clean-package-root-npm")
  })

  it("rejects a package manifest changed after checkout before npm can pack it", () => {
    expect(() => assertCheckoutPackageBinding({
      gitRoot: "/fresh/bundle-checkout",
      headLockSha256: SHA,
      headPackageSha256: SHA,
      lockSha256: SHA,
      npmPrefix: "/fresh/bundle-checkout",
      packageSha256: "d".repeat(64),
      root: "/fresh/bundle-checkout",
    })).toThrow("clean-package-package-drift")
  })

  it("rejects a launcher CWD or manifest path that is not the exact checkout root", () => {
    const binding = {
      commandCwd: "/fresh/bundle-checkout",
      expectedLockPath: "/fresh/bundle-checkout/package-lock.json",
      expectedPackagePath: "/fresh/bundle-checkout/package.json",
      gitRoot: "/fresh/bundle-checkout",
      lockPath: "/fresh/bundle-checkout/package-lock.json",
      npmPrefix: "/fresh/bundle-checkout",
      packagePath: "/fresh/bundle-checkout/package.json",
      root: "/fresh/bundle-checkout",
    }

    expect(assertPackageExecutionBinding(binding)).toEqual({ root: "/fresh/bundle-checkout" })
    expect(() => assertPackageExecutionBinding({ ...binding, commandCwd: "/stale/beta1-launcher" })).toThrow("clean-package-command-cwd")
    expect(() => assertPackageExecutionBinding({ ...binding, packagePath: "/stale/beta1-launcher/package.json" })).toThrow("clean-package-package-path")
  })

  it("rejects inherited workspace or ignore-scripts mode", () => {
    expect(() => assertNpmExecutionPolicy({
      global: "false",
      ignoreScripts: "true",
      workspaces: "false",
    })).toThrow("clean-package-npm-ignore-scripts")
    expect(() => assertNpmExecutionPolicy({
      global: "false",
      ignoreScripts: "false",
      workspaces: "true",
    })).toThrow("clean-package-npm-workspaces")
  })

  it("accepts the exact bundle, checkout root, immutable manifests, and fixed npm policy", () => {
    expect(assertSourcePackageIdentity(
      { name: IDENTITY.name, version: IDENTITY.version },
      { packages: { "": IDENTITY } },
    )).toEqual(IDENTITY)
    expect(assertBundleHeadBinding([
      { ref: "HEAD", sha: HEAD },
      { ref: CANDIDATE_REF, sha: HEAD },
      { ref: "refs/remotes/origin/main", sha: BASE },
    ], { base: BASE, candidateRef: CANDIDATE_REF, head: HEAD })).toEqual({
      base: BASE,
      candidateRef: CANDIDATE_REF,
      head: HEAD,
    })
    expect(assertCheckoutPackageBinding({
      gitRoot: "/fresh/bundle-checkout",
      headLockSha256: SHA,
      headPackageSha256: SHA,
      lockSha256: SHA,
      npmPrefix: "/fresh/bundle-checkout",
      packageSha256: SHA,
      root: "/fresh/bundle-checkout",
    })).toEqual({ root: "/fresh/bundle-checkout" })
    expect(assertNpmExecutionPolicy({
      global: "false",
      ignoreScripts: "false",
      workspaces: "false",
    })).toEqual({ global: "false", ignoreScripts: "false", workspaces: "false" })
    expect(assertPackRecordBinding({
      filename: "persona-harness-0.8.0-beta.15.tgz",
      name: IDENTITY.name,
      version: IDENTITY.version,
    }, IDENTITY)).toEqual(IDENTITY)
  })

  it("uses the shared portable consumer contract for authoritative bundle exercise mode", () => {
    const verifier = readFileSync(join(process.cwd(), "scripts", "verify-clean-package-boundary.mjs"), "utf8")
    const contract = readFileSync(join(process.cwd(), "scripts", "test-installed-package-contract.mjs"), "utf8")

    expect(verifier).toMatch(/exerciseExactTarContract[\s\S]*?"--package-exercise"[\s\S]*?"--source-cli"/u)
    expect(verifier).toMatch(/"--package-exercise"[\s\S]*?"--tarball"[\s\S]*?"--tarball-content-identity"/u)
    expect(contract).toContain("source-cli-package-exercise-contract: PASS")
    expect(contract).toContain("installed-package-exercise-contract: PASS")
    expect(contract).toContain("assertInstalledPackageContentIdentity")
    expect(contract).toContain("observerGhStageCodeForPreflight")
    expect(contract).toContain("assertWorkflowSelectedObserverGhLifecycle")
    expect(contract).toContain("observerGhStageCodeForWorkflowSelector")
    expect(contract).toContain("source-cli-package-exercise-phase")
    expect(contract).toContain("installed-package-exercise-phase")
    expect(contract).toContain("PackageExercisePhaseError")
    expect(contract).toContain("formatPackageExercisePhaseRecord")
    expect(contract).toContain("formatAuthorityDiscoveryExerciseResult")
    expect(contract.indexOf("class ObserverGhContractStageError")).toBeLessThan(contract.indexOf("let contractOptions"))
    expect(verifier).toContain("requirePackageExerciseContractSuccess")
    expect(verifier).toContain("PackageExercisePhaseEnvelopeError")
    expect(verifier).toContain("AUTHORITY_DISCOVERY_EXERCISE_MARKER")
    expect(verifier).toContain("new CleanPackageBoundaryError(error.code)")
    expect(verifier).not.toContain("ancillary-unsafe")
    expect(verifier).not.toContain('return "/usr/bin/gh"')
  })

  it("keeps the Git-bound source verifier separate from the fresh installed package runtime", () => {
    const verifier = readFileSync(join(process.cwd(), "scripts", "verify-clean-package-boundary.mjs"), "utf8")
    const contract = readFileSync(join(process.cwd(), "scripts", "test-installed-package-contract.mjs"), "utf8")

    expect(verifier).toContain("assertCleanGit(sourceRoot, git)")
    expect(contract).toContain("installed package unexpectedly contains the Git-bound source verifier")
    expect(contract).toContain("installed package observer stage is missing")
    expect(contract).toContain("installed package unexpectedly contains repository source")
    expect(contract).toContain("installed package unexpectedly contains repository Git metadata")
  })

  it("keeps the provisioned Gradle lifecycle bounded to its contract-owned home", () => {
    const contract = readFileSync(join(process.cwd(), "scripts", "test-installed-package-contract.mjs"), "utf8")

    expect(contract).toContain('join(projectDir, "gradle.properties")')
    expect(contract).toContain('"org.gradle.daemon=false\\n"')
    expect(contract).toContain('"--no-daemon", "wrapper"')
    expect(contract).toContain('const contractGradleUserHome = join(temporaryRoot, "gradle-user-home")')
    expect(contract).toContain('"installed fixture Gradle runtime warmup"')
    expect(contract).toContain('runCommand(projectDir, "./gradlew", ["--no-daemon", "test"], {')
    expect(contract).toContain('GRADLE_USER_HOME: contractGradleUserHome')
    expect(contract).toContain('timeoutMs: 120_000')
  })
})
