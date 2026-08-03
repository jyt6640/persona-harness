import { spawnSync } from "node:child_process"
import { chmodSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  ExternalAttestationCommandPlanError,
  classifyGhAttestationExit,
  parseExternalAttestationCommandPlan,
  renderExternalAttestationVerifyArguments,
  runExternalAttestationGrammarPreflight,
} from "../scripts/consumer-authority-external-attestation-command-plan.mjs"
import type {
  ExternalAttestationCommandPlan,
  ExternalAttestationTopology,
} from "../scripts/consumer-authority-external-attestation-command-plan.mjs"

const canonicalPlan: ExternalAttestationCommandPlan = {
  certificateOidcIssuer: "https://token.actions.githubusercontent.com",
  command: ["attestation", "verify"],
  denySelfHostedRunners: true,
  exitClassification: {
    authenticationRequired: 4,
    normalVerificationFailure: 1,
    verified: 0,
  },
  format: "json",
  predicateType: "https://github.com/jyt6640/persona-harness/attestations/project-finish-attestation.1",
  repositorySelector: {
    flag: "--repo",
    source: "caller-enrollment.repositorySlug",
  },
  schemaVersion: "consumer-authority-external-attestation-command-plan.1",
  signerDigest: {
    flag: "--signer-digest",
    source: "reusable-signer.workflowSha",
  },
  signerSelector: {
    flag: "--signer-workflow",
    source: "reusable-signer.workflowPath",
  },
  sourceDigest: {
    flag: "--source-digest",
    source: "caller-source.sourceSha",
  },
  sourceRef: {
    flag: "--source-ref",
    source: "caller-source.ref",
  },
  tokenIsolation: {
    artifactAccess: "forbidden-during-preflight",
    credential: "absent",
    output: "bounded-classification-only",
  },
}

