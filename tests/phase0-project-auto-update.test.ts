import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import type { Event } from "@opencode-ai/sdk"
import { afterEach, describe, expect, it } from "vitest"

import { createPhase0Hooks } from "../src/runtime/hooks.js"

const projects: string[] = []

function createProject(enabled: boolean): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-project-auto-update-runtime-"))
  projects.push(projectDir)
  mkdirSync(join(projectDir, ".persona", "rules"), { recursive: true })
  writeFileSync(
    join(projectDir, ".persona", "harness.jsonc"),
    `${JSON.stringify({ enabled, features: { runtimeInjection: false } }, null, 2)}\n`,
  )
  return projectDir
}

function sessionCreated(projectDir: string, sessionID: string): Event {
  return {
    properties: {
      info: {
        directory: projectDir,
        id: sessionID,
        projectID: "project",
        time: { created: 1, updated: 1 },
        title: sessionID,
        version: "1",
      },
    },
    type: "session.created",
  }
}

afterEach(() => {
  for (const projectDir of projects.splice(0)) {
    rmSync(projectDir, { force: true, recursive: true })
  }
})

describe("project auto-update runtime", () => {
  it("schedules one next-session update check when explicitly enabled, even with runtime injection off", async () => {
    const projectDir = createProject(false)
    const scheduled: string[] = []
    const hooks = createPhase0Hooks({
      projectAutoUpdate: {
        enabled: true,
        scheduler: { schedule: (candidateProjectDir) => scheduled.push(candidateProjectDir) },
      },
      projectDir,
    })

    await hooks.event?.({ event: sessionCreated(projectDir, "session-auto-update") })

    expect(scheduled).toEqual([projectDir])
  })

  it("does not schedule a registry check unless the plugin option explicitly enables it", async () => {
    const projectDir = createProject(true)
    const scheduled: string[] = []
    const hooks = createPhase0Hooks({
      projectAutoUpdate: {
        enabled: false,
        scheduler: { schedule: (candidateProjectDir) => scheduled.push(candidateProjectDir) },
      },
      projectDir,
    })

    await hooks.event?.({ event: sessionCreated(projectDir, "session-no-auto-update") })

    expect(scheduled).toEqual([])
  })
})
