export function normalizePath(path: string): string {
  return path.replace(/\\/g, "/")
}

const UNSUPPORTED_GLOB_META = new Set(["[", "]", "{", "}"])

export function invalidGlobReason(glob: string): string | undefined {
  if (glob.trim() === "") {
    return "glob must not be empty"
  }
  if (/[\r\n]/u.test(glob)) {
    return "glob must stay on one line"
  }
  for (const char of glob) {
    if (UNSUPPORTED_GLOB_META.has(char)) {
      return `unsupported glob token '${char}'`
    }
  }
  return undefined
}

function escapeRegExp(value: string): string {
  return value.replace(/[.+^${}()|[\]\\]/g, "\\$&")
}

function globToRegExp(glob: string): RegExp {
  let pattern = "^"
  for (let index = 0; index < glob.length; index += 1) {
    const current = glob[index]
    const next = glob[index + 1]
    const afterNext = glob[index + 2]

    if (current === "*" && next === "*" && afterNext === "/") {
      pattern += "(?:.*/)?"
      index += 2
      continue
    }
    if (current === "*" && next === "*") {
      pattern += ".*"
      index += 1
      continue
    }
    if (current === "*") {
      pattern += "[^/]*"
      continue
    }
    if (current === "?") {
      pattern += "[^/]"
      continue
    }
    pattern += escapeRegExp(current ?? "")
  }
  return new RegExp(`${pattern}$`)
}

export function matchesAnyGlob(globs: readonly string[], targetPath: string): boolean {
  return globs.length === 0 || globs.some((glob) => globToRegExp(glob).test(targetPath))
}
