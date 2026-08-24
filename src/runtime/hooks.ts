import type { Hooks } from "@opencode-ai/plugin"
import { existsSync } from "node:fs"
import { join } from "node:path"

import { writePhase0Evidence, writeRuntimeContextEvidence } from "./evidence.js"
import { ContinuationTracker } from "./continuation.js"
import { isBackendBootstrapTargetFile, isJavaTargetFile } from "./file-role.js"
import {
  isObserverFindingsEnabled,
  isRuntimeInjectionEnabled,
  loadHarnessConfigResult,
  resolveSafeEvidenceRootResult,
} from "../config/harness-config.js"
import { createInjectionBlock } from "./injection.js"
import type { EffectiveProfileInjectionOptions } from "./injection.js"
import { readPersonalizationStore } from "../cli/personalization-profile-store.js"
import { IdleContinuationTracker } from "./idle-continuation.js"
import type { IdleContinuationClient } from "./idle-continuation.js"
import { AuthDesignDecisionTracker } from "./auth-design-decision.js"
import {
  maybeInjectAuthDesignDecision,
  maybeInjectIntentWorkflow,
  maybeInjectProductDeepInterview,
} from "./intent-workflow.js"
import { injectSystemConstitution } from "./system-constitution.js"
import { TokenCompactionTracker } from "./token-compaction.js"
import type { TokenCompactionClient } from "./token-compaction.js"
import { TokenTelemetryRecorder } from "./token-telemetry.js"
import { RalphLoopContinuationTracker } from "./ralph-loop.js"
import { RalphLoopToolOutputContinuationTracker, isRalphLoopToolOutputCandidate } from "./ralph-loop-tool-output.js"
import {
  createJavaRoleReadFollowUp,
  discoverJavaRoleInjections,
  formatJavaRoleDiscoveryBlock,
  isJavaRoleDiscoveryTool,
} from "./java-role-discovery.js"
import { warnRuntimeFailure } from "./error-boundary.js"
import {
  hasObservedRuntimeContextToolOutput,
  injectRuntimeContextIntoLatestUserMessage,
  markRuntimeContextToolOutput,
} from "./messages.js"
import { observeJavaWriteReportOnly } from "./observer-report-only.js"
import { RailComplianceTracker } from "./rail-compliance.js"
import { ProductDeepInterviewTracker } from "./product-deep-interview.js"
import { observeRoleBoundaryWrite } from "./role-boundary-heuristic.js"
import { RuntimeSessionRegistry } from "./session-registry.js"
import type { RuntimeInjectionSurface } from "./session-registry.js"
import { PendingInjectionStore } from "./store.js"
import { renderRuntimeContextSections } from "./runtime-context.js"
import { extractTargetFile, isInstalledPersonaHarnessPackageFile } from "./target-file.js"
import { selectSharedSkillsForTarget } from "./shared-skill-router.js"
import { createWriteGuardWarning } from "./write-guard.js"
import { EntrySteeringTracker } from "./entry-steering-status.js"
import {
  createProjectAutoUpdateScheduler,
  type ProjectAutoUpdateScheduler,
} from "./project-auto-update.js"
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
  projectAutoUpdate?: {
    readonly enabled: boolean
    readonly scheduler?: ProjectAutoUpdateScheduler
  }
  projectDir?: string
  store?: PendingInjectionStore
}

function appendInjectionToToolOutput(output: ToolAfterOutput, block: string): void {
  if (typeof output.output !== "string") {
    return
  }

  output.output = `${output.output}\n\n---\n\n${block}`
}

function sessionIDFromLifecycleEvent(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined
  }
  const properties = (value as { readonly properties?: unknown }).properties
  if (typeof properties !== "object" || properties === null || Array.isArray(properties)) {
    return undefined
  }
  const record = properties as { readonly sessionID?: unknown; readonly info?: unknown }
  if (typeof record.sessionID === "string") {
    return record.sessionID
  }
  if (typeof record.info !== "object" || record.info === null || Array.isArray(record.info)) {
    return undefined
  }
  const info = record.info as { readonly id?: unknown; readonly sessionID?: unknown }
  return typeof info.sessionID === "string"
    ? info.sessionID
    : typeof info.id === "string" ? info.id : undefined
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

