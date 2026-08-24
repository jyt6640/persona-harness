import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"

const temporaryRoots: string[] = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true })
  }
})

describe("owner dogfooding feedback", () => {
  it("describes the explicit override as a private state directory", () => {
    const result = runFeedback(["dogfood", "--help"], {})

    expect(result).toMatchObject({ status: 0, stderr: "" })
    expect(result.stdout).toContain("Override root only with an absolute PH_OWNER_DOGFOOD_FEEDBACK_ROOT directory.")
    expect(result.stdout).toContain("events.jsonl is appended inside that directory.")
  })

  it("appends bounded diagnostic-only events to the explicit private root", () => {
    const root = temporaryRoot("persona-owner-dogfood-feedback-")
    const first = runFeedback(["dogfood", "source-read-runtime-unavailable"], {
      PH_OWNER_DOGFOOD_FEEDBACK_ROOT: root,
    })
    const second = runFeedback(["dogfood", "workflow-history-missing"], {
      PH_OWNER_DOGFOOD_FEEDBACK_ROOT: root,
    })

    expect(first).toMatchObject({ status: 0, stderr: "" })
    expect(second).toMatchObject({ status: 0, stderr: "" })
    expect(first.stdout).toBe("Owner dogfooding feedback recorded. Diagnostic-only.\n")
    expect(first.stdout).not.toContain(root)

    const eventPath = join(root, "events.jsonl")
    const events = readFileSync(eventPath, "utf8").trim().split("\n").map((line) => JSON.parse(line))
    expect(events).toHaveLength(2)
    expect(events).toMatchObject([
      { code: "source-read-runtime-unavailable", schemaVersion: "owner-dogfood-feedback.1" },
      { code: "workflow-history-missing", schemaVersion: "owner-dogfood-feedback.1" },
    ])
    expect(events.every((event) => typeof event.recordedAt === "string" && Object.keys(event).length === 3)).toBe(true)
    expect(readFileSync(eventPath, "utf8")).not.toContain(process.cwd())
    expect(existsSync(join(root, ".events.lock"))).toBe(false)
  })

  it("uses the documented default state root when no explicit override is set", () => {
    const home = temporaryRoot("persona-owner-dogfood-home-")
    const result = runFeedback(["dogfood", "project-philosophy-not-injected"], { HOME: home })
    const eventPath = join(home, ".local", "state", "persona-harness", "owner-dogfood-feedback", "events.jsonl")

    expect(result.status).toBe(0)
    expect(existsSync(eventPath)).toBe(true)
    expect(JSON.parse(readFileSync(eventPath, "utf8"))).toMatchObject({
      code: "project-philosophy-not-injected",
      schemaVersion: "owner-dogfood-feedback.1",
    })
  })

  it("fails closed without writing for invalid input or an unsafe override", () => {
    const home = temporaryRoot("persona-owner-dogfood-invalid-")
    const secretLikeCode = "ghp_not-a-feedback-code"
    const invalidCode = runFeedback(["dogfood", secretLikeCode], {
      HOME: home,
      PH_OWNER_DOGFOOD_FEEDBACK_ROOT: join(home, "events"),
    })
    const relativeOverride = runFeedback(["dogfood", "workflow-history-missing"], {
      HOME: home,
      PH_OWNER_DOGFOOD_FEEDBACK_ROOT: "relative-owner-feedback-root",
    })

    expect(invalidCode.status).toBe(1)
    expect(`${invalidCode.stdout}${invalidCode.stderr}`).not.toContain(secretLikeCode)
    expect(relativeOverride.status).toBe(1)
    expect(existsSync(join(home, "events", "events.jsonl"))).toBe(false)
    expect(existsSync(join(home, ".local", "state", "persona-harness", "owner-dogfood-feedback", "events.jsonl"))).toBe(false)
  })

  it("does not follow event-file symlinks or append to malformed prior state", () => {
    const root = temporaryRoot("persona-owner-dogfood-unsafe-")
    const outside = join(root, "outside.jsonl")
    const eventPath = join(root, "events.jsonl")
    writeFileSync(outside, "outside\n")
    symlinkSync(outside, eventPath)

    const symlinked = runFeedback(["dogfood", "shared-skill-routing-unavailable"], {
      PH_OWNER_DOGFOOD_FEEDBACK_ROOT: root,
    })
    expect(symlinked.status).toBe(1)
    expect(readFileSync(outside, "utf8")).toBe("outside\n")

    rmSync(eventPath)
    writeFileSync(eventPath, "not-json\n")
    const malformed = runFeedback(["dogfood", "shared-skill-routing-unavailable"], {
      PH_OWNER_DOGFOOD_FEEDBACK_ROOT: root,
    })
    expect(malformed.status).toBe(1)
    expect(readFileSync(eventPath, "utf8")).toBe("not-json\n")
  })

  it("does not follow a configured state-root symlink", () => {
    const parent = temporaryRoot("persona-owner-dogfood-root-symlink-")
    const outside = temporaryRoot("persona-owner-dogfood-root-outside-")
    const unsafeRoot = join(parent, "unsafe-root")
    symlinkSync(outside, unsafeRoot, "dir")

    const result = runFeedback(["dogfood", "unnecessary-interview"], {
      PH_OWNER_DOGFOOD_FEEDBACK_ROOT: unsafeRoot,
    })

    expect(result.status).toBe(1)
    expect(existsSync(join(outside, "events.jsonl"))).toBe(false)
  })

  it("does not follow configured state-root ancestors", () => {
    const parent = temporaryRoot("persona-owner-dogfood-ancestor-symlink-")
    const outside = temporaryRoot("persona-owner-dogfood-ancestor-outside-")
    const linkedAncestor = join(parent, "linked")
    symlinkSync(outside, linkedAncestor, "dir")

    const result = runFeedback(["dogfood", "unnecessary-interview"], {
      PH_OWNER_DOGFOOD_FEEDBACK_ROOT: join(linkedAncestor, "feedback"),
    })

    expect(result.status).toBe(1)
    expect(existsSync(join(outside, "feedback", "events.jsonl"))).toBe(false)
  })

  it("does not append beyond the bounded event limit", () => {
    const root = temporaryRoot("persona-owner-dogfood-event-limit-")
    const eventPath = join(root, "events.jsonl")
    const event = `${JSON.stringify({
      code: "workflow-history-missing",
      recordedAt: "2026-08-24T00:00:00.000Z",
      schemaVersion: "owner-dogfood-feedback.1",
    })}\n`
    const existing = event.repeat(512)
    writeFileSync(eventPath, existing)
    chmodSync(eventPath, 0o600)

    const result = runFeedback(["dogfood", "unnecessary-interview"], {
      PH_OWNER_DOGFOOD_FEEDBACK_ROOT: root,
    })

    expect(result.status).toBe(1)
    expect(readFileSync(eventPath, "utf8")).toBe(existing)
  })

  it("fails closed while another event writer owns the private lock", () => {
    const root = temporaryRoot("persona-owner-dogfood-lock-")
    writeFileSync(join(root, ".events.lock"), "")
    chmodSync(join(root, ".events.lock"), 0o600)

    const result = runFeedback(["dogfood", "unnecessary-interview"], {
      PH_OWNER_DOGFOOD_FEEDBACK_ROOT: root,
    })

    expect(result.status).toBe(1)
    expect(existsSync(join(root, "events.jsonl"))).toBe(false)
  })

  it("fails closed when the default home is relative", () => {
    const relativeHome = "persona-owner-dogfood-relative-home"
    const escapedRoot = join(process.cwd(), relativeHome)
    temporaryRoots.push(escapedRoot)

    const result = runFeedback(["dogfood", "unnecessary-interview"], { HOME: relativeHome })

    expect(result.status).toBe(1)
    expect(existsSync(join(escapedRoot, ".local", "state", "persona-harness", "owner-dogfood-feedback", "events.jsonl"))).toBe(false)
  })

  it("creates private regular state files and does not create project workflow feedback", () => {
    const root = temporaryRoot("persona-owner-dogfood-private-")
    const project = temporaryRoot("persona-owner-dogfood-project-")
    const result = runPersonaCli(["feedback", "dogfood", "interview-repeated-question"], {
      cwd: project,
      env: { PH_OWNER_DOGFOOD_FEEDBACK_ROOT: root },
      invocationName: "ph",
    })

    expect(result.status).toBe(0)
    expect(lstatSync(root).isDirectory()).toBe(true)
    expect(lstatSync(join(root, "events.jsonl")).isFile()).toBe(true)
    if (process.platform !== "win32") {
      expect(lstatSync(root).mode & 0o777).toBe(0o700)
      expect(lstatSync(join(root, "events.jsonl")).mode & 0o777).toBe(0o600)
    }
    expect(existsSync(join(project, ".persona", "workflow", "feedback-report.md"))).toBe(false)
  })
})

function runFeedback(args: readonly string[], env: Readonly<Record<string, string>>): ReturnType<typeof runPersonaCli> {
  return runPersonaCli(["feedback", ...args], { cwd: temporaryRoot("persona-owner-dogfood-project-"), env, invocationName: "ph" })
}

function temporaryRoot(prefix: string): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), prefix)))
  temporaryRoots.push(root)
  return root
}
