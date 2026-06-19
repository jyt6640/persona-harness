import type { Hooks } from "@opencode-ai/plugin"

export type FileRole =
  | "controller"
  | "service"
  | "repository"
  | "entity"
  | "domain"
  | "request-dto"
  | "response-dto"
  | "exception"
  | "test"
  | "java-common"
  | "typescript"
  | "frontend"
  | "infra"
  | "shared-skill"

export type SelectedSharedSkill = {
  readonly name: string
  readonly domain: string
  readonly path: string
  readonly reason: string
}

export type PendingInjection = {
  readonly targetFile: string
  readonly fileRole: FileRole
  readonly selectedRules: string[]
  readonly selectedRuleMetadata: SelectedRuleMetadata[]
  readonly selectedSharedSkills: readonly SelectedSharedSkill[]
  readonly policies: string[]
  readonly block: string
}

export type SelectedRuleMetadata = {
  readonly path: string
  readonly id: string
  readonly source?: string
  readonly domain?: string
  readonly topic?: string
  readonly severity?: string
}

type HookHandler<T> = NonNullable<T>

export type ToolBeforeInput = Parameters<HookHandler<Hooks["tool.execute.before"]>>[0]
export type ToolBeforeOutput = Parameters<HookHandler<Hooks["tool.execute.before"]>>[1]
export type ToolAfterInput = Parameters<HookHandler<Hooks["tool.execute.after"]>>[0]
export type ToolAfterOutput = Parameters<HookHandler<Hooks["tool.execute.after"]>>[1]
export type TransformMessagesOutput = Parameters<HookHandler<Hooks["experimental.chat.messages.transform"]>>[1]
