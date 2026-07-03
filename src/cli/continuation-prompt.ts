import type { ClosureBlocker, ClosureStep } from "./workflow-closure.js"

export type ContinuationPromptContext = "cli-continue" | "closure-next" | "idle" | "ralph-loop"

type ContinuationPromptOptions = {
  readonly blocker: ClosureBlocker
  readonly context: ContinuationPromptContext
  readonly step: ClosureStep | null
}

export function closureStepNextAction(step: ClosureStep | null): string {
  return step?.command ?? step?.commandAfterContent ?? "npx ph workflow continue"
}

export function continuationPromptCoreLines(blocker: ClosureBlocker, step: ClosureStep | null): readonly string[] {
  return [
    "Closure blockers remain; do not claim completion.",
    `Blocker: ${blocker.id}`,
    `Reason: ${blocker.reason}`,
    `Source: ${blocker.source}`,
    `Next action: ${closureStepNextAction(step)}`,
    "Fix only this blocker, then rerun `npx ph workflow finish implement`.",
  ]
}

function contextPrefixLines(context: ContinuationPromptContext): readonly string[] {
  switch (context) {
    case "cli-continue":
      return ["[Persona Harness Closure Continuation]"]
    case "closure-next":
      return ["[Persona Harness Closure Next]"]
    case "idle":
      return ["[Persona Harness Idle Continuation]", "", "Closure blockers remain after the session became idle."]
    case "ralph-loop":
      return ["[Persona Harness Ralph Loop]"]
  }
}

function contextBoundaryLine(context: ContinuationPromptContext): string {
  switch (context) {
    case "cli-continue":
    case "closure-next":
      return "This is deterministic closure guidance, not a success guarantee or autonomous loop."
    case "idle":
      return "This is an opt-in continuation nudge, not a hard stop, full orchestration loop, or generated app quality certification."
    case "ralph-loop":
      return "This is a default-off, retry-capped continuation preview, not a success guarantee or autonomous loop."
  }
}

export function createContinuationPromptLines(options: ContinuationPromptOptions): readonly string[] {
  return [
    ...contextPrefixLines(options.context),
    ...continuationPromptCoreLines(options.blocker, options.step),
    contextBoundaryLine(options.context),
  ]
}

export function createContinuationPromptText(options: ContinuationPromptOptions): string {
  return createContinuationPromptLines(options).join("\n")
}
