import { changeCheckoutProjectBinding, ContextScopeError, readCheckoutProjectBinding } from "./context-checkout-binding.js"
import { PersonalizationStoreError, readPersonalizationStore, type PersonalizationStoreOptions } from "./personalization-store-io.js"

export function runContextScopeCommand(
  args: readonly string[],
  projectDir: string,
  options: PersonalizationStoreOptions = {},
): { readonly status: 0 | 1; readonly stdout: string; readonly stderr: string } {
  const action = args[0]
  const projectKey = args[2]
  if (args.length !== 0 && (args.length !== 3 || (action !== "bind" && action !== "unbind")
    || args[1] !== "--project" || projectKey === undefined || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/u.test(projectKey))) {
    return failure("context-scope-arguments-invalid")
  }
  try {
    if (action === undefined) return success(readCheckoutProjectBinding(projectDir, options))
    if (projectKey === undefined || (action !== "bind" && action !== "unbind")) return failure("context-scope-arguments-invalid")
    if (action === "bind") {
      const document = readPersonalizationStore(options)
      if (!document.profile.activeRules.some((rule) => rule.scope.kind === "project" && rule.scope.key === projectKey)) {
        return failure("context-scope-rule-missing")
      }
    }
    return success(changeCheckoutProjectBinding(projectDir, { action, projectKey }, options))
  } catch (error) {
    if (error instanceof ContextScopeError) return failure(error.code)
    if (error instanceof PersonalizationStoreError) return failure("context-scope-unavailable")
    throw error
  }
}

function success(value: { readonly status: "bound" | "unbound"; readonly projectKey?: string }) {
  return { status: 0, stdout: `${JSON.stringify(value)}\n`, stderr: "" } as const
}

function failure(code: string) {
  return { status: 1, stdout: "", stderr: `${code}\n` } as const
}
