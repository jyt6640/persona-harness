import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const manifestPath = join(process.cwd(), "docs", "current", "release", "consumer-authority-beta7-acceptance.json")

type AcceptanceManifest = {
  readonly ciRuntime: {
    readonly physicalResourceLane: {
      readonly files: readonly string[]
      readonly maxWorkers: number
      readonly normalMaxWorkers: number
    }
    readonly proof: string
    readonly sourceFallback: string
  }
  readonly authority: {
    readonly commands: readonly string[]
    readonly fixturePlan: {
      readonly artifact: string
      readonly consumer: string
      readonly postmergeAction: string
      readonly registryInstall: string
    }
    readonly hostedFixture: {
      readonly callerWorkflowPath: string
      readonly event: string
      readonly ref: string
      readonly repository: string
      readonly reusableWorkflowPath: string
      readonly revision: string
    }
    readonly verification: {
      readonly predicate: string
      readonly route: string
      readonly unavailable: string
    }
  }
  readonly cooperative: {
    readonly commands: readonly string[]
    readonly defaultFinish: string
    readonly evidence: {
      readonly recordSchema: string
      readonly sourceReadManifest: readonly { readonly boundary: string; readonly id: string; readonly surface: string }[]
      readonly sourceReadStages: readonly {
        readonly capability: string
        readonly id: string
        readonly operation: string
        readonly relativePath: string
      }[]
      readonly sourceReads: readonly string[]
      readonly unsafeResult: string
    }
    readonly explicitFinish: string
    readonly laterClosure: string
  }
  readonly deterministicProofs: readonly { readonly id: string; readonly surface: string }[]
  readonly negativeCases: readonly { readonly id: string; readonly proof: string }[]
  readonly nativeProjectRead: {
    readonly manifest: string
    readonly node: string
    readonly platforms: readonly string[]
    readonly source: string
    readonly unavailable: string
  }
  readonly package: { readonly channel: string; readonly scope: string; readonly version: string }
  readonly producerWorkspace: {
    readonly blocked: string
    readonly manifest: readonly {
      readonly capability: string
      readonly id: string
      readonly operation: string
      readonly relativePath: string
      readonly root: "caller" | "runner"
    }[]
    readonly proof: string
  }
  readonly schemaVersion: string
}

function readManifest(): AcceptanceManifest {
  return JSON.parse(readFileSync(manifestPath, "utf8")) as AcceptanceManifest
}

