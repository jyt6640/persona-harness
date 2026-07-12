import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

import type { CliRunResult } from "./bearshell.js"
import {
  managedBackendAgentInstructions,
  repairManagedBackendAgentInstructions,
} from "./agents-contract.js"
import { inferAttachProfile } from "./attach-profile.js"
import { existingAttachmentState } from "./attach-installation-state.js"
import { copyAttachContext, enableAttachEnforcement } from "./attach-staging.js"
import { commitAttachTree } from "./attach-transaction.js"
import {
  attachBlocked,
  attachUsage,
  parseAttachArgs,
} from "./attach-command-contract.js"
import { runBootstrapCommand } from "./bootstrap.js"
import { runInstructionsCommand } from "./instructions-infer.js"

type AttachOptions = {
  readonly onAfterCommitFile?: (relativePath: string) => void
  readonly packageRoot?: string
  readonly projectDir?: string
}

function writeManagedAgents(stagingDir: string): void {
  writeFileSync(join(stagingDir, "AGENTS.md"), managedBackendAgentInstructions())
}

function runFreshAttach(projectDir: string, options: AttachOptions): CliRunResult {
  if (existsSync(join(projectDir, ".persona")) || existsSync(join(projectDir, "AGENTS.md"))) {
    const state = existingAttachmentState(projectDir)
    if (state === "ready") {
      return {
        status: 0,
        stdout: [
          "Persona Harness is already prepared and ready.",
          "No attachment files were changed.",
          "Next action: Submit one concrete implementation goal.",
          "Next command: npx ph go \"<goal>\"",
          "",
        ].join("\n"),
        stderr: "",
      }
    }
    if (state === "weak") {
      return attachBlocked(
        "a recognized Persona Harness installation already exists.",
        "Use the explicit repair path to strengthen the recognized installation.",
        "npx ph attach --repair --yes",
      )
    }
    return attachBlocked(
      "existing AGENTS.md is not a recognized Persona Harness installation or .persona already exists.",
      "Review the existing files and resolve the attachment conflict without overwriting user content.",
      "npx ph doctor",
    )
  }

  const draft = inferAttachProfile(projectDir)
  if (draft.unresolved.length > 0) {
    return attachBlocked(
      `the inferred draft has unresolved fields: ${draft.unresolved.join(", ")}.`,
      "Add or identify the Java/Spring/Gradle project structure, then retry attach.",
      "npx ph attach --yes",
    )
  }
  const packageRoot = resolve(
    options.packageRoot
      ?? join(fileURLToPath(new URL(".", import.meta.url)), "..", ".."),
  )
  const stagingDir = mkdtempSync(join(tmpdir(), "persona-attach-stage-"))
  try {
    copyAttachContext(projectDir, stagingDir)
    const bootstrap = runBootstrapCommand(
      ["backend"],
      { projectDir: stagingDir, packageRoot },
      "ph",
    )
    if (bootstrap.status !== 0) {
      return attachBlocked(
        bootstrap.stderr.trim() || "staging bootstrap failed.",
        "Resolve the reported project configuration problem, then retry attach.",
        "npx ph attach --yes",
      )
    }
    const inference = runInstructionsCommand(["infer", "backend"], { projectDir: stagingDir }, "ph")
    if (inference.status !== 0) {
      return attachBlocked(
        inference.stderr.trim() || "instruction inference failed.",
        "Resolve the reported project inference problem, then retry attach.",
        "npx ph attach --yes",
      )
    }
    enableAttachEnforcement(stagingDir)
    writeManagedAgents(stagingDir)
    commitAttachTree(
      projectDir,
      stagingDir,
      [".gitignore", ".opencode/opencode.json", ".persona", "AGENTS.md"],
      { onAfterCommitFile: options.onAfterCommitFile },
    )
    return {
      status: 0,
      stdout: [
        "Persona Harness Attach complete.",
        `Inferred stack: ${draft.inferredStack}`,
        `Project: ${draft.projectName ?? "unresolved name"}`,
        "Enforcement: PH-run verification ON; measured-negative runtime features remain OFF.",
        "Next action: Submit one concrete implementation goal.",
        "Next command: npx ph go \"<goal>\"",
        "",
      ].join("\n"),
      stderr: "",
    }
  } catch (error) {
    return attachBlocked(
      `Attach transaction failed: ${error instanceof Error ? error.message : String(error)}`,
      "Inspect the conflict; the invocation-owned changes were rolled back.",
      "npx ph attach --yes",
    )
  } finally {
    rmSync(stagingDir, { recursive: true, force: true })
  }
}

