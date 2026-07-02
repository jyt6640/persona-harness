import type { Hooks } from "@opencode-ai/plugin"

import { writePhase0Evidence } from "./evidence.js"
import { ContinuationTracker } from "./continuation.js"
import { isBackendBootstrapTargetFile, isJavaTargetFile } from "./file-role.js"
import { isRuntimeInjectionEnabled, loadHarnessConfig } from "../config/harness-config.js"
import { createInjectionBlock } from "./injection.js"
import { IdleContinuationTracker } from "./idle-continuation.js"
import type { IdleContinuationClient } from "./idle-continuation.js"
import { maybeInjectIntentWorkflow } from "./intent-workflow.js"
import { injectSystemConstitution } from "./system-constitution.js"
import { TokenCompactionTracker } from "./token-compaction.js"
import type { TokenCompactionClient } from "./token-compaction.js"
import { TokenTelemetryRecorder } from "./token-telemetry.js"
import {
  createJavaRoleReadFollowUp,
  discoverJavaRoleInjections,
  formatJavaRoleDiscoveryBlock,
} from "./java-role-discovery.js"
import { warnRuntimeFailure } from "./error-boundary.js"
import { injectIntoLatestUserMessage } from "./messages.js"
import { observeJavaWriteReportOnly } from "./observer-report-only.js"
import { RailComplianceTracker } from "./rail-compliance.js"
import { RuntimeSessionRegistry } from "./session-registry.js"
import type { RuntimeInjectionSurface } from "./session-registry.js"
import { PendingInjectionStore } from "./store.js"
import { extractTargetFile, isInstalledPersonaHarnessPackageFile } from "./target-file.js"
import { selectSharedSkillsForTarget } from "./shared-skill-router.js"
import { createWriteGuardWarning } from "./write-guard.js"
import type {
  ToolAfterInput,
  ToolAfterOutput,
  ToolBeforeInput,
  ToolBeforeOutput,
  EventInput,
  TextCompleteInput,
  TextCompleteOutput,
  TransformMessagesOutput,
  TransformSystemInput,
  TransformSystemOutput,
} from "./types.js"

type Phase0HookOptions = {
  client?: IdleContinuationClient & TokenCompactionClient
  projectDir?: string
  store?: PendingInjectionStore
}

function appendInjectionToToolOutput(output: ToolAfterOutput, block: string): void {
  if (typeof output.output !== "string" || output.output.includes("[Persona Harness Injection]")) {
    return
  }

  output.output = `${output.output}\n\n---\n\n${block}`
}

function appendJavaRoleDiscoveryToToolOutput(output: ToolAfterOutput, block: string): void {
  if (typeof output.output !== "string" || output.output.includes("[Persona Harness Java Role Discovery]")) {
    return
  }

  output.output = `${output.output}\n\n---\n\n${block}`
}

function appendWriteGuardWarningToToolOutput(output: ToolAfterOutput, block: string): void {
  if (typeof output.output !== "string" || output.output.includes("[Persona Harness Write Guard]")) {
    return
  }

  output.output = `${output.output}\n\n---\n\n${block}`
}

function hasEnabledSharedSkillDomain(enabledDomains: readonly string[], targetFile: string): boolean {
  return selectSharedSkillsForTarget(targetFile).some((skill) => enabledDomains.includes(skill.domain))
}

function runHostHook(hookName: string, operation: () => void): void {
  try {
    operation()
  } catch (error) {
    const scope = `hook.${hookName}`
    if (error instanceof Error) {
      warnRuntimeFailure("hook-boundary", scope, undefined, error)
      return
    }
    warnRuntimeFailure("hook-boundary", scope, undefined, new Error(String(error)))
  }
}

async function runHostHookAsync(hookName: string, operation: () => Promise<void>): Promise<void> {
  try {
    await operation()
  } catch (error) {
    const scope = `hook.${hookName}`
    if (error instanceof Error) {
      warnRuntimeFailure("hook-boundary", scope, undefined, error)
      return
    }
    warnRuntimeFailure("hook-boundary", scope, undefined, new Error(String(error)))
  }
}