describe("consumer authority beta.7 acceptance manifest", () => {
  it("fixes the public source and packed cooperative lifecycle with bounded source-read evidence", () => {
    // Given: the package-visible beta.7 public lifecycle contract.
    const manifest = readManifest()

    // When: a clean Java/Spring consumer follows the supported command sequence.
    const commands = manifest.cooperative.commands

    // Then: every report and coverage input is explicit while authority defaults remain blocked.
    expect(manifest.schemaVersion).toBe("consumer-authority-beta7-acceptance.1")
    expect(manifest.package).toEqual({ channel: "staging", scope: "staging-only", version: "0.8.0-beta.7" })
    expect(commands).toEqual([
      "ph bootstrap backend --strict --no-developer-mcp",
      "ph bearshell ./gradlew test",
      "ph bearshell ./gradlew compileJava",
      "ph bearshell ./gradlew clean",
      "ph evidence read README.md",
      "ph evidence read .persona/project-profile.jsonc",
      "ph evidence read src/main/java/example/cooperative/GreetingService.java",
      "ph plan --report-filled implementation --stdin",
      "ph plan --report-filled review --stdin",
    ])
    expect(manifest.cooperative).toMatchObject({
      defaultFinish: "trusted-authority-required",
      explicitFinish: "cooperative-pass",
      laterClosure: "trusted-authority-required",
    })
    expect(manifest.cooperative.evidence.recordSchema).toBe("workflow-read-evidence.1")
    expect(manifest.cooperative.evidence.sourceReads).toEqual([
      "README.md",
      ".persona/project-profile.jsonc",
      "src/main/java/example/cooperative/GreetingService.java",
    ])
    expect(manifest.cooperative.evidence.sourceReadManifest).toEqual([
      { boundary: "native-directory-fd-root-capability", id: "project-root", surface: "producer-and-source-match" },
      { boundary: "native-openat-regular-file", id: "harness-config-and-profile", surface: ".persona/harness.jsonc-and-project-profile.jsonc" },
      { boundary: "native-openat-exactly-one", id: "gradle-descriptors", surface: "build.gradle-or-build.gradle.kts-and-settings.gradle-or-settings.gradle.kts" },
      { boundary: "native-openat-tree-and-captured-cwd", id: "source-tree-and-git", surface: "tracked-and-included-untracked-source-plus-fixed-git" },
      { boundary: "captured-project-read-and-canonical-evidence-write", id: "evidence-read-input-and-output", surface: "public-ph-evidence-read" },
    ])
    expect(manifest.cooperative.evidence.sourceReadStages).toEqual([
      { capability: "runner-directory-fd", id: "project-root-capture", operation: "openat-nofollow-and-identity-bind", relativePath: "<direct-child-project>" },
      { capability: "project-root-fd", id: "intermediate-segment-traversal", operation: "fstatat-openat-nofollow-fstatat", relativePath: "<each-relative-parent-segment>" },
      { capability: "held-parent-fd", id: "regular-leaf-read", operation: "openat-nofollow-bounded-read-post-identity", relativePath: "<selected-regular-leaf>" },
      { capability: "project-root-fd", id: "harness-config-profile", operation: "bounded-regular-read", relativePath: ".persona/harness.jsonc|.persona/project-profile.jsonc" },
      { capability: "project-root-fd", id: "gradle-descriptors", operation: "exactly-one-bounded-regular-read", relativePath: "build.gradle|build.gradle.kts|settings.gradle|settings.gradle.kts" },
      { capability: "project-root-fd", id: "gradle-wrapper-execution", operation: "nofollow-wrapper-check-and-fixed-exec", relativePath: "gradlew" },
      { capability: "project-root-fd", id: "source-identity-tree", operation: "bounded-descriptor-relative-tree", relativePath: "<tracked-staged-unstaged-included-untracked>" },
      { capability: "project-root-fd", id: "git-identity", operation: "fixed-catalog-fchdir-exec", relativePath: ".git" },
      { capability: "project-root-fd", id: "junit-baseline", operation: "descriptor-relative-generated-manifest", relativePath: "build/test-results/test|target/surefire-reports" },
      { capability: "project-root-fd", id: "junit-fresh-read", operation: "descriptor-relative-generated-tree", relativePath: "build/test-results/test|target/surefire-reports" },
      { capability: "project-root-fd", id: "public-evidence-source-read", operation: "manifest-bound-regular-read", relativePath: "<validated-public-relative-path>" },
      { capability: "bootstrap-write-boundary", id: "public-evidence-record-write", operation: "canonical-contained-atomic-write", relativePath: ".persona/evidence/phase0/<digest>.json" },
      { capability: "project-root-fd", id: "producer-post-verification-recheck", operation: "repeat-input-source-git-and-junit-bindings", relativePath: "<same-captured-project>" },
      { capability: "held-native-descriptors", id: "boundary-cleanup", operation: "close-only-no-path-reopen", relativePath: "<all-held-fds>" },
    ])
    expect(manifest.cooperative.evidence.unsafeResult).toBe("bounded-block-no-external-descriptor-bytes-record-or-artifact")
    expect(manifest.nativeProjectRead).toEqual({
      manifest: "native/project-read/manifest.json",
      node: "^20.17.0 || >=22.9.0",
      platforms: ["darwin-arm64", "darwin-x64", "linux-arm64", "linux-x64"],
      source: "native/project-read/ph_native_project_read.c",
      unavailable: "source-read-runtime-unavailable",
    })
    expect(manifest.ciRuntime).toEqual({
      proof: "clean-checkout-forced-dist-build-private-runtime-stage",
      sourceFallback: "forbidden",
      physicalResourceLane: {
        files: [
          "tests/cooperative-finish-real-gradle.test.ts",
          "tests/eval-runner.test.ts",
          "tests/project-finish-attestation-producer-oidc-bridge.test.ts",
          "tests/staged-package-verification-runner.test.ts",
          "tests/persona-harness-staged-package-verification-installed.test.ts",
          "tests/persona-harness-workflow-loop.test.ts",
        ],
        maxWorkers: 1,
        normalMaxWorkers: 4,
      },
    })
    expect(manifest.producerWorkspace).toEqual({
      blocked: "bounded-block-no-external-descriptor-open-read-write-or-artifact",
      proof: "source-built-and-packed-installed-github-script-outer-runner-nested-caller-native-audit",
      manifest: [
        { capability: "outer-runner-directory-fd", id: "runner-root-capture", operation: "canonical-no-follow-identity-bind", relativePath: ".", root: "runner" },
        { capability: "outer-runner-directory-fd", id: "nested-caller-capture", operation: "openat-nofollow-direct-child-identity-bind", relativePath: ".project-finish-caller", root: "caller" },
        { capability: "nested-caller-directory-fd", id: "caller-input-read", operation: "descriptor-relative-no-follow-bounded-read-tree-and-fixed-command", relativePath: "<profile-gradle-git-source-junit-evidence>", root: "caller" },
        { capability: "outer-runner-output-reservation", id: "failure-output", operation: "canonical-contained-nofollow-private-write", relativePath: ".project-finish-attestation-failure/failure-diagnostic.json", root: "runner" },
        { capability: "outer-runner-output-reservation", id: "unsigned-artifact-output", operation: "reserved-nofollow-private-write-and-handoff", relativePath: ".project-finish-attestation-artifacts/<receipt-predicate-bundle>", root: "runner" },
        { capability: "held-native-descriptors", id: "caller-cleanup", operation: "close-only-no-caller-path-reopen", relativePath: "<caller-root-and-parent-fds>", root: "caller" },
      ],
    })
  })

  it("keeps current artifact verification and explicit consumption as a single future hosted residual", () => {
    // Given: the source candidate's fixed authority plan.
    const manifest = readManifest()

    // When: it is inspected without a current original artifact.
    const proofs = new Map(manifest.deterministicProofs.map((entry) => [entry.id, entry.surface]))

    // Then: fixed identity, online verification availability, and every negative class are explicit.
    expect(manifest.authority.commands).toEqual([
      "ph authority enroll github <owner/repository> --workflow <caller-workflow>",
      "ph authority status --json",
      "ph authority fetch github --json",
      "ph authority explain --json",
      "ph workflow finish implement",
    ])
    expect(manifest.authority.fixturePlan.registryInstall).toBe(
      "npm install persona-harness@0.8.0-beta.7 --registry https://registry.npmjs.org",
    )
    expect(manifest.authority.verification).toEqual({
      predicate: "project-finish-attestation.1",
      route: "fixed-product-owned-online",
      unavailable: "bounded-non-authoritative",
    })
    for (const negativeCase of manifest.negativeCases) {
      expect(proofs.has(negativeCase.proof)).toBe(true)
    }
    expect(proofs.get("native-source-read-source-and-packed")).toBe(
      "source-built-and-packed-installed-with-native-descriptor-open-audit",
    )
    expect(proofs.get("project-consumption-source")).toBe("source-built-worker-seam")
    expect(proofs.get("producer-workspace-topology-source-and-packed")).toBe(
      "source-built-and-packed-installed-github-script-outer-runner-nested-caller-native-audit",
    )
  })
})
