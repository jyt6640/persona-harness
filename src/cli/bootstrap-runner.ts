import { existsSync } from "node:fs"
import { join, resolve } from "node:path"
import process from "node:process"

import { loadHarnessConfig } from "../config/harness-config.js"
import { readBackendProjectProfileState } from "../config/project-profile.js"
import {
  BootstrapWriteBoundaryError,
  type BootstrapWriteBoundary,
} from "../io/bootstrap-write-boundary.js"
import type { CliRunResult } from "./bearshell.js"
import { enableAttachEnforcement } from "./bootstrap-attach-enforcement.js"
import {
  finalizeBootstrapInitOwnership,
  prepareBootstrapInitOwnership,
  type BootstrapInitOwnershipChanges,
} from "./bootstrap-init-ownership.js"
import { enableCodeNavMcpPreview } from "./bootstrap-code-nav.js"
import { enableDeveloperMcpBundle } from "./bootstrap-codegraph.js"
import {
  PERSONA_DIR,
  POLICY_OVERLAY_PATH,
  type BackendBootstrapFlags,
  type BootstrapOptions,
} from "./bootstrap-contract.js"
import { enableLspMcpPreview } from "./bootstrap-lsp.js"
import { enableMultiAgentPreview } from "./bootstrap-multi-agent.js"
import { backendBootstrapSuccess } from "./bootstrap-output.js"
import {
  bootstrapWriteBoundaryFailure,
  initializeWorkflowLifecycleStates,
  reserveBootstrapWriteBoundaryFor,
  runAndRecord,
  writeBackendAgentInstructions,
} from "./bootstrap-support.js"
import { enableRuntimeInjectionPreview, enableStrictClosureVerification } from "./bootstrap-strict.js"
import { PROFILE_PATH } from "./intake-profile.js"
import { initializeFreshBootstrapPersonaHarness, initializePersonaHarness, runInitCommand } from "./init.js"
import { InitManifestError, readInitManifest } from "./init-manifest.js"
import { runIntakeCommand } from "./intake.js"
import { PLAN_PATH, restoreMissingWorkflowTemplates } from "./plan.js"
import { runPlanCommand } from "./plan-command.js"
import { runPolicyCommand } from "./policy.js"

