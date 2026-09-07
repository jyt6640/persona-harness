import { changeContextScopeBinding, ContextScopeError, readContextScopeBinding, type ContextScopeBinding } from "./context-checkout-binding.js"
import { runContextPreviewCommand } from "./context-preview.js"
import { PersonalizationStoreError, readPersonalizationStore, type PersonalizationStoreOptions } from "./personalization-store-io.js"

export function runContextTaskCommand(
  args: readonly string[],
  projectDir: string,
  options: PersonalizationStoreOptions = {},
): { readonly status: 0 | 1; readonly stdout: string; readonly stderr: string } {
  const [sessionOption, taskSession, action, ...rest] = args
  if (sessionOption !== "--session" || taskSession === undefined || !/^[a-f0-9]{64}$/u.test(taskSession)) {
    return failure("context-task-arguments-invalid")
  }
  const bindingOptions = { ...options, taskSession }
  try {
    if (action === undefined) return success(readContextScopeBinding(projectDir, bindingOptions))
    if (action === "preview") {
      if (rest.includes("--task")) return failure("context-task-arguments-invalid")
      const binding = readContextScopeBinding(projectDir, bindingOptions)
      return runContextPreviewCommand([
        ...rest, ...(binding.status === "bound" ? ["--task", binding.scopeKey] : []),
      ], projectDir, { personalization: options })
    }
    const [taskOption, taskKey] = rest
    if ((action !== "resume" && action !== "end") || rest.length !== 2 || taskOption !== "--task"
      || taskKey === undefined || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/u.test(taskKey)) {
      return failure("context-task-arguments-invalid")
    }
    if (action === "resume") {
      const document = readPersonalizationStore(options)
      if (!document.profile.activeRules.some((rule) => rule.scope.kind === "task" && rule.scope.key === taskKey)) {
        return failure("context-task-rule-missing")
      }
    }
    return success(changeContextScopeBinding(projectDir, {
      action: action === "resume" ? "bind" : "unbind", scopeKey: taskKey,
    }, bindingOptions))
  } catch (error) {
    if (error instanceof ContextScopeError) return failure(error.code)
    if (error instanceof PersonalizationStoreError) return failure("context-scope-unavailable")
    throw error
  }
}

function success(value: ContextScopeBinding) {
  const result = value.status === "bound" ? { status: value.status, taskKey: value.scopeKey } : value
  return { status: 0, stdout: `${JSON.stringify(result)}\n`, stderr: "" } as const
}

function failure(code: string) {
  return { status: 1, stdout: "", stderr: `${code}\n` } as const
}
