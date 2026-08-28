export type ContextBudget = {
  readonly maxCapsules: number
  readonly maxChars: number
}

export const DEFAULT_CONTEXT_BUDGET: Readonly<ContextBudget> = Object.freeze({
  maxCapsules: 8,
  maxChars: 1_600,
})
