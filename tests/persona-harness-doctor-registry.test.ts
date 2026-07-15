import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"

const projects: string[] = []

function project(): string {
  const directory = mkdtempSync(join(tmpdir(), "persona-doctor-registry-"))
  projects.push(directory)
  return directory
}

function doctor(projectDir: string, env: Record<string, string | undefined>) {
  return runPersonaCli(["doctor"], {
    cwd: projectDir,
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
        next: "0.7.0-rc.3",
      }),
      PH_DOCTOR_REGISTRY_DEPRECATED: "false",
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Registry status: available")
    expect(result.stdout).toContain("Installed channel: 0.7.0-rc.3")
    expect(result.stdout).toContain("Latest channel: 0.6.0 (DRIFT)")
    expect(result.stdout).toContain("Next channel: 0.7.0-rc.3 (MATCH)")
    expect(result.stdout).toContain("Legacy channel: retired")
    expect(result.stdout).toContain("Deprecation: none observed")
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
    expect(result.stdout).toContain("Deprecation: present")
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
})
