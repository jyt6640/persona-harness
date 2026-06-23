export function normalizePath(path: string): string {
  return path.replace(/\\/g, "/")
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
