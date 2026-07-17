import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import {
  verifyStagedPackageArtifactEvidence,
} from "../scripts/staged-package-artifact-provenance-core.mjs"
import {
  verifyStagedPackageArtifactStatement,
} from "../scripts/staged-package-artifact-provenance-policy.mjs"

const FIXTURE_ROOT = "tests/fixtures/staged-package-artifact/rc6"
const BUNDLE = readJson(`${FIXTURE_ROOT}/bundle.json`)
const ACTION_RUN = readJson(`${FIXTURE_ROOT}/action-run.json`)
const MANIFEST = readJson(`${FIXTURE_ROOT}/manifest.json`)
const PREDICATE = readJson(`${FIXTURE_ROOT}/predicate.json`)
const TARBALL = readFileSync(`${FIXTURE_ROOT}/package.tgz`)
const SHA256 = "sha256:37f679a0125c354d5f5c5c8ad933fe7a6e7d9e6df6ab892afdf06ed2310b7794"
const SHA1 = "3fa7e7579e885ee9446f2e4b55bdaa13b1abf80e"
const INTEGRITY = "sha512-Gf3g0U4YZ3fmD327ruboyPCEctMITx+0X9l7iUN9IKD82jWygwxVZS+tiYvYRSAn1udYW5Lq8QwldZ+4n7mY7Q=="
const SOURCE_HEAD = "1c8976c58102908329f63dc78286b2646bfc52dd"

describe("staged package artifact provenance", () => {
  it("pins the original public RC6 artifact components and excludes its fixture from runtime", () => {
    const manifest = requireRecord(MANIFEST)
    const bundleBytes = readFileSync(`${FIXTURE_ROOT}/bundle.json`)
    const predicateBytes = readFileSync(`${FIXTURE_ROOT}/predicate.json`)

    expect(manifest["artifactId"]).toBe(8405236030)
    expect(manifest["artifactZipSha256"]).toBe("654bffb4e0ad34d40504a123f148f87116a2f6d4efcbea7d217954f3c907ae2c")
    expect(manifest["bundleSha256"]).toBe(digest(bundleBytes))
    expect(manifest["predicateSha256"]).toBe(digest(predicateBytes))
    expect(manifest["subjectTarballSha256"]).toBe(SHA256.slice("sha256:".length))
    expect(digest(TARBALL)).toBe(SHA256.slice("sha256:".length))
    expect(PREDICATE).toEqual(requireRecord(fixtureStatement()["predicate"]))
  })

  it("cryptographically verifies the original exact RC6 artifact without granting authority", async () => {
    const verified = await verifyStagedPackageArtifactEvidence(fixtureInput())

    expect(verified).toEqual({
      channel: "staging",
      sourceHead: SOURCE_HEAD,
      subjectDigest: SHA256,
      version: "0.7.0-rc.6",
    })
  }, 30_000)

  it("rejects a same-name and version repack even when caller facts match the replacement bytes", () => {
    const repacked = Buffer.concat([TARBALL, Buffer.from("\n")])
    const repackedSha1 = createHash("sha1").update(repacked).digest("hex")
    const repackedIntegrity = `sha512-${createHash("sha512").update(repacked).digest("base64")}`
    const repackedSha256 = `sha256:${createHash("sha256").update(repacked).digest("hex")}`
    const statement = fixtureStatement()
    const registry = {
      gitHead: SOURCE_HEAD,
      integrity: repackedIntegrity,
      shasum: repackedSha1,
      tarballSha256: repackedSha256,
    }

    expect(() => verifyStagedPackageArtifactStatement({
      actionRun: ACTION_RUN,
      attestationRepositoryId: 1272008570,
      now: new Date("2026-07-17T12:00:00.000Z"),
      registry,
      selection: { channel: "staging", version: "0.7.0-rc.6" },
      statement,
      tarball: {
        integrity: repackedIntegrity,
        packageName: "persona-harness",
        sha1: repackedSha1,
        sha256: repackedSha256,
        version: "0.7.0-rc.6",
      },
    })).toThrow("artifact-provenance-subject-binding")
  })

  it("fails closed for replay, expiry, and copied source bindings", async () => {
    const attestation = fixtureAttestation()
    await expect(verifyStagedPackageArtifactEvidence({
      ...fixtureInput(),
      attestation,
      attestations: [attestation, attestation],
    })).rejects.toMatchObject({ code: "artifact-provenance-replay" })

    const expired = fixtureStatement()
    requireRecord(expired["predicate"])["expiresAt"] = "2026-07-17T11:22:00.000Z"
    expect(() => verifyStagedPackageArtifactStatement(statementInput(expired))).toThrow("artifact-provenance-expired")

    const copied = fixtureStatement()
    requireRecord(requireRecord(copied["predicate"])["source"])["head"] = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    expect(() => verifyStagedPackageArtifactStatement(statementInput(copied))).toThrow("artifact-provenance-source-binding")
  })

  it.each([
    ["wrong selected tag", "artifact-provenance-registry-binding", (statement: Record<string, unknown>) => {
      requireRecord(requireRecord(statement["predicate"])["registry"])["selectedTag"] = "next"
    }],
    ["wrong workflow ref", "artifact-provenance-run-binding", (statement: Record<string, unknown>) => {
      requireRecord(requireRecord(requireRecord(statement["predicate"])["run"])["workflow"])["ref"] = "jyt6640/persona-harness/.github/workflows/other.yml@refs/heads/main"
    }],
    ["wrong repository", "artifact-provenance-run-binding", (statement: Record<string, unknown>) => {
      requireRecord(requireRecord(statement["predicate"])["run"])["repository"] = "other/repository"
    }],
    ["wrong command plan", "artifact-provenance-command-binding", (statement: Record<string, unknown>) => {
      requireRecord(requireRecord(statement["predicate"])["command"])["planDigest"] = `sha256:${"0".repeat(64)}`
    }],
    ["wrong nonce", "artifact-provenance-replay", (statement: Record<string, unknown>) => {
      requireRecord(statement["predicate"])["nonce"] = "replayed"
    }],
    ["wrong artifact digest", "artifact-provenance-subject-binding", (statement: Record<string, unknown>) => {
      requireRecord(requireRecord(statement["predicate"])["subject"])["digest"] = { sha256: "0".repeat(64) }
    }],
    ["wrong predicate tarball binding", "artifact-provenance-tarball-binding", (statement: Record<string, unknown>) => {
      requireRecord(requireRecord(statement["predicate"])["tarball"])["size"] = 1
    }],
  ])("fails closed for a %s", (_label, code, mutate) => {
    const statement = fixtureStatement()
    mutate(statement)

    expect(() => verifyStagedPackageArtifactStatement(statementInput(statement))).toThrow(code)
  })

  it("fails closed for malformed or missing attestation input", async () => {
    await expect(verifyStagedPackageArtifactEvidence({
      ...fixtureInput(),
      attestation: { bundle: null, repository_id: 1272008570 },
    })).rejects.toMatchObject({ code: "artifact-provenance-attestation-invalid" })
  })
})

