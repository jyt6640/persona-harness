import { existsSync, realpathSync } from "node:fs"
import { join } from "node:path"

import { readInitManifest } from "../cli/init-manifest.js"
import { injectTextIntoLatestUserMessage } from "./messages.js"
import { detectTopLevelIntent } from "./top-level-intent-router.js"
import type { TransformMessagesOutput } from "./types.js"

type SetupSessionState = "accepted" | "awaiting-consent" | "declined"

export type PersonaSetupRouteResult = "injected" | "not-applicable"

const ENGLISH_ACCEPT_PATTERN = /^(?:(?:yes|y|accept|approve)(?:\s+(?:please|initialize(?:\s+it)?|set(?:\s+it)?\s+up))?|go ahead(?:\s+(?:and\s+)?(?:initialize(?:\s+it)?|set(?:\s+it)?\s+up))?)$/iu
const KOREAN_ACCEPT_PATTERN = /^(?:(?:네|넵|응|ㅇㅇ|예|그래|좋아|좋습니다|알겠어|알겠습니다|진행(?:해|해줘|해주세요)?|설정(?:해|해줘|해주세요)?|초기화(?:해|해줘|해주세요)?|동의(?:해|해줘|해주세요)?|승인(?:해|해줘|해주세요))(?:\s+(?:(?:알아서\s+)?(?:해|해줘|해주세요)|설정해줘|설정해주세요|초기화해줘|초기화해주세요|진행해줘|진행해주세요))?|(?:알아서\s+)?(?:해|해줘|해주세요))$/u
const DECLINE_PATTERN = /(?:\b(?:no|stop|defer|skip|later)\b|(?:아니|하지\s*마|취소|중단|보류|나중|넘겨|그만))/iu
const PERSONA_DIRECTORY = ".persona"
const OWNED_HARNESS_CONFIG = ".persona/harness.jsonc"

function latestUserText(output: TransformMessagesOutput): string | undefined {
  const latestUserMessage = [...output.messages].reverse().find((message) => message.info.role === "user")
  const textPart = latestUserMessage?.parts.find((part) => part.type === "text" && typeof part.text === "string")
  return textPart?.type === "text" ? textPart.text : undefined
}

function isRelevantPersonaRequest(message: string): boolean {
  const intent = detectTopLevelIntent(message)
  return intent !== undefined && intent.primary !== "unavailable"
}

function isExplicitSetupAcceptance(message: string): boolean {
  const normalized = message
    .replace(/[,.!?，。！]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
  return ENGLISH_ACCEPT_PATTERN.test(normalized) || KOREAN_ACCEPT_PATTERN.test(normalized)
}

export function hasManagedPersonaInitialization(projectDir: string): boolean {
  try {
    const manifest = readInitManifest(projectDir)
    return manifest !== null
      && manifest.project.realPath === realpathSync(projectDir)
      && manifest.files.some((file) => file.path === OWNED_HARNESS_CONFIG)
  } catch {
    return false
  }
}

function setupRecommendationBlock(): string {
  return [
    "[Persona Harness Setup Recommendation]",
    "Required response: begin with one short user-language notice: `(PH) Setup` — automatic: this project has not been initialized yet.",
    "Ask exactly one plain-language question: Would you like Persona Harness to initialize this project now?",
    "If the user accepts in a later message, the existing `npx ph init` command may create only its managed `.persona` configuration, manifest-owned shared-skill adapters, and OpenCode project registration.",
    "Do not run a command, create project state, or start a workflow in this turn. Do not begin a deep interview, technical intake, plan, or implementation before explicit setup acceptance.",
  ].join("\n")
}

function setupApprovalBlock(): string {
  return [
    "[Persona Harness Setup Approval]",
    "Required response: begin with one short user-language notice: `(PH) Setup` — explicit: the user approved this project's initialization.",
    "The user explicitly approved one initialization. The route itself does not execute commands. If the host can execute commands, run exactly `npx ph init` once from the current project root and report its bounded result.",
    "Do not run bootstrap, attach, workflow, Git, network, or command chains. Do not create any state beyond what `npx ph init` owns.",
    "After a successful init, start a fresh host session before claiming that host-native skill discovery or routing is active.",
  ].join("\n")
}

/**
 * Holds a first-run setup proposal in memory only. It neither persists consent
 * nor executes `ph init`; a host agent must receive explicit user consent and
 * independently invoke the existing CLI command.
 */
export class PersonaSetupTracker {
  private readonly sessions = new Map<string, SetupSessionState>()

  route(
    output: TransformMessagesOutput,
    projectDir: string,
    sessionID: string,
  ): PersonaSetupRouteResult {
    if (hasManagedPersonaInitialization(projectDir)) {
      this.sessions.delete(sessionID)
      return "not-applicable"
    }
    if (existsSync(join(projectDir, PERSONA_DIRECTORY))) {
      this.sessions.delete(sessionID)
      return "not-applicable"
    }

    const message = latestUserText(output)
    if (message === undefined) {
      return "not-applicable"
    }

    const state = this.sessions.get(sessionID)
    if (state === "awaiting-consent") {
      if (DECLINE_PATTERN.test(message)) {
        this.sessions.set(sessionID, "declined")
        return "not-applicable"
      }
      if (!isExplicitSetupAcceptance(message)) {
        return "not-applicable"
      }
      this.sessions.set(sessionID, "accepted")
      return injectTextIntoLatestUserMessage(
        output,
        setupApprovalBlock(),
        "[Persona Harness Setup Approval]",
      )
        ? "injected"
        : "not-applicable"
    }

    if (state !== undefined || !isRelevantPersonaRequest(message)) {
      return "not-applicable"
    }

    this.sessions.set(sessionID, "awaiting-consent")
    return injectTextIntoLatestUserMessage(
      output,
      setupRecommendationBlock(),
      "[Persona Harness Setup Recommendation]",
    )
      ? "injected"
      : "not-applicable"
  }
}
