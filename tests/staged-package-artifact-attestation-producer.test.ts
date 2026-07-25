import { spawnSync, execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { gzipSync } from "node:zlib"

import { describe, expect, it } from "vitest"

import {
  createStagedPackageArtifactPredicate,
  FIXED_STAGED_PACKAGE_ARTIFACT_COMMAND_PLAN,
  STAGED_PACKAGE_ARTIFACT_PACKAGE,
  STAGED_PACKAGE_ARTIFACT_PREDICATE_TYPE,
  stagedPackageTarballUrl,
} from "../scripts/staged-package-artifact-attestation-core.mjs"

const root = process.cwd()
const workflowPath = join(root, ".github", "workflows", "staged-package-artifact-attestation.yml")
const producerPath = join(root, "scripts", "build-staged-package-artifact-attestation.mjs")
const HEAD = "a".repeat(40)
const CURRENT_SOURCE_VERSION = "0.8.0-beta.1"
const VERSION = "0.7.0-rc.8"
const RC7_REGISTRY_GIT_HEAD = "659f7d86fcd653f49eead719b91093f35f73ad3e"

type RegistryVersionFixture = {
  readonly dist: {
    readonly integrity: string
    readonly shasum: string
    readonly tarball: string
  }
  readonly gitHead: string
  readonly name: string
  readonly version: string
}

describe("staged package artifact attestation producer policy", () => {
  it("declares the controlled protected-main workflow and producer", () => {
    expect(existsSync(workflowPath)).toBe(true)
    expect(existsSync(producerPath)).toBe(true)
  })

  it("limits dispatch inputs to the fixed channel and strict version selectors", () => {
    const workflow = readFileSync(workflowPath, "utf8")

    expect(workflow).toContain("workflow_dispatch:")
    expect(workflow).toContain("channel:")
    expect(workflow).toContain("version:")
    expect(workflow).toContain("          - staging")
    expect(workflow).toContain("          - next")
    expect(workflow).not.toContain("registry_url:")
    expect(workflow).not.toContain("package_name:")
    expect(workflow).not.toContain("repository:")
    expect(workflow).not.toContain("source_head:")
  })

  it("pins attestation actions and signs the downloaded npm tarball rather than predicate JSON", () => {
    const workflow = readFileSync(workflowPath, "utf8")

    expect(workflow).toContain("actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5")
    expect(workflow).toContain("actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020")
    expect(workflow).toContain("actions/attest@ce27ba3b4a9a139d9a20a4a07d69fabb52f1e5bc")
    expect(workflow).toContain("actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02")
    expect(workflow).toContain("predicate-type: https://github.com/jyt6640/persona-harness/attestations/staged-package-artifact-binding.1")
    expect(workflow).toContain("subject-path: .ci/staged-package-artifact-attestation/package.tgz")
    expect(workflow).not.toContain("subject-path: .ci/staged-package-artifact-attestation/predicate.json")
    expect(workflow).toContain("contents: read")
    expect(workflow).toContain("id-token: write")
    expect(workflow).toContain("attestations: write")
    expect(workflow).toContain("artifact-metadata: write")
    expect(workflow).not.toContain("contents: write")
    expect(workflow).not.toContain("npm publish")
    expect(workflow).not.toContain("git tag")
    expect(workflow).not.toContain("git push")
  })

  it("binds a synthetic fixed-channel tarball only as producer-only diagnostic data", () => {
    const result = createStagedPackageArtifactPredicate(producerInput())

    expect(result.predicate).toMatchObject({
      authorityBoundary: "producer-only-diagnostic",
      authorityEligible: false,
      expectedTag: `v${VERSION}`,
      predicateType: STAGED_PACKAGE_ARTIFACT_PREDICATE_TYPE,
      registry: {
        gitHead: HEAD,
        origin: "https://registry.npmjs.org",
        selectedTag: "staging",
      },
      run: {
        event: "workflow_dispatch",
        repository: "jyt6640/persona-harness",
        workflow: {
          ref: "jyt6640/persona-harness/.github/workflows/staged-package-artifact-attestation.yml@refs/heads/main",
        },
      },
      schemaVersion: "staged-package-artifact-binding.1",
      source: {
        canonicalMainHead: HEAD,
        head: HEAD,
      },
      subject: { name: "package.tgz" },
      tagState: "deferred",
      tarball: {
        packageName: STAGED_PACKAGE_ARTIFACT_PACKAGE,
        version: VERSION,
      },
    })
    expect(JSON.stringify(result.predicate)).not.toContain("external-attested")
  })

  it("keeps a historical RC7 registry gitHead blocked while the beta source version stays separate", () => {
    expect(readFileSync(join(root, "package.json"), "utf8")).toContain(`"version": "${CURRENT_SOURCE_VERSION}"`)
    expect(CURRENT_SOURCE_VERSION).not.toBe(VERSION)
    expect(() =>
      createStagedPackageArtifactPredicate(producerInput({
        registryVersion: { ...registryVersion(), gitHead: RC7_REGISTRY_GIT_HEAD },
      })),
    ).toThrow("staged-producer-registry-binding")

    const result = createStagedPackageArtifactPredicate(producerInput())
    expect(result.predicate).toMatchObject({
      source: { head: HEAD },
      tarball: { version: VERSION },
      registry: { gitHead: HEAD },
    })
  })

  it("allows the fixed next channel only when its own selected mapping is exact", () => {
    const result = createStagedPackageArtifactPredicate(producerInput({
      channel: "next",
      registryIndex: { "dist-tags": { next: VERSION } },
    }))

    expect(result.predicate).toMatchObject({ registry: { selectedTag: "next" } })
  })

  it("rejects local producer invocation before any registry operation", () => {
    const result = spawnSync(process.execPath, [producerPath, "--channel", "staging", "--version", VERSION], {
      cwd: root,
      encoding: "utf8",
      env: {},
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("staged-producer-github-actions")
    expect(result.stdout).toBe("")
  })

  it("keeps the actual producer context builder valid for a clean protected-main job", () => {
    const workspace = mkdtempSync(join(tmpdir(), "staged-producer-context-"))
    try {
      const head = initializeProducerWorkspace(workspace)
      const result = readProducerContext(workspace, head)

      expect(result.status).toBe(0)
      expect(result.stderr).toBe("")
      expect(result.stdout).toContain(`"contextHead":"${head}"`)
      expect(result.stdout).toContain('"repositoryId":"1272008570"')
      expect(result.stdout).toContain('"runAttempt":"1"')
    } finally {
      rmSync(workspace, { force: true, recursive: true })
    }
  })

  it.each([
    ["channel", () => producerInput({ channel: "latest" }), "staged-producer-channel-invalid"],
    ["strict SemVer", () => producerInput({ version: "not-semver-rc" }), "staged-producer-version-invalid"],
    ["ref", () => producerInput({ context: { ...context(), ref: "refs/heads/feature/test" } }), "staged-producer-context-policy"],
    ["event", () => producerInput({ context: { ...context(), event: "push" } }), "staged-producer-context-policy"],
    ["repository", () => producerInput({ context: { ...context(), repository: "other/repository" } }), "staged-producer-context-policy"],
    ["runner", () => producerInput({ context: { ...context(), runnerEnvironment: "self-hosted" } }), "staged-producer-context-policy"],
    ["workflow", () => producerInput({ context: { ...context(), workflowRef: "jyt6640/persona-harness/.github/workflows/other.yml@refs/heads/main" } }), "staged-producer-context-policy"],
    ["source binding", () => producerInput({ context: { ...context(), sourceHead: "b".repeat(40) } }), "staged-producer-context-binding"],
    ["fixed command plan", () => producerInput({ commandPlan: [] }), "staged-producer-command-plan"],
    ["tag mapping", () => producerInput({ registryIndex: { "dist-tags": { staging: "0.7.0-rc.3" } } }), "staged-producer-tag-mapping"],
    ["package metadata", () => producerInput({ registryVersion: { ...registryVersion(), name: "other-package" } }), "staged-producer-registry-binding"],
    ["registry git head", () => producerInput({ registryVersion: { ...registryVersion(), gitHead: "b".repeat(40) } }), "staged-producer-registry-binding"],
    ["tarball URL", () => producerInput({ registryVersion: { ...registryVersion(), dist: { ...registryVersion().dist, tarball: "https://example.invalid/package.tgz" } } }), "staged-producer-tarball-url"],
    ["tarball shasum", () => producerInput({ registryVersion: { ...registryVersion(), dist: { ...registryVersion().dist, shasum: "b".repeat(40) } } }), "staged-producer-tarball-shasum"],
    ["tarball integrity", () => producerInput({ registryVersion: { ...registryVersion(), dist: { ...registryVersion().dist, integrity: "sha512-" + "A".repeat(88) } } }), "staged-producer-tarball-integrity"],
    ["packed manifest", () => producerInput({ tarballBytes: packedTarball("other-package", VERSION) }), "staged-producer-packed-manifest-mismatch"],
  ])("fails closed for a wrong %s", (_label, buildInput, code) => {
    expect(() => createStagedPackageArtifactPredicate(buildInput())).toThrow(code)
  })
})

function producerInput(overrides: Readonly<Record<string, unknown>> = {}): Readonly<Record<string, unknown>> {
  const tarballBytes = packedTarball(STAGED_PACKAGE_ARTIFACT_PACKAGE, VERSION)
  return {
    channel: "staging",
    commandPlan: FIXED_STAGED_PACKAGE_ARTIFACT_COMMAND_PLAN,
    context: context(),
    now: new Date("2026-07-17T01:00:00.000Z"),
    registryIndex: { "dist-tags": { staging: VERSION } },
    registryVersion: registryVersion(tarballBytes),
    tarballBytes,
    version: VERSION,
    ...overrides,
  }
}

function context(): Readonly<Record<string, unknown>> {
  return {
    canonicalMainHead: HEAD,
    cleanStatusDigest: `sha256:${"c".repeat(64)}`,
    contextHead: HEAD,
    event: "workflow_dispatch",
    ref: "refs/heads/main",
    repository: "jyt6640/persona-harness",
    repositoryId: "1272008570",
    runAttempt: "1",
    runId: "123456789",
    runnerEnvironment: "github-hosted",
    runnerLabel: "ubuntu-latest",
    runnerOs: "Linux",
    sourceHead: HEAD,
    sourceIdentity: {
      contentDigest: `sha256:${"d".repeat(64)}`,
      repositoryHead: HEAD,
      schemaVersion: "source-identity.1",
    },
    workflowRef: "jyt6640/persona-harness/.github/workflows/staged-package-artifact-attestation.yml@refs/heads/main",
    workflowSha: HEAD,
  }
}

function registryVersion(tarballBytes = packedTarball(STAGED_PACKAGE_ARTIFACT_PACKAGE, VERSION)): RegistryVersionFixture {
  return {
    dist: {
      integrity: `sha512-${createDigest("sha512", tarballBytes, "base64")}`,
      shasum: createDigest("sha1", tarballBytes, "hex"),
      tarball: stagedPackageTarballUrl(VERSION),
    },
    gitHead: HEAD,
    name: STAGED_PACKAGE_ARTIFACT_PACKAGE,
    version: VERSION,
  }
}

function packedTarball(name: string, version: string): Buffer {
  const manifest = Buffer.from(`${JSON.stringify({ name, version })}\n`)
  const header = Buffer.alloc(512)
  header.write("package/package.json", 0, "utf8")
  header.write("0000644\0", 100, "ascii")
  header.write("0000000\0", 108, "ascii")
  header.write("0000000\0", 116, "ascii")
  header.write(`${manifest.byteLength.toString(8).padStart(11, "0")}\0`, 124, "ascii")
  header.write("00000000000\0", 136, "ascii")
  header.fill(32, 148, 156)
  header[156] = 48
  header.write("ustar\0", 257, "ascii")
  header.write("00", 263, "ascii")
  const checksum = header.reduce((total, byte) => total + byte, 0)
  header.write(`${checksum.toString(8).padStart(6, "0")}\0 `, 148, "ascii")
  const padding = Buffer.alloc((512 - (manifest.byteLength % 512)) % 512)
  return gzipSync(Buffer.concat([header, manifest, padding, Buffer.alloc(1024)]))
}

function createDigest(algorithm: "sha1" | "sha512", value: Buffer, encoding: "base64" | "hex"): string {
  return createHash(algorithm).update(value).digest(encoding)
}

function initializeProducerWorkspace(workspace: string): string {
  writeFileSync(join(workspace, "fixture.txt"), "fixture\n")
  execFileSync("git", ["init", "-q"], { cwd: workspace })
  execFileSync("git", ["config", "user.email", "ph@example.invalid"], { cwd: workspace })
  execFileSync("git", ["config", "user.name", "PH Test"], { cwd: workspace })
  execFileSync("git", ["add", "fixture.txt"], { cwd: workspace })
  execFileSync("git", ["commit", "-qm", "producer context fixture"], { cwd: workspace })
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: workspace, encoding: "utf8" }).trim()
  execFileSync("git", ["update-ref", "refs/remotes/origin/main", head], { cwd: workspace })
  return head
}

function readProducerContext(workspace: string, head: string) {
  const source = [
    `import { readGitHubContext } from ${JSON.stringify(pathToFileURL(producerPath).href)}`,
    "process.stdout.write(JSON.stringify(readGitHubContext()))",
  ].join(";")
  return spawnSync(process.execPath, ["--input-type=module", "--eval", source], {
    cwd: workspace,
    encoding: "utf8",
    env: {
      ...process.env,
      GITHUB_ACTIONS: "true",
      GITHUB_EVENT_NAME: "workflow_dispatch",
      GITHUB_REF: "refs/heads/main",
      GITHUB_REPOSITORY: "jyt6640/persona-harness",
      GITHUB_REPOSITORY_ID: "1272008570",
      GITHUB_RUN_ATTEMPT: "1",
      GITHUB_RUN_ID: "29570375578",
      GITHUB_SHA: head,
      GITHUB_WORKFLOW_REF: "jyt6640/persona-harness/.github/workflows/staged-package-artifact-attestation.yml@refs/heads/main",
      GITHUB_WORKFLOW_SHA: head,
      RUNNER_ENVIRONMENT: "github-hosted",
      RUNNER_OS: "Linux",
    },
  })
}
