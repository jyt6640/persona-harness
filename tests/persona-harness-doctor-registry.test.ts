import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"
import { readDoctorSummary, runDoctorCommand } from "../src/cli/doctor.js"
import { readDoctorRegistryFromNpm } from "../src/cli/doctor-registry-readback.js"
import { personaHarnessVersion } from "../src/cli/version.js"
import { inspectReadySigstoreTrust } from "./helpers/sigstore-trust-readiness.js"

const projects: string[] = []
const PUBLISHED_NEXT_VERSION = "0.7.0-rc.3"

function project(): string {
  const directory = mkdtempSync(join(tmpdir(), "persona-doctor-registry-"))
  projects.push(directory)
  return directory
}

function doctor(projectDir: string, env: Record<string, string | undefined>) {
  return runPersonaCli(["doctor"], {
    cwd: projectDir,
    doctorSigstoreTrustInspector: inspectReadySigstoreTrust,
    env: {
      PH_DOCTOR_OPENCODE_VERSION: "1.0.0-test",
      ...env,
    },
    invocationName: "ph",
  })
}

afterEach(() => {
  for (const directory of projects.splice(0)) {
    rmSync(directory, { force: true, recursive: true })
  }
})

describe("ph doctor registry diagnostics", () => {
  it("shows installed/latest/next/legacy channel drift without making latest authoritative", () => {
    const result = doctor(project(), {
      PH_DOCTOR_REGISTRY_DIST_TAGS: JSON.stringify({
        latest: "0.6.0",
        next: PUBLISHED_NEXT_VERSION,
      }),
      PH_DOCTOR_REGISTRY_DEPRECATED: "false",
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Registry status: available")
    expect(result.stdout).toContain(`Installed channel: ${personaHarnessVersion()}`)
    expect(result.stdout).toContain("Latest channel: 0.6.0 (DRIFT)")
    expect(result.stdout).toContain(
      `Next channel: ${PUBLISHED_NEXT_VERSION} (${personaHarnessVersion() === PUBLISHED_NEXT_VERSION ? "MATCH" : "DRIFT"})`,
    )
    expect(result.stdout).toContain("Legacy channel: retired")
    expect(result.stdout).toContain("Installed deprecation: none observed")
    expect(result.stdout).toContain("Finish authority: BLOCKED")
  })

  it("reports deprecation and missing facts as bounded non-PASS diagnostics", () => {
    const result = doctor(project(), {
      PH_DOCTOR_REGISTRY_DIST_TAGS: JSON.stringify({ latest: "0.6.0" }),
      PH_DOCTOR_REGISTRY_DEPRECATED: JSON.stringify("package is deprecated; secret-marker"),
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Registry status: available")
    expect(result.stdout).toContain("Next channel: unavailable")
    expect(result.stdout).toContain("Legacy channel: retired")
    expect(result.stdout).toContain("Installed deprecation: present")
    expect(result.stdout).not.toContain("secret-marker")
    expect(result.stdout).toContain("Finish authority: BLOCKED")
  })

  it.each([
    ["malformed", "{broken"],
    ["timeout", "timeout"],
    ["unavailable", "unavailable"],
  ] as const)("fails closed with bounded %s registry facts", (kind, response) => {
    const result = doctor(project(), {
      PH_DOCTOR_REGISTRY_DIST_TAGS: response,
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain(`Registry status: ${kind}`)
    expect(result.stdout).toContain("Runtime readiness: WARN")
    expect(result.stdout).not.toContain(response === "{broken" ? "broken" : "raw-registry-body")
    expect(result.stdout).toContain("Finish authority: BLOCKED")
  })

  it.each([
    ["token", "sk-live-aaaaaaaaaaaaaaaaaaaaaaaa"],
    ["secret", "Bearer super-secret-registry-value"],
    ["posix path", "/tmp/registry-version"],
    ["windows path", "C:\\Users\\runner\\registry-version"],
    ["empty", ""],
  ] as const)("rejects unsafe %s channel values in plaintext and JSON", (_kind, value) => {
    const projectDir = project()
    const tags = JSON.stringify({ latest: value, alpha: value })
    const plaintext = doctor(projectDir, {
      PH_DOCTOR_REGISTRY_DIST_TAGS: tags,
    })
    const json = runPersonaCli(["doctor", "--json"], {
      cwd: projectDir,
      doctorSigstoreTrustInspector: inspectReadySigstoreTrust,
      env: {
        PH_DOCTOR_OPENCODE_VERSION: "1.0.0-test",
        PH_DOCTOR_REGISTRY_DIST_TAGS: tags,
      },
      invocationName: "ph",
    })

    expect(plaintext.status).toBe(0)
    expect(plaintext.stdout).toContain("Registry status: malformed")
    if (value.length > 0) {
      expect(plaintext.stdout).not.toContain(value)
    }
    expect(json.status).toBe(0)
    const payload = JSON.parse(json.stdout) as {
      readonly registry: {
        readonly status: string
        readonly channels: {
          readonly latest: string
          readonly legacy: string
        }
      }
      readonly runtimeReadiness: string
    }
    expect(payload.registry.status).toBe("malformed")
    expect(payload.registry.channels.latest).toBe("unavailable")
    expect(payload.registry.channels.legacy).toBe("unavailable")
    expect(payload.runtimeReadiness).toBe("WARN")
    if (value.length > 0) {
      expect(json.stdout).not.toContain(value)
    }
  })

  it.each([
    ["token in build metadata", "1.2.3+sk-live-aaaaaaaaaaaaaaaaaaaaaaaa"],
    ["token in prerelease", "1.2.3-sk-live-aaaaaaaaaaaaaaaaaaaaaaaa"],
    ["API key fragment", "1.2.3+api-key-secret"],
    ["Bearer fragment", "1.2.3-bearer-secret"],
    ["password fragment", "1.2.3+password-secret"],
    ["JDBC fragment", "1.2.3-jdbc-secret"],
    ["PEM fragment", "1.2.3+pem-secret"],
    ["URL userinfo fragment", "1.2.3+user:password@host"],
    ["oversized build metadata", `1.2.3+${"a".repeat(5_000)}`],
  ] as const)("rejects sensitive or oversized semver-shaped %s values", (_kind, value) => {
    const projectDir = project()
    const tags = JSON.stringify({ latest: value })
    const plaintext = doctor(projectDir, {
      PH_DOCTOR_REGISTRY_DIST_TAGS: tags,
    })
    const json = runPersonaCli(["doctor", "--json"], {
      cwd: projectDir,
      doctorSigstoreTrustInspector: inspectReadySigstoreTrust,
      env: {
        PH_DOCTOR_OPENCODE_VERSION: "1.0.0-test",
        PH_DOCTOR_REGISTRY_DIST_TAGS: tags,
      },
      invocationName: "ph",
    })

    expect(plaintext.status).toBe(0)
    expect(plaintext.stdout).toContain("Registry status: malformed")
    expect(plaintext.stdout).toContain("Runtime readiness: WARN")
    expect(plaintext.stdout).not.toContain(value)
    expect(json.status).toBe(0)
    const payload = JSON.parse(json.stdout) as {
      readonly registry: {
        readonly status: string
        readonly channels: { readonly latest: string }
      }
      readonly runtimeReadiness: string
    }
    expect(payload.registry.status).toBe("malformed")
    expect(payload.registry.channels.latest).toBe("unavailable")
    expect(payload.runtimeReadiness).toBe("WARN")
    expect(json.stdout).not.toContain(value)
  })

  it("provides a bounded JSON projection with preview/privacy and authority boundaries", () => {
    const projectDir = project()
    const result = runPersonaCli(["doctor", "--json"], {
      cwd: projectDir,
      doctorSigstoreTrustInspector: inspectReadySigstoreTrust,
      env: {
        PH_DOCTOR_OPENCODE_VERSION: "1.0.0-test",
        PH_DOCTOR_REGISTRY_DIST_TAGS: JSON.stringify({ latest: "0.6.0", next: "0.7.0-rc.3" }),
        PH_DOCTOR_REGISTRY_DEPRECATED: "false",
      },
      invocationName: "ph",
    })

    expect(result.status).toBe(0)
    const payload = JSON.parse(result.stdout) as {
      readonly authority: { readonly finish: string; readonly receipt: string }
      readonly registry: { readonly channels: { readonly next: string }; readonly status: string }
      readonly schemaVersion: string
    }
    expect(payload.schemaVersion).toBe("doctor.1")
    expect(payload.registry.status).toBe("available")
    expect(payload.registry.channels.next).toBe("0.7.0-rc.3")
    expect(payload.authority.finish).toBe("blocked")
    expect(payload.authority.receipt).toBe("diagnostic-only")
    expect(result.stdout).not.toContain(projectDir)
  })

  it("reads fixed registry channels and the installed version deprecation without granting authority", () => {
    const projectDir = project()
    const requests: Array<{ readonly args: readonly string[]; readonly kind: string }> = []
    const registryReader = (request: { readonly args: readonly string[]; readonly kind: string }) => {
      requests.push(request)
      return request.kind === "dist-tags"
        ? {
            status: "available" as const,
            text: JSON.stringify({
              latest: "0.7.0",
              next: "0.7.0-rc.3",
              staging: "0.7.0-rc.8",
            }),
          }
        : { status: "available" as const, text: JSON.stringify("retired after replacement") }
    }
    const externalTrustInspector = () => ({
      authorityEligible: true,
      consumptionState: "unconsumed" as const,
      decision: "trusted" as const,
      diagnostics: [],
      state: "trusted" as const,
      summary: "unused by doctor output",
    })
    const options = {
      env: { PH_DOCTOR_OPENCODE_VERSION: "1.0.0-test" },
      externalTrustInspector,
      projectDir,
      registryReader,
      sigstoreTrustInspector: inspectReadySigstoreTrust,
    }

    const summary = readDoctorSummary(options)
    const plaintext = runDoctorCommand([], options)
    const json = runDoctorCommand(["--json"], options)

    expect(requests).toEqual([
      {
        args: ["view", "persona-harness", "dist-tags", "--json", "--registry", "https://registry.npmjs.org"],
        kind: "dist-tags",
      },
      {
        args: [
          "view",
          `persona-harness@${personaHarnessVersion()}`,
          "deprecated",
          "--json",
          "--registry",
          "https://registry.npmjs.org",
        ],
        kind: "deprecation",
      },
      {
        args: ["view", "persona-harness", "dist-tags", "--json", "--registry", "https://registry.npmjs.org"],
        kind: "dist-tags",
      },
      {
        args: [
          "view",
          `persona-harness@${personaHarnessVersion()}`,
          "deprecated",
          "--json",
          "--registry",
          "https://registry.npmjs.org",
        ],
        kind: "deprecation",
      },
      {
        args: ["view", "persona-harness", "dist-tags", "--json", "--registry", "https://registry.npmjs.org"],
        kind: "dist-tags",
      },
      {
        args: [
          "view",
          `persona-harness@${personaHarnessVersion()}`,
          "deprecated",
          "--json",
          "--registry",
          "https://registry.npmjs.org",
        ],
        kind: "deprecation",
      },
    ])
    expect(summary.registryDetails.channels).toMatchObject({
      installed: personaHarnessVersion(),
      latest: "0.7.0",
      legacy: "retired",
      next: "0.7.0-rc.3",
      staging: "0.7.0-rc.8",
    })
    expect(summary.registryDetails.deprecation).toBe("present")
    expect(summary.externalTrust).toMatchObject({
      availability: "trusted",
      consumption: "unconsumed",
      state: "trusted",
    })
    expect(plaintext.status).toBe(0)
    expect(plaintext.stdout).toContain("Staging channel: 0.7.0-rc.8 (DRIFT)")
    expect(plaintext.stdout).toContain("Installed deprecation: present")
    expect(plaintext.stdout).toContain("External assurance readiness: TRUSTED (trusted; unconsumed; read-only)")
    expect(plaintext.stdout).not.toContain("retired after replacement")
    expect(json.status).toBe(0)
    const payload = JSON.parse(json.stdout) as {
      readonly authority: { readonly external: Record<string, unknown>; readonly finish: string }
      readonly registry: Record<string, unknown>
    }
    expect(payload.registry).toEqual(summary.registryDetails)
    expect(payload.authority.external).toEqual(summary.externalTrust)
    expect(payload.authority.finish).toBe("blocked")
  })

  it.each([
    "1.2",
    "01.2.3",
    "1.2.3-sk-live-aaaaaaaaaaaaaaaaaaaaaaaa",
    "C:\\Users\\runner\\persona-harness",
  ])("does not construct a registry request from an unsafe installed version", (installedVersion) => {
    let called = false
    const readback = readDoctorRegistryFromNpm(installedVersion, () => {
      called = true
      return { status: "available", text: "{}" }
    })

    expect(called).toBe(false)
    expect(readback.distTags).toEqual({ status: "malformed" })
    expect(readback.deprecation).toEqual({ status: "unavailable" })
  })

  it("keeps malformed installed deprecation metadata bounded while retaining channel facts", () => {
    const secret = "sk-live-aaaaaaaaaaaaaaaaaaaaaaaa"
    const result = runDoctorCommand(["--json"], {
      env: { PH_DOCTOR_OPENCODE_VERSION: "1.0.0-test" },
      projectDir: project(),
      registryReader: (request: { readonly kind: string }) => request.kind === "dist-tags"
        ? {
            status: "available" as const,
            text: JSON.stringify({
              latest: "0.7.0",
              next: "0.7.0-rc.3",
              staging: "0.7.0-rc.8",
            }),
          }
        : { status: "available" as const, text: `{${secret}` },
      sigstoreTrustInspector: inspectReadySigstoreTrust,
    })

    expect(result.status).toBe(0)
    expect(result.stdout).not.toContain(secret)
    const payload = JSON.parse(result.stdout) as {
      readonly registry: {
        readonly deprecation: string
        readonly diagnostics: readonly string[]
        readonly status: string
      }
    }
    expect(payload.registry.status).toBe("available")
    expect(payload.registry.deprecation).toBe("unavailable")
    expect(payload.registry.diagnostics).toEqual(["registry-deprecation-malformed"])
  })

  it.each([
    ["timeout", { status: "timeout" as const }],
    ["unavailable", { status: "unavailable" as const }],
    ["oversized", { status: "available" as const, text: JSON.stringify({ latest: `1.2.3+${"a".repeat(65_536)}` }) }],
    ["secret", { status: "available" as const, text: JSON.stringify({ latest: "1.2.3+sk-live-aaaaaaaaaaaaaaaaaaaaaaaa" }) }],
  ] as const)("keeps %s readback failures bounded and non-authoritative", (_kind, distTags) => {
    const secret = "sk-live-aaaaaaaaaaaaaaaaaaaaaaaa"
    const result = runDoctorCommand(["--json"], {
      env: { PH_DOCTOR_OPENCODE_VERSION: "1.0.0-test" },
      projectDir: project(),
      registryReader: (request: { readonly kind: string }) => request.kind === "dist-tags"
        ? distTags
        : { status: "available" as const, text: JSON.stringify(`deprecation ${secret}`) },
      sigstoreTrustInspector: inspectReadySigstoreTrust,
    })

    expect(result.status).toBe(0)
    expect(result.stdout).not.toContain(secret)
    const payload = JSON.parse(result.stdout) as {
      readonly authority: { readonly finish: string }
      readonly registry: {
        readonly channels: { readonly latest: string; readonly staging: string }
        readonly status: string
      }
      readonly runtimeReadiness: string
    }
    expect(payload.authority.finish).toBe("blocked")
    expect(payload.registry.channels.latest).toBe("unavailable")
    expect(payload.registry.channels.staging).toBe("unavailable")
    expect(payload.registry.status).not.toBe("available")
    expect(payload.runtimeReadiness).toBe("WARN")
  })

  it("blocks external assurance before inspection when the Node runtime floor is unsupported", () => {
    let inspected = false
    const result = runDoctorCommand(["--json"], {
      env: {
        PH_DOCTOR_OPENCODE_VERSION: "1.0.0-test",
        PH_DOCTOR_REGISTRY_DIST_TAGS: JSON.stringify({ latest: "0.7.0", next: "0.7.0-rc.3", staging: "0.7.0-rc.8" }),
        PH_DOCTOR_REGISTRY_DEPRECATED: "false",
      },
      externalTrustInspector: () => {
        inspected = true
        throw new Error("doctor must not inspect external trust below the Node floor")
      },
      nodeVersion: "21.0.0",
      projectDir: project(),
      sigstoreTrustInspector: inspectReadySigstoreTrust,
    })

    expect(inspected).toBe(false)
    expect(result.status).toBe(0)
    const payload = JSON.parse(result.stdout) as {
      readonly authority: { readonly external: { readonly state: string } }
      readonly runtime: { readonly nodeSupport: { readonly status: string } }
    }
    expect(payload.runtime.nodeSupport.status).toBe("unsupported")
    expect(payload.authority.external.state).toBe("runtime-unsupported")
  })
})
