#!/usr/bin/env node
// Pins the Windows behaviour fixed in #214, #215, and #216.
//
// Each assertion below failed on Windows before its fix, and the failure was
// silent in CI because nothing ran there. This reproduces the user path — a
// packed tarball, a fresh project, the documented commands — rather than the
// repository's own test harness, because that is where the defects were.
//
// Usage: node .github/scripts/windows-platform-smoke.mjs <tarball-directory>

import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import process from "node:process"

const failures = []
const notes = []

function record(ok, label, detail) {
  notes.push(`${ok ? "PASS" : "FAIL"}  ${label}${detail === undefined ? "" : ` — ${detail}`}`)
  if (!ok) {
    failures.push(label)
  }
}

function tarballIn(directory) {
  const packed = readdirSync(directory).filter((name) => name.startsWith("persona-harness-") && name.endsWith(".tgz"))
  if (packed.length !== 1) {
    throw new Error(`expected exactly one packed tarball in ${directory}, found ${packed.length}`)
  }
  return join(directory, packed[0])
}

function ph(projectDir, args) {
  try {
    const stdout = execFileSync(process.execPath, [join(projectDir, "node_modules", "persona-harness", "dist", "cli", "index.js"), ...args], {
      cwd: projectDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
    return { status: 0, output: stdout }
  } catch (error) {
    return {
      status: typeof error.status === "number" ? error.status : 1,
      output: `${error.stdout ?? ""}${error.stderr ?? ""}`,
    }
  }
}

const tarball = tarballIn(resolve(process.argv[2] ?? tmpdir()))
const projectDir = mkdtempSync(join(tmpdir(), "ph-windows-smoke-"))

writeFileSync(join(projectDir, "package.json"), `${JSON.stringify({ name: "windows-smoke", private: true }, null, 2)}\n`)
const javaDir = join(projectDir, "src", "main", "java", "com", "example")
mkdirSync(javaDir, { recursive: true })
writeFileSync(join(javaDir, "TaskService.java"), "package com.example;\npublic class TaskService { }\n")

execFileSync("npm", ["install", "--no-audit", "--no-fund", "-D", tarball], {
  cwd: projectDir,
  encoding: "utf8",
  shell: true,
  stdio: "ignore",
})

const installed = JSON.parse(
  readFileSync(join(projectDir, "node_modules", "persona-harness", "package.json"), "utf8"),
)
notes.push(`host    ${process.platform}/${process.arch}, node ${process.version}, persona-harness ${installed.version}`)

record(ph(projectDir, ["init"]).status === 0, "ph init")
record(ph(projectDir, ["bootstrap", "backend"]).status === 0, "ph bootstrap backend")

// #216 — the platform scope has to be stated before a user does the work, not
// discovered at the final step of the rail.
const doctor = ph(projectDir, ["doctor"]).output
const assurance = doctor.split("\n").find((line) => line.startsWith("Cooperative assurance:"))?.trim() ?? ""
record(assurance !== "", "doctor states cooperative assurance", assurance || "line missing")
record(
  assurance.includes("unavailable") && assurance.includes("win32"),
  "doctor names this platform as unable to reach a cooperative PASS",
  assurance,
)

// #215 — this is the only producer of the `fileRole` evidence that
// `java-role-read-coverage` accepts, and it returned "Evidence read
// unavailable." on Windows because it reserved a native project read boundary.
const read = ph(projectDir, ["evidence", "read", "src/main/java/com/example/TaskService.java"])
record(read.status === 0, "ph evidence read records a read", read.output.trim().split("\n")[0])

// #214 — `workflow finish` died before evaluating a single blocker.
const finish = ph(projectDir, ["workflow", "finish", "implement"])
record(
  !finish.output.includes("source-read-runtime-unavailable"),
  "workflow finish reaches blocker evaluation",
  finish.output.includes("source-read-runtime-unavailable") ? "still blocked on the runtime" : undefined,
)
record(finish.status !== 0, "workflow finish still blocks without attestation", `exit ${finish.status}`)
record(
  finish.output.includes("Source-read snapshot unavailable"),
  "workflow finish names the missing snapshot boundary",
)

// The default assurance is `external` (`src/cli/workflow-args.ts:186`), so
// everything above exercises the external path only — and the cooperative path
// is the one Windows cannot complete. That gap is why #235 went unseen here
// while this job stayed green.
//
// `prepareCooperativeFinishContext` re-reserves the boundary the unsupported
// platform branch skipped, so this is expected to block on Windows today. What
// must not regress is the *honesty* of that block: it may not report a
// verification that never ran.
const cooperative = ph(projectDir, ["workflow", "finish", "implement", "--assurance", "cooperative"])
record(cooperative.status !== 0, "cooperative finish blocks on this platform", `exit ${cooperative.status}`)
record(
  !cooperative.output.includes("Cooperative verification ran without the snapshot boundary"),
  "cooperative finish does not claim a verification it never ran",
)

console.log(notes.join("\n"))
if (failures.length > 0) {
  console.error(`\n${failures.length} Windows platform expectation(s) failed:\n- ${failures.join("\n- ")}`)
  process.exit(1)
}
console.log("\nAll Windows platform expectations hold.")
