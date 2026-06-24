import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { readDoctorSummary } from "../src/cli/doctor.js"

const tempProjects: string[] = []

function createTempProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-doctor-windows-test-"))
  tempProjects.push(projectDir)
  return projectDir
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("ph doctor Windows command detection", () => {
  it("treats npm and OpenCode as present when Windows where output exposes executable shims", () => {
    const projectDir = createTempProject()
    mkdirSync(join(projectDir, ".opencode"), { recursive: true })
    writeFileSync(join(projectDir, ".opencode", "opencode.json"), JSON.stringify({ plugin: ["persona-harness"] }, null, 2))
    const appData = "C:\\Users\\user\\AppData\\Roaming"
    const nodeDir = "C:\\Program Files\\nodejs"
    const npmBinDir = `${appData}\\npm`
    const commandRunner = (command: string, args: readonly string[]): string | undefined => {
      const firstArg = args[0]
      if (command === "npm" && firstArg === "--version") return undefined
      if (command === "npx" && firstArg === "--version") return undefined
      if (command === "opencode" && firstArg === "--version") return undefined
      if (command === `${nodeDir}\\npm.cmd` && firstArg === "--version") return "11.6.0"
      if (command === `${nodeDir}\\npx.cmd` && firstArg === "--version") return "11.6.0"
      if (command === `${npmBinDir}\\opencode.cmd` && firstArg === "--version") return "1.17.9"
      return undefined
    }
    const commandFinder = (command: string): readonly string[] => {
      if (command === "npm") return [`${nodeDir}\\npm`, `${nodeDir}\\npm.cmd`, `${npmBinDir}\\npm`, `${npmBinDir}\\npm.cmd`]
      if (command === "npx") return [`${nodeDir}\\npx`, `${nodeDir}\\npx.cmd`, `${npmBinDir}\\npx`, `${npmBinDir}\\npx.cmd`]
      if (command === "opencode") return [`${npmBinDir}\\opencode`, `${npmBinDir}\\opencode.cmd`]
      return []
    }

    const summary = readDoctorSummary({
      commandFinder,
      commandRunner,
      env: {
        APPDATA: appData,
        PATH: `${nodeDir};${npmBinDir}`,
        PATHEXT: ".COM;.EXE;.BAT;.CMD;.PS1",
        PH_DOCTOR_REGISTRY_DIST_TAGS: JSON.stringify({ alpha: "0.3.8-alpha.2", latest: "0.3.8-alpha.2" }),
        USERPROFILE: "C:\\Users\\user",
      },
      platform: "win32",
      projectDir,
    })

    expect(summary.npm).toBe("11.6.0")
    expect(summary.npx).toBe("11.6.0")
    expect(summary.opencode).toBe("1.17.9")
    expect(summary.opencodeConfig).toBe("present")
    expect(summary.pluginPath).toBe("configured")
    expect(summary.runtimeReadiness).toBe("PASS")
    expect(summary.runtimeFindings).toEqual([])
  })
})