export function createPhase0Hooks(options: Phase0HookOptions = {}): Hooks {
  const store = options.store ?? new PendingInjectionStore()
  const compliance = new RailComplianceTracker()
  const continuation = new ContinuationTracker()
  const projectDir = options.projectDir ?? process.cwd()
  const config = loadHarnessConfig(projectDir)
  const runtimeInjectionEnabled = isRuntimeInjectionEnabled(config)
  const idleContinuation = new IdleContinuationTracker({ client: options.client, projectDir })
  const tokenTelemetry = new TokenTelemetryRecorder(projectDir)
  const tokenCompaction = new TokenCompactionTracker({
    client: options.client,
    config: config.enforce.compaction,
    projectDir,
  })
  const sessionRegistry = new RuntimeSessionRegistry({
    multiAgentEnabled: config.multiAgent.enabled,
    projectDir,
    runtimeInjectionEnabled,
  })

  function allowsRuntimeInjection(sessionID: string | undefined, surface: RuntimeInjectionSurface): boolean {
    return sessionRegistry.allowsRuntimeInjection(sessionID, surface)
  }

  function captureTargetFile(
    hook: "tool.execute.before" | "tool.execute.after",
    tool: string,
    sessionID: string,
    callID: string | undefined,
    args: Record<string, unknown>,
  ): ReturnType<typeof createInjectionBlock> | undefined {
    if (!runtimeInjectionEnabled) {
      return undefined
    }
    if (!allowsRuntimeInjection(sessionID, "target-file")) {
      return undefined
    }

    const targetFile = extractTargetFile(tool, args)
    if (!targetFile) {
      return undefined
    }
    if (isInstalledPersonaHarnessPackageFile(targetFile)) {
      return undefined
    }

    const canInjectBackend =
      (isJavaTargetFile(targetFile) || isBackendBootstrapTargetFile(targetFile)) &&
      config.enabledDomains.includes("backend")
    const canInjectSharedSkill = hasEnabledSharedSkillDomain(config.enabledDomains, targetFile)
    if (!canInjectBackend && !canInjectSharedSkill) {
      return undefined
    }

    const injection = createInjectionBlock(targetFile, projectDir)
    store.set(sessionID, injection)
    writePhase0Evidence(projectDir, {
      hook,
      sessionID,
      callID,
      injectedInto: "pending-store",
      injection,
    })
    return injection
  }

  function captureJavaRoleDiscovery(input: ToolAfterInput, output: ToolAfterOutput): void {
    if (!runtimeInjectionEnabled || typeof output.output !== "string" || !config.enabledDomains.includes("backend")) {
      return
    }
    if (!allowsRuntimeInjection(input.sessionID, "java-role-discovery")) {
      return
    }

    const injections = discoverJavaRoleInjections(input.tool, output.output, projectDir)
    if (injections.length === 0) {
      return
    }

    appendJavaRoleDiscoveryToToolOutput(output, formatJavaRoleDiscoveryBlock(injections))
    const followUp = createJavaRoleReadFollowUp(injections)
    if (followUp) {
      store.set(input.sessionID, followUp)
      writePhase0Evidence(projectDir, {
        hook: "tool.execute.after",
        sessionID: input.sessionID,
        callID: input.callID,
        injectedInto: "pending-store",
        injection: followUp,
      })
    }

    for (const injection of injections) {
      writePhase0Evidence(projectDir, {
        hook: "tool.execute.after",
        sessionID: input.sessionID,
        callID: input.callID,
        injectedInto: "role-discovery",
        injection,
      })
    }
  }

  return {
    event: async (input: EventInput): Promise<void> => {
      await runHostHookAsync("event", async () => {
        if (!config.enabled) {
          return
        }
        sessionRegistry.observeEvent(input.event)
        if (config.telemetry.tokenUsage && input.event.type === "message.updated") {
          const telemetryResult = tokenTelemetry.recordMessage(input.event.properties.info)
          await tokenCompaction.maybeSummarize(input.event.properties.info, telemetryResult)
        }
        if (!config.enforce.idleContinuation || input.event.type !== "session.idle") {
          return
        }
        if (!allowsRuntimeInjection(input.event.properties.sessionID, "idle-continuation")) {
          return
        }
        await idleContinuation.continueIfBlocked(input.event.properties.sessionID)
      })
    },

    "tool.execute.before": async (input: ToolBeforeInput, output: ToolBeforeOutput): Promise<void> => {
      runHostHook("tool.execute.before", () => {
        captureTargetFile(
          "tool.execute.before",
          input.tool,
          input.sessionID,
          input.callID,
          output.args as Record<string, unknown>,
        )
      })
    },

    "tool.execute.after": async (input: ToolAfterInput, output: ToolAfterOutput): Promise<void> => {
      runHostHook("tool.execute.after", () => {
        compliance.observeTool(projectDir, {
          tool: input.tool,
          sessionID: input.sessionID,
          callID: input.callID,
          args: input.args as Record<string, unknown>,
        })
        captureJavaRoleDiscovery(input, output)

        const injection = captureTargetFile(
          "tool.execute.after",
          input.tool,
          input.sessionID,
          input.callID,
          input.args as Record<string, unknown>,
        )
        if (!injection) {
          return
        }

        appendInjectionToToolOutput(output, injection.block)
        const warning = createWriteGuardWarning({
          projectDir,
          targetFile: injection.targetFile,
          tool: input.tool,
        })
        if (warning !== undefined) {
          appendWriteGuardWarningToToolOutput(output, warning)
        }
        writePhase0Evidence(projectDir, {
          hook: "tool.execute.after",
          sessionID: input.sessionID,
          callID: input.callID,
          injectedInto: "tool-output",
          injection,
        })
        observeJavaWriteReportOnly({
          projectDir,
          tool: input.tool,
          sessionID: input.sessionID,
          callID: input.callID,
          targetFile: injection.targetFile,
        })
      })
    },

    "experimental.chat.messages.transform": async (
      _input: unknown,
      output: TransformMessagesOutput,
    ): Promise<void> => {
      runHostHook("experimental.chat.messages.transform", () => {
        const latestUserMessage = [...output.messages].reverse().find((message) => message.info.role === "user")
        const sessionId = latestUserMessage?.info.sessionID
        if (!sessionId) {
          return
        }

        if (runtimeInjectionEnabled && allowsRuntimeInjection(sessionId, "intent-workflow")) {
          maybeInjectIntentWorkflow(output, projectDir, sessionId, config, compliance)
        }

        const injection =
          runtimeInjectionEnabled && allowsRuntimeInjection(sessionId, "model-input") ? store.take(sessionId) : undefined
        if (!injection) {
          return
        }

        if (injectIntoLatestUserMessage(output, injection)) {
          writePhase0Evidence(projectDir, {
            hook: "experimental.chat.messages.transform",
            sessionID: sessionId,
            injectedInto: "model-input",
            injection,
          })
        }
      })
    },

    "experimental.chat.system.transform": async (
      input: TransformSystemInput,
      output: TransformSystemOutput,
    ): Promise<void> => {
      runHostHook("experimental.chat.system.transform", () => {
        if (config.enabled && config.telemetry.tokenUsage) {
          tokenTelemetry.rememberModelLimit(input.sessionID, input.model)
        }
        if (runtimeInjectionEnabled && allowsRuntimeInjection(input.sessionID, "system-constitution")) {
          injectSystemConstitution(output, config)
        }
      })
    },

    "experimental.text.complete": async (
      input: TextCompleteInput,
      output: TextCompleteOutput,
    ): Promise<void> => {
      runHostHook("experimental.text.complete", () => {
        if (!runtimeInjectionEnabled) {
          return
        }
        if (!allowsRuntimeInjection(input.sessionID, "text-continuation")) {
          return
        }
        const block = continuation.completeText(projectDir, input.sessionID, output.text)
        if (block === undefined || output.text.includes("[Persona Harness Continuation]")) {
          return
        }

        output.text = `${output.text}\n\n---\n\n${block}`
      })
    },
  }
}
