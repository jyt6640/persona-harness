import { createHash } from "node:crypto"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  canonicalExternalAttestationCommandPlan,
} from "../scripts/consumer-authority-external-attestation-command-plan.mjs"
import {
  ExternalArtifactTransportPlanError,
  canonicalExternalArtifactTransportPlan,
  renderExternalArtifactTransportRequest,
  runExternalArtifactTransportPreflight,
} from "../scripts/consumer-authority-external-artifact-transport-plan.mjs"
import {
  ExternalObserverArtifactError,
  prepareExternalObserverArtifactForTest,
} from "../scripts/consumer-authority-external-observer-boundary.mjs"

const temporaryRoots: string[] = []
const credential = "ghp_transport_observer_token_marker"
const callerRepository = "jyt6640/persona-harness-attestation-claim-fixture"
const archive = archiveFor({
  "bundle.json": Buffer.from("{\"bundle\":true}\n", "utf8"),
  "predicate.json": Buffer.from("{\"predicate\":true}\n", "utf8"),
  "receipt.json": Buffer.from("{\"receipt\":true}\n", "utf8"),
})

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { force: true, recursive: true })
})

describe("consumer authority beta.17 external artifact transport", () => {
  it("streams one fixed artifact endpoint through a validated redirect before rendering the distinct reusable signer command", async () => {
    // Given
    const requests: Array<{ readonly headers: Record<string, string>; readonly url: string }> = []
    const prepared = await prepareExternalObserverArtifactForTest(
      observerInput(),
      credential,
      {
        request: async (url: URL, headers: Record<string, string>) => {
          requests.push({ headers, url: url.toString() })
          if (requests.length === 1) {
            return response(302, { location: "https://pipelines.actions.githubusercontent.com/artifact?opaque=not-retained" }, [])
          }
          return response(200, zipHeaders(archive), chunks(archive, 7))
        },
      },
    )

    // When
    const subject = prepared.readSubject()
    const bundle = prepared.readBundle()

    // Then
    expect(requests).toEqual([
      {
        headers: expect.objectContaining({ Authorization: `Bearer ${credential}` }),
        url: "https://api.github.com/repos/jyt6640/persona-harness-attestation-claim-fixture/actions/artifacts/710000017/zip",
      },
      {
        headers: expect.not.objectContaining({ Authorization: expect.anything() }),
        url: "https://pipelines.actions.githubusercontent.com/artifact?opaque=not-retained",
      },
    ])
    expect(subject.equals(archive)).toBe(true)
    expect(bundle.equals(Buffer.from("{\"bundle\":true}\n", "utf8"))).toBe(true)
    expect(prepared.verifyArguments).toEqual([
      "attestation",
      "verify",
      prepared.subjectPath,
      "--bundle",
      prepared.bundlePath,
      "--repo",
      callerRepository,
      "--signer-workflow",
      "jyt6640/persona-harness/.github/workflows/persona-harness-project-finish.yml",
      "--signer-digest",
      "c".repeat(40),
      "--cert-oidc-issuer",
      "https://token.actions.githubusercontent.com",
      "--source-ref",
      "refs/heads/main",
      "--source-digest",
      "b".repeat(40),
      "--predicate-type",
      "https://github.com/jyt6640/persona-harness/attestations/project-finish-attestation.1",
      "--deny-self-hosted-runners",
      "--format",
      "json",
    ])
    expect(JSON.stringify(prepared.publicResult)).not.toContain(credential)
    expect(JSON.stringify(prepared.publicResult)).not.toContain("pipelines.actions.githubusercontent.com")
    prepared.cleanup()
    expect(existsSync(prepared.outputRoot)).toBe(false)
  })

  it.each([
    ["an empty success body", archive, response(200, zipHeaders(Buffer.alloc(0)), []), "external-artifact-transport-byte-count"],
    ["a non-success response", archive, response(404, { "content-length": "0", "content-type": "application/json" }, []), "external-artifact-transport-status"],
    ["an HTML response", archive, response(200, { "content-length": String(archive.byteLength), "content-type": "text/html" }, chunks(archive)), "external-artifact-transport-content-type"],
    ["a truncated response", archive, response(200, zipHeaders(archive), chunks(archive.subarray(0, archive.byteLength - 1))), "external-artifact-transport-byte-count"],
    ["an oversized response", archive, response(200, zipHeaders(archive), chunks(Buffer.concat([archive, Buffer.from("x", "utf8")]))), "external-artifact-transport-byte-count"],
    ["an unsafe archive", unsafeArchive(), response(200, zipHeaders(unsafeArchive()), chunks(unsafeArchive())), "external-artifact-transport-archive"],
  ])("blocks %s before usable observer output", async (_label, expectedBytes, candidate, expectedCode) => {
    // Given
    const roots: string[] = []

    // When
    const attempt = prepareExternalObserverArtifactForTest(
      observerInput(expectedBytes),
      credential,
      {
        createPrivateRoot: () => capturePrivateRoot(roots),
        request: async () => candidate,
      },
    )

    // Then
    await expectObserverBlock(attempt, expectedCode)
    expect(roots.every((root) => !existsSync(root))).toBe(true)
  })

  it("rejects mismatched bytes and digest without retaining a body or reflecting the token", async () => {
    // Given
    const roots: string[] = []
    const mismatchedDigest = observerInput(archive, `sha256:${"0".repeat(64)}`)

    // When
    const attempt = prepareExternalObserverArtifactForTest(mismatchedDigest, credential, {
      createPrivateRoot: () => capturePrivateRoot(roots),
      request: async () => response(200, zipHeaders(archive), chunks(archive)),
    })

    // Then
    await expectObserverBlock(attempt, "external-artifact-transport-digest")
    expect(roots.every((root) => !existsSync(root))).toBe(true)
    await attempt.catch((error: unknown) => {
      expect(String(error)).not.toContain(credential)
    })
  })

  it.each([
    ["an arbitrary redirect host", "https://untrusted.example/artifact"],
    ["a redirect with user info", "https://user@pipelines.actions.githubusercontent.com/artifact"],
    ["a redirect with a port", "https://pipelines.actions.githubusercontent.com:443/artifact"],
    ["a mixed-case redirect host", "https://Pipelines.Actions.Githubusercontent.Com/artifact"],
    ["an encoded redirect host", "https://pipelines.actions.githubusercontent.com%2euntrusted.example/artifact"],
    ["an IP redirect host", "https://127.0.0.1/artifact"],
  ])("rejects %s without following an unsafe target", async (_label, location) => {
    // Given
    let calls = 0

    // When
    const attempt = prepareExternalObserverArtifactForTest(observerInput(), credential, {
      request: async () => {
        calls += 1
        return response(302, { location }, [])
      },
    })

    // Then
    await expectObserverBlock(attempt, "external-artifact-transport-redirect")
    expect(calls).toBe(1)
  })

  it("rejects a second redirect after exactly one credential-free follow", async () => {
    // Given
    let calls = 0

    // When
    const attempt = prepareExternalObserverArtifactForTest(observerInput(), credential, {
      createPrivateRoot: temporaryRoot,
      request: async () => {
        calls += 1
        return response(302, { location: "https://results-receiver.actions.githubusercontent.com/next" }, [])
      },
      timeoutMs: 100,
    })

    // Then
    await expectObserverBlock(attempt, "external-artifact-transport-redirect")
    expect(calls).toBe(2)
  })

  it("rejects a private output symlink without writing through it", async () => {
    // Given
    const root = temporaryRoot()
    const outside = join(root, "outside")
    const alias = join(root, "output-alias")
    mkdirSync(outside)
    const outsideFiles = () => readdirSync(outside)
    symlinkSync(outside, alias, "dir")

    // When
    const attempt = prepareExternalObserverArtifactForTest(observerInput(), credential, {
      createPrivateRoot: () => alias,
      request: async () => response(200, zipHeaders(archive), chunks(archive)),
    })

    // Then
    await expectObserverBlock(attempt, "external-artifact-transport-output")
    expect(outsideFiles()).toEqual([])
  })

  it("rejects a replaced promoted leaf without opening its external target", async () => {
    // Given
    const outside = temporaryRoot()
    const secret = join(outside, "outside-marker")
    writeFileSync(secret, "outside-only\n")
    const prepared = await prepareExternalObserverArtifactForTest(observerInput(), credential, {
      createPrivateRoot: temporaryRoot,
      request: async () => response(200, zipHeaders(archive), chunks(archive)),
      timeoutMs: 100,
    })
    rmSync(prepared.bundlePath)
    symlinkSync(secret, prepared.bundlePath, "file")

    // Then
    try {
      expect(() => prepared.readBundle()).toThrow("external-artifact-transport-output")
    } finally {
      prepared.cleanup()
    }
  })

  it("times out a non-terminating transport without making an observer artifact", async () => {
    // Given
    const roots: string[] = []

    // When
    const attempt = prepareExternalObserverArtifactForTest(observerInput(), credential, {
      createPrivateRoot: () => capturePrivateRoot(roots),
      request: async () => await new Promise<never>(() => undefined),
      timeoutMs: 5,
    })

    // Then
    await expectObserverBlock(attempt, "external-artifact-transport-timeout")
    expect(roots.every((root) => !existsSync(root))).toBe(true)
  })

  it("rejects URL, headers, and output paths as transport-plan input rather than rendering caller-controlled transport", () => {
    // Given
    const plan = canonicalExternalArtifactTransportPlan()
    const artifact = modeledArtifact(archive)

    // When
    const renderWithUrl = () => renderExternalArtifactTransportRequest(plan, topology(), { ...artifact, url: "https://untrusted.example" } as unknown as typeof artifact)
    const renderWithHeaders = () => renderExternalArtifactTransportRequest(plan, topology(), { ...artifact, headers: { Authorization: credential } } as unknown as typeof artifact)
    const renderWithOutput = () => renderExternalArtifactTransportRequest(plan, topology(), { ...artifact, outputPath: "/tmp/foreign" } as unknown as typeof artifact)

    // Then
    expectPlanBlock(renderWithUrl, "url")
    expectPlanBlock(renderWithHeaders, "headers")
    expectPlanBlock(renderWithOutput, "output")
  })

  it("contains the observer in a fixed HTTPS client process with no shell launcher", () => {
    // Given
    const source = readFileSync(new URL("../scripts/consumer-authority-external-observer-boundary.mjs", import.meta.url), "utf8")

    // Then
    expect(source).toContain('from "node:https"')
    expect(source).not.toContain("node:child_process")
    expect(source).not.toContain("shell:")
  })

  it("runs a no-token, no-final-artifact transport and crypto-handoff parser preflight", async () => {
    // Given
    const tokenMarker = "ghp_transport_preflight_token_marker"

    // When
    const result = await runExternalArtifactTransportPreflight()

    // Then
    expect(result).toEqual({
      artifactAccess: false,
      authorityEligible: false,
      code: "external-artifact-transport-parser-accepted",
      credential: "absent",
      crypto: "not-run",
      networkAccess: false,
      schemaVersion: "consumer-authority-external-artifact-transport-preflight.1",
      state: "ready",
    })
    expect(JSON.stringify(result)).not.toContain(tokenMarker)
  })
})

