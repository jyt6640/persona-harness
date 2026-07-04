import type { ClosureBlocker, ClosureStep } from "./workflow-closure.js"

export type ContinuationPromptContext = "cli-continue" | "closure-next" | "idle" | "ralph-loop"

type ContinuationPromptOptions = {
  readonly blocker: ClosureBlocker
  readonly context: ContinuationPromptContext
  readonly depth?: ContinuationPromptDepth
  readonly step: ClosureStep | null
}

type ContinuationPromptDepth = {
  readonly index: number
  readonly total: number
}

export function closureStepNextAction(step: ClosureStep | null): string {
  return step?.command ?? step?.commandAfterContent ?? "npx ph workflow continue"
}

function blockerLabel(blocker: ClosureBlocker, depth?: ContinuationPromptDepth): string {
  if (
    depth === undefined ||
    !Number.isInteger(depth.index) ||
    !Number.isInteger(depth.total) ||
    depth.index < 1 ||
    depth.total < depth.index
  ) {
    return `Blocker: ${blocker.id}`
  }
  return `Blocker: ${blocker.id} (blocker ${depth.index}/${depth.total})`
}

export function continuationPromptCoreLines(
  blocker: ClosureBlocker,
  step: ClosureStep | null,
  depth?: ContinuationPromptDepth,
): readonly string[] {
  return [
    "Closure blockers remain; do not claim completion.",
    blockerLabel(blocker, depth),
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
    ...continuationPromptCoreLines(options.blocker, options.step, options.depth),
    contextBoundaryLine(options.context),
  ]
}

export function createContinuationPromptText(options: ContinuationPromptOptions): string {
  return createContinuationPromptLines(options).join("\n")
}
