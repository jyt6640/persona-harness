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
  | "project-bootstrap"
  | "requirements-bootstrap"
  | "gradle-bootstrap"
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

export type SelectedPolicyOverlay = {
  readonly enabled: boolean
  readonly sources: readonly ("company" | "personal")[]
  readonly diagnostics: readonly string[]
}

export type PendingInjection = {
  readonly targetFile: string
  readonly fileRole: FileRole
  readonly selectedHarnessConfigDiagnostics: readonly SelectedHarnessConfigDiagnostic[]
  readonly selectedRules: string[]
  readonly selectedRuleMetadata: SelectedRuleMetadata[]
  readonly selectedSharedSkills: readonly SelectedSharedSkill[]
  readonly selectedPolicyOverlay: SelectedPolicyOverlay
  readonly policies: string[]
  readonly block: string
}

export type SelectedHarnessConfigDiagnostic = {
  readonly code: string
  readonly message: string
  readonly path: string
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
export type EventInput = Parameters<HookHandler<Hooks["event"]>>[0]
export type TransformMessagesOutput = Parameters<HookHandler<Hooks["experimental.chat.messages.transform"]>>[1]
export type TransformSystemInput = Parameters<HookHandler<Hooks["experimental.chat.system.transform"]>>[0]
export type TransformSystemOutput = Parameters<HookHandler<Hooks["experimental.chat.system.transform"]>>[1]
export type TextCompleteInput = Parameters<HookHandler<Hooks["experimental.text.complete"]>>[0]
export type TextCompleteOutput = Parameters<HookHandler<Hooks["experimental.text.complete"]>>[1]