function observerInput(bytes = archive, digest = `sha256:${sha256(bytes)}`) {
  return {
    artifact: modeledArtifact(bytes, digest),
    attestationPlan: canonicalExternalAttestationCommandPlan(),
    topology: topology(),
    transportPlan: canonicalExternalArtifactTransportPlan(),
  }
}

function modeledArtifact(bytes: Buffer, digest = `sha256:${sha256(bytes)}`) {
  return {
    artifactId: 710000017,
    expectedByteLength: bytes.byteLength,
    expectedSha256: digest,
    runId: "30460000000",
  }
}

function topology() {
  return {
    callerEnrollment: {
      repositoryId: 1304576182,
      repositorySlug: callerRepository,
      workflowPath: ".github/workflows/research-attestation.yml",
      workflowRef: "refs/heads/main",
      workflowSha: "a".repeat(40),
    },
    callerSource: {
      ref: "refs/heads/main",
      sourceSha: "b".repeat(40),
    },
    reusableSigner: {
      repositorySlug: "jyt6640/persona-harness",
      workflowPath: ".github/workflows/persona-harness-project-finish.yml",
      workflowSha: "c".repeat(40),
    },
  }
}

function response(statusCode: number, headers: Record<string, string>, body: AsyncIterable<Buffer> | readonly Buffer[]) {
  const asyncBody: AsyncIterable<Buffer> = Symbol.asyncIterator in Object(body)
    ? body as AsyncIterable<Buffer>
    : chunks(Buffer.concat(body as readonly Uint8Array[]))
  return { body: asyncBody, headers, statusCode }
}