const canonicalTopology: ExternalAttestationTopology = {
  callerEnrollment: {
    repositoryId: 1304576182,
    repositorySlug: "jyt6640/persona-harness-attestation-claim-fixture",
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

describe("consumer authority beta.16 external attestation command plan", () => {
  it("renders one caller repository selector and one distinct reusable workflow signer selector", () => {
    const argumentsList = renderExternalAttestationVerifyArguments(
      canonicalPlan,
      canonicalTopology,
      { bundlePath: "/observer/original/bundle.json", subjectPath: "/observer/original/subject.bin" },
    )

    expect(argumentsList).toEqual([
      "attestation",
      "verify",
      "/observer/original/subject.bin",
      "--bundle",
      "/observer/original/bundle.json",
      "--repo",
      "jyt6640/persona-harness-attestation-claim-fixture",
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
    expect(argumentsList).not.toContain("--owner")
    expect(argumentsList).not.toContain("--cert-identity")
    expect(argumentsList).not.toContain("--signer-repo")
  })

  it("rejects selector drift, malformed topology, and token-shaped input before invoking gh", () => {
    const cases: Array<{ readonly apply: (value: Record<string, unknown>) => void; readonly name: string }> = [
      {
        name: "owner selector",
        apply: (value) => { record(value["repositorySelector"])["flag"] = "--owner" },
      },
      {
        name: "certificate identity selector",
        apply: (value) => { record(value["signerSelector"])["flag"] = "--cert-identity" },
      },
      {
        name: "foreign signer workflow path",
        apply: (value) => { record(value["signerSelector"])["source"] = "caller-enrollment.workflowPath" },
      },
      {
        name: "wrong signer digest selector",
        apply: (value) => { record(value["signerDigest"])["flag"] = "--cert-identity" },
      },
      {
        name: "wrong predicate",
        apply: (value) => { value["predicateType"] = "https://example.invalid/predicate" },
      },
      {
        name: "wrong issuer",
        apply: (value) => { value["certificateOidcIssuer"] = "https://example.invalid/issuer" },
      },
      {
        name: "wrong source ref selector",
        apply: (value) => { record(value["sourceRef"])["source"] = "caller-enrollment.workflowRef" },
      },
      {
        name: "wrong source digest selector",
        apply: (value) => { record(value["sourceDigest"])["source"] = "caller-enrollment.workflowSha" },
      },
      {
        name: "token isolation downgrade",
        apply: (value) => { record(value["tokenIsolation"])["credential"] = "host-token" },
      },
      {
        name: "token-shaped field",
        apply: (value) => { value["token"] = "ghp_not_allowed" },
      },
      {
        name: "missing repository selector",
        apply: (value) => { delete value["repositorySelector"] },
      },
    ]

    for (const testCase of cases) {
      const candidate = structuredClone(canonicalPlan) as unknown as Record<string, unknown>
      testCase.apply(candidate)
      expectPlanBlock(() => parseExternalAttestationCommandPlan(candidate), testCase.name)
    }

    let invoked = false
    const { signerSelector: _discardedSignerSelector, ...missingSignerSelector } = canonicalPlan
    expectPlanBlock(
      () => runExternalAttestationGrammarPreflight(missingSignerSelector as never, canonicalTopology, {
        execute: () => {
          invoked = true
          throw new Error("gh must not run for an invalid command plan")
        },
      }),
      "missing signer selector before artifact access",
    )
    expect(invoked).toBe(false)

    const malformedTopology = structuredClone(canonicalTopology) as unknown as Record<string, unknown>
    record(malformedTopology["reusableSigner"])["workflowSha"] = "not-a-sha"
    expectPlanBlock(
      () => renderExternalAttestationVerifyArguments(canonicalPlan, malformedTopology as never, {
        bundlePath: "/observer/original/bundle.json",
        subjectPath: "/observer/original/subject.bin",
      }),
      "malformed reusable digest",
    )

    for (const testCase of [
      {
        name: "foreign caller repository",
        apply: (topology: Record<string, unknown>) => { record(topology["callerEnrollment"])["repositorySlug"] = "example/foreign" },
      },
      {
        name: "foreign reusable workflow path",
        apply: (topology: Record<string, unknown>) => { record(topology["reusableSigner"])["workflowPath"] = ".github/workflows/foreign.yml" },
      },
      {
        name: "wrong caller source ref",
        apply: (topology: Record<string, unknown>) => { record(topology["callerSource"])["ref"] = "refs/heads/feature" },
      },
      {
        name: "malformed caller source digest",
        apply: (topology: Record<string, unknown>) => { record(topology["callerSource"])["sourceSha"] = "not-a-sha" },
      },
    ]) {
      const topology = structuredClone(canonicalTopology) as unknown as Record<string, unknown>
      testCase.apply(topology)
      expectPlanBlock(
        () => renderExternalAttestationVerifyArguments(canonicalPlan, topology as never, {
          bundlePath: "/observer/original/bundle.json",
          subjectPath: "/observer/original/subject.bin",
        }),
        testCase.name,
      )
    }
  })

  it("preflights the canonical grammar without a token, artifact request, or raw output reflection", () => {
    const root = mkdtempSync(join(tmpdir(), "persona-external-attestation-plan-tool-test-"))
    const tokenMarker = "ghp_external_attestation_preflight_token_marker"
    let calls = 0
    try {
      const ghPath = join(root, "gh")
      writeGhFixture(ghPath)
      const result = runExternalAttestationGrammarPreflight(canonicalPlan, canonicalTopology, {
        execute: (command, argumentsList, options) => {
          calls += 1
          expect(command).toBe(ghPath)
          if (argumentsList.join("\0") === "--version") {
            return { status: 0, stderr: "", stdout: "gh version 2.96.0 (fixture)\n" }
          }
          expect(argumentsList).toContain("--repo")
          expect(argumentsList).toContain("--signer-workflow")
          expect(argumentsList.at(-1)).toBe("--help")
          expect(options.env.GH_TOKEN).toBeUndefined()
          expect(options.env.GITHUB_TOKEN).toBeUndefined()
          expect(options.env.PH_OBSERVER_PREFLIGHT_GITHUB_TOKEN).toBeUndefined()
          expect(options.env.PATH).toBeUndefined()
          expect(Object.values(options.env).join("\n")).not.toContain(tokenMarker)
          return { status: 0, stderr: "", stdout: tokenMarker }
        },
        ghPath,
      })

      expect(calls).toBe(2)
      expect(result).toEqual({
        artifactAccess: false,
        authorityEligible: false,
        code: "gh-command-parser-accepted",
        credential: "absent",
        exit: "parser-accepted",
        networkAccess: false,
        schemaVersion: "consumer-authority-external-attestation-preflight.2",
        state: "ready",
      })
      expect(JSON.stringify(result)).not.toContain(tokenMarker)
    } finally {
      rmSync(root, { force: true, recursive: true })
    }
  })

  it("classifies gh exits with bounded states", () => {
    expect(classifyGhAttestationExit(0)).toBe("verified")
    expect(classifyGhAttestationExit(1)).toBe("verification-failed")
    expect(classifyGhAttestationExit(4)).toBe("authentication-required")
    expect(classifyGhAttestationExit(2)).toBe("execution-failed")
  })

  it("uses the installed gh parser with a token-free, no-artifact sentinel", () => {
    const root = mkdtempSync(join(tmpdir(), "persona-external-attestation-plan-test-"))
    const tokenMarker = "ghp_external_attestation_cli_token_marker"
    try {
      const ghPath = join(root, "gh")
      writeGhFixture(ghPath)
      const result = spawnSync(
        process.execPath,
        ["scripts/preflight-consumer-authority-external-attestation.mjs", "--json", "--observer-gh", ghPath],
        {
          cwd: process.cwd(),
          encoding: "utf8",
          env: {
            GH_TOKEN: tokenMarker,
            GITHUB_TOKEN: tokenMarker,
            HOME: root,
          },
          maxBuffer: 64 * 1024,
        },
      )
      const output = `${result.stdout ?? ""}${result.stderr ?? ""}`
      expect(result.status).toBe(0)
      expect(JSON.parse(result.stdout ?? "")).toEqual({
        artifactAccess: false,
        authorityEligible: false,
        code: "gh-command-parser-accepted",
        credential: "absent",
        exit: "parser-accepted",
        networkAccess: false,
        schemaVersion: "consumer-authority-external-attestation-preflight.2",
        state: "ready",
      })
      expect(output).not.toContain(tokenMarker)
      expect(output).not.toContain(root)
    } finally {
      rmSync(root, { force: true, recursive: true })
    }
  })

  it("executes the public preflight through a symlinked package root", () => {
    const root = mkdtempSync(join(tmpdir(), "persona-external-attestation-plan-link-test-"))
    const alias = join(root, "package-alias")
    try {
      symlinkSync(process.cwd(), alias, "dir")
      const ghPath = join(root, "gh")
      writeGhFixture(ghPath)
      const result = spawnSync(
        process.execPath,
        [join(alias, "scripts", "preflight-consumer-authority-external-attestation.mjs"), "--json", "--observer-gh", ghPath],
        {
          cwd: root,
          encoding: "utf8",
          env: {
            HOME: root,
          },
          maxBuffer: 64 * 1024,
        },
      )
      expect(result.status).toBe(0)
      expect(JSON.parse(result.stdout ?? "")).toMatchObject({
        artifactAccess: false,
        code: "gh-command-parser-accepted",
        credential: "absent",
        state: "ready",
      })
    } finally {
      rmSync(root, { force: true, recursive: true })
    }
  })
})

function expectPlanBlock(action: () => void, label: string): void {
  try {
    action()
  } catch (error) {
    if (error instanceof ExternalAttestationCommandPlanError) {
      expect(error.code, label).toBe("external-attestation-command-plan")
      return
    }
    throw error
  }
  throw new Error(`${label} unexpectedly passed`)
}

function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("expected record")
  }
  return value as Record<string, unknown>
}

function writeGhFixture(path: string): void {
  writeFileSync(path, [
    `#!${process.execPath}`,
    "if (process.argv[2] === '--version') {",
    "  process.stdout.write('gh version 2.96.0 (fixture)\\n')",
    "  process.exit(0)",
    "}",
    "const argumentsList = process.argv.slice(2)",
    "if (argumentsList.at(-1) !== '--help' || argumentsList.includes('--unknown')) process.exit(1)",
    "for (let index = 0; index < argumentsList.length; index += 1) {",
    "  if (argumentsList[index] === '--signer-digest' && argumentsList[index + 1] === '--help') process.exit(1)",
    "}",
    "process.exit(0)",
    "",
  ].join("\n"))
  chmodSync(path, 0o700)
}