function runRepair(projectDir: string, options: AttachOptions): CliRunResult {
  const state = existingAttachmentState(projectDir)
  if (state === "ready") {
    return attachBlocked(
      "the installation is already prepared with strong enforcement.",
      "Continue with the prepared workflow; repair is not applicable.",
      "npx ph doctor",
    )
  }
  if (state === "unrecognized") {
    return attachBlocked(
      "the existing files are corrupt, unrecognized, or not a complete weak Persona Harness installation.",
      "Review the existing installation without overwriting user-authored files.",
      "npx ph doctor",
    )
  }
  const stagingDir = mkdtempSync(join(tmpdir(), "persona-attach-repair-"))
  try {
    copyAttachContext(projectDir, stagingDir)
    cpSync(join(projectDir, ".persona"), join(stagingDir, ".persona"), { recursive: true })
    const bootstrap = runBootstrapCommand(
      ["backend"],
      { projectDir: stagingDir, packageRoot: options.packageRoot },
      "ph",
    )
    if (bootstrap.status !== 0) {
      return attachBlocked(
        bootstrap.stderr.trim() || "staging repair failed.",
        "Resolve the reported project configuration problem, then retry repair.",
        "npx ph attach --repair --yes",
      )
    }
    const inference = runInstructionsCommand(["infer", "backend"], { projectDir: stagingDir }, "ph")
    if (inference.status !== 0) {
      return attachBlocked(
        inference.stderr.trim() || "instruction inference failed.",
        "Resolve the reported project inference problem, then retry repair.",
        "npx ph attach --repair --yes",
      )
    }
    enableAttachEnforcement(stagingDir)
    const agentsPath = join(projectDir, "AGENTS.md")
    writeFileSync(join(stagingDir, "AGENTS.md"), existsSync(agentsPath)
      ? repairManagedBackendAgentInstructions(readFileSync(agentsPath, "utf8"))
      : managedBackendAgentInstructions())
    commitAttachTree(projectDir, stagingDir, [".gitignore", ".opencode/opencode.json", ".persona", "AGENTS.md"], {
      onAfterCommitFile: options.onAfterCommitFile,
    })
    return {
      status: 0,
      stdout: [
        "Persona Harness Attach repair complete.",
        "Enforcement: PH-run verification ON; measured-negative runtime features remain OFF.",
        "Next action: Confirm the repaired project is ready.",
        "Next command: npx ph doctor",
        "",
      ].join("\n"),
      stderr: "",
    }
  } catch (error) {
    return attachBlocked(
      `Attach transaction failed: ${error instanceof Error ? error.message : String(error)}`,
      "Inspect the conflict; the invocation-owned changes were rolled back.",
      "npx ph attach --repair --yes",
    )
  } finally {
    rmSync(stagingDir, { recursive: true, force: true })
  }
}

export function runAttachCommand(
  args: readonly string[],
  options: AttachOptions = {},
  invocationName = "ph",
): CliRunResult {
  const parsed = parseAttachArgs(args)
  if (parsed.kind === "help") {
    return { status: 0, stdout: `${attachUsage(invocationName)}\n`, stderr: "" }
  }
  if (parsed.kind === "invalid") {
    return { status: 1, stdout: "", stderr: `${parsed.message}\n\n${attachUsage(invocationName)}\n` }
  }
  const projectDir = resolve(options.projectDir ?? process.cwd())
  const draft = inferAttachProfile(projectDir)
  if (!parsed.yes) {
    return attachBlocked(
      `confirmation is required.\nInferred stack: ${draft.inferredStack}\nUnresolved fields: ${draft.unresolved.length === 0 ? "none" : draft.unresolved.join(", ")}`,
      "Review the inferred draft and accept it when correct.",
      "npx ph attach --yes",
    )
  }
  return parsed.repair ? runRepair(projectDir, options) : runFreshAttach(projectDir, options)
}