export function runBackendBootstrap(
  options: BootstrapOptions,
  flags: BackendBootstrapFlags,
): CliRunResult {
  const projectDir = resolve(options.projectDir ?? process.cwd())
  const actions: string[] = []
  const skipped: string[] = []
  let bootstrapWriteBoundary: BootstrapWriteBoundary | undefined
  try {
    if (!existsSync(join(projectDir, PERSONA_DIR))) {
      const initialized = initializeFreshBootstrapPersonaHarness({ projectDir, packageRoot: options.packageRoot })
      bootstrapWriteBoundary = initialized.boundary
      actions.push("initialized .persona, portable host skill adapters, and OpenCode plugin config")
    } else {
      if (readInitManifest(projectDir) === null) {
        initializePersonaHarness({
          bootstrapPersonaState: options.attachStagingOwnership?.kind === "repair"
            ? { kind: "preinitialized", manifestProjectRealPath: options.attachStagingOwnership.projectRealPath }
            : { kind: "preinitialized" },
          packageRoot: options.packageRoot,
          projectDir,
        })
        actions.push("initialized PH-owned files around existing Persona state")
      } else if (options.attachStagingOwnership?.kind !== "repair") {
        const preflight = runInitCommand(["--dry-run"], {
          packageRoot: options.packageRoot,
          projectDir,
        })
        if (preflight.status !== 0) return bootstrapWriteBoundaryFailure()
      }
      skipped.push(".persona already exists")
      bootstrapWriteBoundary = reserveBootstrapWriteBoundaryFor(projectDir)
    }
  } catch {
    return bootstrapWriteBoundaryFailure()
  }
  if (bootstrapWriteBoundary === undefined) return bootstrapWriteBoundaryFailure()

  const activeBoundary = bootstrapWriteBoundary
  try {
    return activeBoundary.withCapturedProject(() => {
      const capturedProjectDir = "."
      const profileState = readBackendProjectProfileState(capturedProjectDir, activeBoundary)
      const ownershipChanges: BootstrapInitOwnershipChanges = {
        harness: options.attachStagingOwnership !== undefined
          || flags.strict
          || flags.runtimeInjectionPreview
          || flags.multiAgentPreview,
        openCode: flags.developerMcpEnabled || flags.codeNavPreview || flags.lspPreview || flags.multiAgentPreview,
        profile: flags.force || profileState.status !== "ready",
      }
      const ownershipContext = options.attachStagingOwnership === undefined
        ? { kind: "current-project" } as const
        : options.attachStagingOwnership.kind === "fresh"
          ? { kind: "attach-fresh-staging", projectRealPath: options.attachStagingOwnership.projectRealPath } as const
          : { kind: "attach-repair-staging", projectRealPath: options.attachStagingOwnership.projectRealPath } as const
      const initOwnership = prepareBootstrapInitOwnership(
        activeBoundary,
        ownershipChanges,
        ownershipContext,
      )
      if (flags.strict) {
        const failure = enableStrictClosureVerification(capturedProjectDir, activeBoundary)
        if (failure !== undefined) return failure
        actions.push("enabled strict closure verification")
      }
      if (flags.runtimeInjectionPreview) {
        const failure = enableRuntimeInjectionPreview(capturedProjectDir, activeBoundary)
        if (failure !== undefined) return failure
        actions.push("enabled runtime injection preview")
      }
      if (flags.multiAgentPreview) {
        const failure = enableMultiAgentPreview(
          capturedProjectDir,
          loadHarnessConfig(capturedProjectDir, activeBoundary).multiAgent,
          activeBoundary,
        )
        if (failure !== undefined) return failure
        actions.push("enabled Role Checklist Relay preview for test-writer, implementer, and reviewer")
      }
      if (flags.codeNavPreview) {
        const failure = enableCodeNavMcpPreview(capturedProjectDir, options.packageRoot, activeBoundary)
        if (failure !== undefined) return failure
        actions.push("enabled code-nav MCP preview")
      }
      if (flags.lspPreview) {
        const failure = enableLspMcpPreview(capturedProjectDir, options.packageRoot, activeBoundary)
        if (failure !== undefined) return failure
        actions.push("enabled LSP MCP preview")
      }
      if (flags.developerMcpEnabled) {
        const result = enableDeveloperMcpBundle(capturedProjectDir, {
          bootstrapWriteBoundary: activeBoundary,
          codeGraphEnabled: flags.codeGraphEnabled,
          packageRoot: options.packageRoot,
        })
        if (result.kind === "failure") return result.result
        actions.push(flags.codeGraphEnabled
          ? "registered developer MCP bundle for OpenCode"
          : "registered developer MCP bundle for OpenCode without CodeGraph")
      } else {
        skipped.push("developer MCP bundle disabled by --no-developer-mcp")
      }
      if (options.attachStagingOwnership !== undefined) {
        enableAttachEnforcement(activeBoundary)
        actions.push("enabled attach verification enforcement")
      }

      if (ownershipChanges.profile) {
        const result = runIntakeCommand(
          ["--default", "backend", "--force"],
          { bootstrapWriteBoundary: activeBoundary, projectDir: capturedProjectDir },
          "ph",
        )
        const failure = runAndRecord(actions, "profile", result, "created default backend profile")
        if (failure !== undefined) return failure
      } else {
        skipped.push(`${PROFILE_PATH} already ready`)
      }

      if (flags.force || !activeBoundary.projectFileExists(POLICY_OVERLAY_PATH)) {
        const result = runPolicyCommand(
          flags.force ? ["init", "--force"] : ["init"],
          { bootstrapWriteBoundary: activeBoundary, projectDir: capturedProjectDir },
          "ph",
        )
        const failure = runAndRecord(actions, "policy", result, "created backend policy overlay")
        if (failure !== undefined) return failure
      } else {
        skipped.push(`${POLICY_OVERLAY_PATH} already exists`)
      }

      if (flags.force || !activeBoundary.projectFileExists(PLAN_PATH)) {
        const result = runPlanCommand(
          ["--auto-accept"],
          { bootstrapWriteBoundary: activeBoundary, projectDir: capturedProjectDir },
          "ph",
        )
        const failure = runAndRecord(actions, "plan", result, "created and accepted backend workflow plan")
        if (failure !== undefined) return failure
      } else {
        skipped.push(`${PLAN_PATH} already exists`)
        const restored = restoreMissingWorkflowTemplates({
          bootstrapWriteBoundary: activeBoundary,
          projectDir: capturedProjectDir,
        })
        for (const path of restored) actions.push(`restored missing workflow template ${path}`)
      }

      activeBoundary.assert()
      const lifecycleFailure = initializeWorkflowLifecycleStates(capturedProjectDir, actions)
      if (lifecycleFailure !== undefined) return lifecycleFailure
      activeBoundary.assert()

      const agentInstructionAction = writeBackendAgentInstructions(
        activeBoundary,
        skipped,
        flags.force,
        flags.multiAgentPreview,
      )
      if (agentInstructionAction !== undefined) actions.push(agentInstructionAction)
      finalizeBootstrapInitOwnership(activeBoundary, initOwnership, ownershipChanges, ownershipContext)

      return backendBootstrapSuccess(flags, actions, skipped)
    })
  } catch (error) {
    if (error instanceof BootstrapWriteBoundaryError || error instanceof InitManifestError) {
      return bootstrapWriteBoundaryFailure()
    }
    throw error
  } finally {
    activeBoundary.close()
  }
}
