import type { Hooks } from "@opencode-ai/plugin"

import { writePhase0Evidence } from "./evidence.js"
import { formatDebugWorkflowBlock } from "./debug-workflow-skill.js"
import { formatRefactorWorkflowBlock } from "./refactor-workflow-skill.js"
import { formatReviewWorkflowBlock } from "./review-workflow-skill.js"
import { isBackendBootstrapTargetFile, isJavaTargetFile } from "./file-role.js"
import { loadHarnessConfig } from "../config/harness-config.js"
import { createInjectionBlock } from "./injection.js"
import {
  createJavaRoleReadFollowUp,
  discoverJavaRoleInjections,
  formatJavaRoleDiscoveryBlock,
} from "./java-role-discovery.js"
import { injectIntoLatestUserMessage, injectTextIntoLatestUserMessage } from "./messages.js"
import {
  formatRequirementsWorkflowBlock,
  hasRequirementsDraft,
  hasPersonaWorkflowOptIn,
} from "./requirements-workflow-skill.js"
import { PendingInjectionStore } from "./store.js"
import { extractTargetFile, isInstalledPersonaHarnessPackageFile } from "./target-file.js"
import { detectTopLevelIntent } from "./top-level-intent-router.js"
import { selectSharedSkillsForTarget } from "./shared-skill-router.js"
import type {
  ToolAfterInput,
  ToolAfterOutput,
  ToolBeforeInput,
  ToolBeforeOutput,
  TransformMessagesOutput,
} from "./types.js"

type Phase0HookOptions = {
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

function hasEnabledSharedSkillDomain(enabledDomains: readonly string[], targetFile: string): boolean {
  return selectSharedSkillsForTarget(targetFile).some((skill) => enabledDomains.includes(skill.domain))
}

function latestUserText(output: TransformMessagesOutput): string | undefined {
  const latestUserMessage = [...output.messages].reverse().find((message) => message.info.role === "user")
  const textPart = latestUserMessage?.parts.find((part) => part.type === "text" && typeof part.text === "string")
  return textPart?.type === "text" ? textPart.text : undefined
}

function maybeInjectIntentWorkflow(output: TransformMessagesOutput, projectDir: string, config: ReturnType<typeof loadHarnessConfig>): boolean {
  if (!config.enabled || !config.enabledDomains.includes("workflow") || !hasPersonaWorkflowOptIn(projectDir)) {
    return false
  }
  const text = latestUserText(output)
  if (text === undefined) {
    return false
  }
  const intent = detectTopLevelIntent(text)

  if (intent?.primary === "debug") {
    return injectTextIntoLatestUserMessage(
      output,
      formatDebugWorkflowBlock(intent),
      "[Persona Harness Debug Workflow]",
    )
  }

  if (intent?.primary === "review") {
    return injectTextIntoLatestUserMessage(
      output,
      formatReviewWorkflowBlock(intent),
      "[Persona Harness Review Workflow]",
    )
  }

  if (intent?.primary === "refactor") {
    return injectTextIntoLatestUserMessage(
      output,
      formatRefactorWorkflowBlock(intent),
      "[Persona Harness Refactor Workflow]",
    )
  }

  if (intent === undefined || intent.primary !== "requirements" || intent.requirementsIntent === undefined) {
    return false
  }

  if (intent.requirementsIntent.kind === "requirement-approval" && !hasRequirementsDraft(projectDir)) {
    return false
  }
  return injectTextIntoLatestUserMessage(
    output,
    formatRequirementsWorkflowBlock(intent.requirementsIntent),
    "[Persona Harness Requirements Workflow]",
  )
}

export function createPhase0Hooks(options: Phase0HookOptions = {}): Hooks {
  const store = options.store ?? new PendingInjectionStore()
  const projectDir = options.projectDir ?? process.cwd()
  const config = loadHarnessConfig(projectDir)

  function captureTargetFile(
    hook: "tool.execute.before" | "tool.execute.after",
    tool: string,
    sessionID: string,
    callID: string | undefined,
    args: Record<string, unknown>,
  ): ReturnType<typeof createInjectionBlock> | undefined {
    if (!config.enabled) {
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
    if (!config.enabled || typeof output.output !== "string" || !config.enabledDomains.includes("backend")) {
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
    "tool.execute.before": async (input: ToolBeforeInput, output: ToolBeforeOutput): Promise<void> => {
      captureTargetFile(
        "tool.execute.before",
        input.tool,
        input.sessionID,
        input.callID,
        output.args as Record<string, unknown>,
      )
    },

    "tool.execute.after": async (input: ToolAfterInput, output: ToolAfterOutput): Promise<void> => {
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
      writePhase0Evidence(projectDir, {
        hook: "tool.execute.after",
        sessionID: input.sessionID,
        callID: input.callID,
        injectedInto: "tool-output",
        injection,
      })
    },

    "experimental.chat.messages.transform": async (
      _input: unknown,
      output: TransformMessagesOutput,
    ): Promise<void> => {
      const latestUserMessage = [...output.messages].reverse().find((message) => message.info.role === "user")
      const sessionId = latestUserMessage?.info.sessionID
      if (!sessionId) {
        return
      }

      maybeInjectIntentWorkflow(output, projectDir, config)

      const injection = store.take(sessionId)
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
    },
  }
}