function loadPersonalizationInjectionProfile(): EffectiveProfileInjectionOptions {
  try {
    const store = readPersonalizationStore()
    return {
      available: true,
      personalRules: store.profile.activeRules.map((rule) => ({
        id: rule.ruleId,
        rule: rule.rule,
        scope: rule.scope,
        status: "active" as const,
        topic: rule.topic,
      })),
    }
  } catch {
    return { available: false, personalRules: [] }
  }
}

export function createPhase0Hooks(options: Phase0HookOptions = {}): Hooks {
  const store = options.store ?? new PendingInjectionStore()
  const projectDir = options.projectDir ?? process.cwd()
  const configResult = loadHarnessConfigResult(projectDir)
  if (!configResult.safe) {
    return {
      event: async () => {},
      "tool.execute.before": async () => {},
      "tool.execute.after": async () => {},
      "experimental.chat.messages.transform": async () => {},
      "experimental.chat.system.transform": async () => {},
      "experimental.text.complete": async () => {},
    }
  }
  const config = configResult.config
  const projectAutoUpdate = options.projectAutoUpdate?.enabled === true
    ? options.projectAutoUpdate.scheduler ?? createProjectAutoUpdateScheduler()
    : undefined
  const evidencePath = resolveSafeEvidenceRootResult(projectDir, config.evidenceDir)
  if (!evidencePath.ok) {
    return {
      event: async () => {},
      "tool.execute.before": async () => {},
      "tool.execute.after": async () => {},
      "experimental.chat.messages.transform": async () => {},
      "experimental.chat.system.transform": async () => {},
      "experimental.text.complete": async () => {},
    }
  }
  const evidenceDir = evidencePath.path
  const compliance = new RailComplianceTracker({ evidenceDir })
  const productInterviewMode = existsSync(join(projectDir, "src")) ? "brownfield-change-discovery" : "new-product"
  const productInterview = new ProductDeepInterviewTracker({ mode: productInterviewMode })
  const authDesignDecision = new AuthDesignDecisionTracker()
  const continuation = new ContinuationTracker({ evidenceDir })
  const entrySteering = new EntrySteeringTracker(projectDir, config)
  const runtimeInjectionEnabled = isRuntimeInjectionEnabled(config)
  const effectiveProfile = runtimeInjectionEnabled ? loadPersonalizationInjectionProfile() : undefined
  const observerFindingsEnabled = isObserverFindingsEnabled(config)
  const idleContinuation = new IdleContinuationTracker({ client: options.client, projectDir })
  const ralphLoop = new RalphLoopContinuationTracker({
    client: options.client,
    config: config.enforce.ralphLoop,
    projectDir,
  })
  const ralphLoopToolOutput = new RalphLoopToolOutputContinuationTracker({
    config: config.enforce.ralphLoop,
    projectDir,
  })
  const tokenTelemetry = new TokenTelemetryRecorder(projectDir, { evidenceDir })
  const tokenCompaction = new TokenCompactionTracker({
    client: options.client,
    config: config.enforce.compaction,
    evidenceDir,
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

  function allowsMainSession(sessionID: string | undefined, surface: RuntimeInjectionSurface): boolean {
    return sessionRegistry.allowsMainSession(sessionID, surface)
  }

  function allowsUtterance(sessionID: string | undefined, surface: RuntimeInjectionSurface): boolean {
    return sessionRegistry.allowsUtterance(sessionID, surface)
  }

  function captureTargetFile(
    tool: string,
    sessionID: string,
    callID: string | undefined,
    args: Record<string, unknown>,
  ): { readonly injection: ReturnType<typeof createInjectionBlock>; readonly accepted: boolean; readonly kind: string } | undefined {
    if (!runtimeInjectionEnabled) {
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
    if (!allowsRuntimeInjection(sessionID, "target-file")) {
      return undefined
    }

    const injection = createInjectionBlock(targetFile, projectDir, { configResult, effectiveProfile })
    const offer = store.set(sessionID, injection)
    const acceptedInjection = offer.injection ?? injection
    if (offer.kind === "offered") {
      writePhase0Evidence(projectDir, {
        hook: "tool.execute.after",
        sessionID,
        callID,
        injectedInto: "pending-store",
        injection: acceptedInjection,
      }, {
        evidenceDir,
      })
      writeRuntimeContextEvidence(projectDir, {
        hook: "tool.execute.after",
        sessionID,
        callID,
        injection: acceptedInjection,
        state: "offered",
      }, { evidenceDir })
    }
    return { injection: acceptedInjection, accepted: offer.accepted, kind: offer.kind }
  }

  function captureJavaRoleDiscovery(input: ToolAfterInput, output: ToolAfterOutput): void {
    if (!runtimeInjectionEnabled || typeof output.output !== "string" || !config.enabledDomains.includes("backend")) {
      return
    }
    if (!isJavaRoleDiscoveryTool(input.tool)) {
      return
    }
    if (!allowsRuntimeInjection(input.sessionID, "java-role-discovery")) {
      return
    }

    const injections = discoverJavaRoleInjections(input.tool, output.output, projectDir, configResult)
    if (injections.length === 0) {
      return
    }

    appendJavaRoleDiscoveryToToolOutput(output, formatJavaRoleDiscoveryBlock(injections))
    const followUp = createJavaRoleReadFollowUp(injections)
    if (followUp) {
      const offer = store.set(input.sessionID, followUp)
      if (offer.accepted) {
        const acceptedFollowUp = offer.injection ?? followUp
        writePhase0Evidence(projectDir, {
          hook: "tool.execute.after",
          sessionID: input.sessionID,
          callID: input.callID,
          injectedInto: "pending-store",
          injection: acceptedFollowUp,
        }, {
          evidenceDir,
        })
      }
    }

    for (const injection of injections) {
      writePhase0Evidence(projectDir, {
        hook: "tool.execute.after",
        sessionID: input.sessionID,
        callID: input.callID,
        injectedInto: "role-discovery",
        injection,
      }, {
        evidenceDir,
      })
    }
  }

  return {
    event: async (input: EventInput): Promise<void> => {
      await runHostHookAsync("event", async () => {
        if (input.event.type === "session.created") {
          projectAutoUpdate?.schedule(projectDir)
        }
        if (!config.enabled) {
          return
        }
        sessionRegistry.observeEvent(input.event)
        const eventType = input.event.type as string
        if (eventType === "session.deleted" || eventType === "session.compacted") {
          const sessionID = sessionIDFromLifecycleEvent(input.event)
          if (sessionID !== undefined) {
            store.clearSession(sessionID)
          }
        }
        if (config.telemetry.tokenUsage && input.event.type === "message.updated") {
          const telemetryResult = tokenTelemetry.recordMessage(input.event.properties.info)
          await tokenCompaction.maybeSummarize(input.event.properties.info, telemetryResult)
        }
        if (input.event.type !== "session.idle") {
          return
        }
        if (config.enforce.ralphLoop.enabled) {
          if (config.enforce.ralphLoop.toolOutputTrigger) {
            return
          }
          if (!allowsUtterance(input.event.properties.sessionID, "ralph-loop")) {
            return
          }
          await ralphLoop.continueIfBlocked(input.event.properties.sessionID)
          return
        }
        if (!config.enforce.idleContinuation) {
          return
        }
        if (!allowsUtterance(input.event.properties.sessionID, "idle-continuation")) {
          return
        }
        await idleContinuation.continueIfBlocked(input.event.properties.sessionID)
      })
    },

    "tool.execute.before": async (input: ToolBeforeInput, output: ToolBeforeOutput): Promise<void> => {
      void input
      void output
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
        const observedTargetFile = extractTargetFile(input.tool, input.args as Record<string, unknown>)
        observeRoleBoundaryWrite({
          multiAgentEnabled: config.multiAgent.enabled,
          projectDir,
          tool: input.tool,
          sessionID: input.sessionID,
          callID: input.callID,
          targetFile: observedTargetFile,
        })

        if (typeof output.output === "string") {
          const toolOutputInput = {
            args: input.args as Record<string, unknown>,
            output: output.output,
            sessionID: input.sessionID,
            tool: input.tool,
          }
          if (isRalphLoopToolOutputCandidate(toolOutputInput) && allowsUtterance(input.sessionID, "ralph-loop")) {
            const result = ralphLoopToolOutput.appendIfEligible(toolOutputInput)
            if (result.kind === "appended") {
              output.output = result.output
            }
          }
        }

        // Observer findings are independent of guidance injection: the accepted
        // A/B measured the guidance block, not this surface, so it must be able
        // to run without turning that block back on.
        if (observerFindingsEnabled) {
          observeJavaWriteReportOnly({
            evidenceDir,
            projectDir,
            tool: input.tool,
            sessionID: input.sessionID,
            callID: input.callID,
            targetFile: observedTargetFile,
            output,
          })
        }

        const captured = captureTargetFile(
          input.tool,
          input.sessionID,
          input.callID,
          input.args as Record<string, unknown>,
        )
        if (captured === undefined || !captured.accepted) {
          if (captured?.kind === "duplicate-suppressed") {
            writeRuntimeContextEvidence(projectDir, {
              hook: "tool.execute.after",
              sessionID: input.sessionID,
              callID: input.callID,
              injection: captured.injection,
              state: "duplicate-suppressed",
            }, { evidenceDir })
          }
          return
        }
        const injection = captured.injection

        if (typeof output.output !== "string") {
          return
        }

        appendInjectionToToolOutput(output, renderRuntimeContextSections(injection.semanticSections))
        markRuntimeContextToolOutput(output, injection)
        const warning = createWriteGuardWarning({
          projectDir,
          targetFile: injection.targetFile,
          tool: input.tool,
        })
        if (warning !== undefined) {
          appendWriteGuardWarningToToolOutput(output, warning)
        }
        if (!observerFindingsEnabled) {
          observeJavaWriteReportOnly({
            evidenceDir,
            projectDir,
            tool: input.tool,
            sessionID: input.sessionID,
            callID: input.callID,
            targetFile: injection.targetFile,
          })
        }
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
          const authDesignResult = maybeInjectAuthDesignDecision(output, sessionId, authDesignDecision)
          if (authDesignResult === "injected" || authDesignResult === "blocked") {
            store.take(sessionId)
            return
          }

          const productInterviewInjected = authDesignResult !== "released"
            && config.enabledDomains.includes("product")
            && maybeInjectProductDeepInterview(output, sessionId, productInterview, productInterviewMode)
          if (productInterviewInjected) {
            store.take(sessionId)
            return
          }
          maybeInjectIntentWorkflow(output, projectDir, sessionId, config, compliance, {
            authDesignApproved: authDesignResult === "released",
            evidenceDir,
          })
        }

        entrySteering.apply(sessionId, output)

        const injection =
          runtimeInjectionEnabled && allowsRuntimeInjection(sessionId, "model-input")
            ? store.takeForModelInput(sessionId)
            : undefined
        if (!injection) {
          return
        }

        if (hasObservedRuntimeContextToolOutput(output, sessionId, injection)) {
          store.markToolOutputEmitted(sessionId, injection.contextDigest)
          writePhase0Evidence(projectDir, {
            hook: "experimental.chat.messages.transform",
            sessionID: sessionId,
            injectedInto: "tool-output",
            injection,
          }, {
            evidenceDir,
          })
          writeRuntimeContextEvidence(projectDir, {
            hook: "experimental.chat.messages.transform",
            sessionID: sessionId,
            injection,
            state: "tool-output-emitted",
          }, { evidenceDir })
          return
        }

        const delivery = injectRuntimeContextIntoLatestUserMessage(output, injection)
        if (delivery === "observed" || delivery === "fallback") {
          if (delivery === "observed") {
            store.markModelInputObserved(sessionId, injection.contextDigest)
          } else {
            store.markModelInputFallback(sessionId, injection.contextDigest)
          }
          writePhase0Evidence(projectDir, {
            hook: "experimental.chat.messages.transform",
            sessionID: sessionId,
            injectedInto: "model-input",
            injection,
          }, {
            evidenceDir,
          })
          writeRuntimeContextEvidence(projectDir, {
            hook: "experimental.chat.messages.transform",
            sessionID: sessionId,
            injection,
            state: delivery === "observed" ? "model-input-observed" : "model-input-fallback",
          }, { evidenceDir })
        } else if (delivery === "duplicate-suppressed") {
          store.markDuplicateSuppressed(sessionId, injection.contextDigest)
          writeRuntimeContextEvidence(projectDir, {
            hook: "experimental.chat.messages.transform",
            sessionID: sessionId,
            injection,
            state: "duplicate-suppressed",
          }, { evidenceDir })
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
