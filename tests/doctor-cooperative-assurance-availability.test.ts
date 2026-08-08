import { describe, expect, it, vi } from "vitest"

import { nativeProjectReadPlatformSupported } from "../src/io/native-project-read.js"

const { runPersonaCli } = await import("../src/cli/index.js")

function doctor(): string {
  return runPersonaCli(["doctor"], { cwd: ".", env: {}, invocationName: "ph" }).stdout
}

function assuranceLine(text: string): string {
  return text.split("\n").find((line) => line.startsWith("Cooperative assurance:")) ?? ""
}

/**
 * A cooperative PASS runs the build through the native project-read boundary,
 * and that artifact is built for darwin and linux only. On Windows the mode is
 * unavailable outright — but nothing said so, and a reader following the rail
 * only discovered it at the final step, after doing all the work.
 */
describe("doctor states whether a cooperative PASS is reachable", () => {
  it("reports the assurance availability at all", () => {
    expect(assuranceLine(doctor())).not.toBe("")
  })

  it("says available where the artifact is built", () => {
    // Guarded rather than assumed: the suite runs on platforms that have it.
    if (!nativeProjectReadPlatformSupported()) return
    expect(assuranceLine(doctor())).toBe("Cooperative assurance: available")
  })

  it("names the platform and the consequence where it is not built", async () => {
    vi.resetModules()
    vi.doMock("../src/io/native-project-read.js", async () => {
      const actual = await vi.importActual<typeof import("../src/io/native-project-read.js")>(
        "../src/io/native-project-read.js",
      )
      return { ...actual, nativeProjectReadPlatformSupported: () => false }
    })
    const { runPersonaCli: run } = await import("../src/cli/index.js")

    const line = assuranceLine(run(["doctor"], { cwd: ".", env: {}, invocationName: "ph" }).stdout)

    expect(line).toContain("unavailable")
    // The platform, so the reader knows it is about their machine, and the
    // consequence, so they do not read it as an optional feature.
    expect(line).toContain(process.platform)
    expect(line).toContain("cannot reach a cooperative PASS")

    vi.doUnmock("../src/io/native-project-read.js")
    vi.resetModules()
  })
})
