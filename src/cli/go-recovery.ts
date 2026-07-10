import type { CliRunResult } from "./bearshell.js"
import { recoverGoCommandLock } from "./go-lock.js"
import { goBlockedOutput } from "./go-preflight.js"

export function goLockBlocker(kind: "active" | "recoverable" | "recovery-claim" | "unsafe"): CliRunResult {
  if (kind === "active") {
    return goBlockedOutput("another ph go command is already running.", "npx ph workflow check")
  }
  if (kind === "unsafe") {
    return goBlockedOutput("the go lock path is not a regular file.", "npx ph workflow check")
  }
  return goBlockedOutput(
    kind === "recoverable" ? "a stale or malformed go lock requires recovery." : "a go lock recovery is already in progress.",
    "npx ph go --recover",
  )
}

export function runGoRecovery(projectDir: string, onBeforeClear: (() => void) | undefined): CliRunResult {
  const result = recoverGoCommandLock(projectDir, { onBeforeClear })
  if (result.kind === "recovered") {
    return { status: 0, stdout: "Persona Harness Go recovery: recovered stale lock.\n", stderr: "" }
  }
  if (result.kind === "missing") {
    return { status: 0, stdout: "Persona Harness Go recovery: no lock requires recovery.\n", stderr: "" }
  }
  if (result.kind === "active" || result.kind === "unsafe") {
    return goBlockedOutput(
      result.kind === "active" ? "another ph go command is active." : "the go lock path is not a regular file.",
      "npx ph workflow check",
    )
  }
  return goBlockedOutput(
    result.kind === "changed" ? "the go lock changed during recovery." : "another go lock recovery is in progress.",
    "npx ph go --recover",
  )
}