function fixtureInput(): Readonly<Record<string, unknown>> {
  const attestation = fixtureAttestation()
  return {
    actionRun: ACTION_RUN,
    attestation,
    attestations: [attestation],
    channel: "staging",
    now: new Date("2026-07-17T12:00:00.000Z"),
    registryIndex: { "dist-tags": { staging: "0.7.0-rc.6" } },
    registryVersion: {
      dist: {
        integrity: INTEGRITY,
        shasum: SHA1,
        tarball: "https://registry.npmjs.org/persona-harness/-/persona-harness-0.7.0-rc.6.tgz",
      },
      gitHead: SOURCE_HEAD,
      name: "persona-harness",
      version: "0.7.0-rc.6",
    },
    tarballBytes: TARBALL,
    version: "0.7.0-rc.6",
  }
}

function statementInput(statement: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  return {
    actionRun: ACTION_RUN,
    attestationRepositoryId: 1272008570,
    now: new Date("2026-07-17T12:00:00.000Z"),
    registry: {
      gitHead: SOURCE_HEAD,
      integrity: INTEGRITY,
      shasum: SHA1,
      tarballSha256: SHA256,
    },
    selection: { channel: "staging", version: "0.7.0-rc.6" },
    statement,
    tarball: {
      integrity: INTEGRITY,
      packageName: "persona-harness",
      sha1: SHA1,
      sha256: SHA256,
      size: 1908064,
      version: "0.7.0-rc.6",
    },
  }
}

function fixtureAttestation(): Readonly<Record<string, unknown>> {
  return { bundle: BUNDLE, repository_id: 1272008570 }
}

function fixtureStatement(): Record<string, unknown> {
  const bundle = requireRecord(BUNDLE)
  const envelope = requireRecord(bundle["dsseEnvelope"])
  const payload = envelope["payload"]
  if (typeof payload !== "string") throw new TypeError("fixture payload is invalid")
  return requireRecord(JSON.parse(Buffer.from(payload, "base64").toString("utf8")))
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"))
}

function digest(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex")
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new TypeError("fixture record is invalid")
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