async function* chunks(bytes: Buffer, size = bytes.byteLength || 1): AsyncGenerator<Buffer> {
  for (let offset = 0; offset < bytes.byteLength; offset += size) {
    yield bytes.subarray(offset, Math.min(bytes.byteLength, offset + size))
  }
}

function zipHeaders(bytes: Buffer): Record<string, string> {
  return {
    "content-length": String(bytes.byteLength),
    "content-type": "application/zip",
  }
}

function unsafeArchive(): Buffer {
  return archiveFor({
    "../bundle.json": Buffer.from("unsafe", "utf8"),
    "predicate.json": Buffer.from("predicate", "utf8"),
    "receipt.json": Buffer.from("receipt", "utf8"),
  })
}

function archiveFor(members: Readonly<Record<string, Buffer>>): Buffer {
  const central: Buffer[] = []
  const local: Buffer[] = []
  let offset = 0
  for (const [name, bytes] of Object.entries(members)) {
    const nameBytes = Buffer.from(name, "utf8")
    const localHeader = Buffer.alloc(30)
    localHeader.writeUInt32LE(0x04034b50, 0)
    localHeader.writeUInt16LE(20, 4)
    localHeader.writeUInt32LE(bytes.byteLength, 18)
    localHeader.writeUInt32LE(bytes.byteLength, 22)
    localHeader.writeUInt16LE(nameBytes.byteLength, 26)
    local.push(localHeader, nameBytes, bytes)

    const centralHeader = Buffer.alloc(46)
    centralHeader.writeUInt32LE(0x02014b50, 0)
    centralHeader.writeUInt16LE(20, 4)
    centralHeader.writeUInt16LE(20, 6)
    centralHeader.writeUInt32LE(bytes.byteLength, 20)
    centralHeader.writeUInt32LE(bytes.byteLength, 24)
    centralHeader.writeUInt32LE(nameBytes.byteLength, 28)
    centralHeader.writeUInt32LE(offset, 42)
    central.push(centralHeader, nameBytes)
    offset += localHeader.byteLength + nameBytes.byteLength + bytes.byteLength
  }
  const directory = Buffer.concat(central)
  const footer = Buffer.alloc(22)
  footer.writeUInt32LE(0x06054b50, 0)
  footer.writeUInt16LE(Object.keys(members).length, 8)
  footer.writeUInt16LE(Object.keys(members).length, 10)
  footer.writeUInt32LE(directory.byteLength, 12)
  footer.writeUInt32LE(offset, 16)
  return Buffer.concat([...local, directory, footer])
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex")
}

function temporaryRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "persona-beta17-transport-test-"))
  temporaryRoots.push(root)
  return root
}

function capturePrivateRoot(roots: string[]): string {
  const root = temporaryRoot()
  roots.push(root)
  return root
}

async function expectObserverBlock(action: Promise<unknown>, code: string): Promise<void> {
  try {
    await action
  } catch (error) {
    if (error instanceof ExternalObserverArtifactError) {
      expect(error.code).toBe(code)
      return
    }
    throw error
  }
  throw new Error(`expected observer transport block: ${code}`)
}

function expectPlanBlock(action: () => unknown, label: string): void {
  try {
    action()
  } catch (error) {
    if (error instanceof ExternalArtifactTransportPlanError) {
      expect(error.code, label).toBe("external-artifact-transport-plan")
      return
    }
    throw error
  }
  throw new Error(`${label} unexpectedly passed`)
}
