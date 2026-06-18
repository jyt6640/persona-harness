export function getJavaFileName(filePath: string): string {
  const normalizedPath = filePath.replace(/\\/g, "/")
  const segments = normalizedPath.split("/")
  return segments[segments.length - 1] ?? normalizedPath
}

export function hasJavaClassOrRecord(source: string, className: string): boolean {
  return new RegExp(`\\b(?:class|record)\\s+${escapeRegExp(className)}\\b`).test(source)
}

export function normalizeJavaParameter(parameter: string): string {
  return parameter
    .replace(/@\w+(?:\([^)]*\))?\s*/g, "")
    .replace(/\bfinal\s+/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

export function stripJavaCommentsAndStrings(source: string): string {
  return stripJavaComments(source).replace(/"""[\s\S]*?"""|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, (value) =>
    value.replace(/[^\n]/g, " "),
  )
}

export function stripJavaComments(source: string): string {
  return source
    .replace(/\/\/[^\n]*/g, (value) => " ".repeat(value.length))
    .replace(/\/\*[\s\S]*?\*\//g, (value) => value.replace(/[^\n]/g, " "))
}

export function collectJavaStringLiterals(source: string): readonly string[] {
  const literals: string[] = []
  let index = 0
  while (index < source.length) {
    if (source.slice(index, index + 3) === '"""') {
      const literal = readTextBlock(source, index)
      literals.push(literal.text)
      index = literal.nextIndex
      continue
    }
    const current = source[index]
    if (current === '"' || current === "'") {
      const literal = readQuotedLiteral(source, index, current)
      literals.push(literal.text)
      index = literal.nextIndex
      continue
    }
    index += 1
  }
  return literals
}

export function collectMatches(source: string, regex: RegExp): readonly string[] {
  const matches: string[] = []
  for (const match of source.matchAll(regex)) {
    const value = match[0]?.trim()
    if (value) matches.push(value)
  }
  return unique(matches)
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)]
}

function readTextBlock(source: string, startIndex: number): { readonly text: string; readonly nextIndex: number } {
  const endIndex = source.indexOf('"""', startIndex + 3)
  if (endIndex === -1) return { text: source.slice(startIndex + 3), nextIndex: source.length }
  return { text: source.slice(startIndex + 3, endIndex), nextIndex: endIndex + 3 }
}

function readQuotedLiteral(
  source: string,
  startIndex: number,
  quote: '"' | "'",
): { readonly text: string; readonly nextIndex: number } {
  let text = ""
  let index = startIndex + 1
  let escaped = false
  while (index < source.length) {
    const current = source[index]
    index += 1
    if (escaped) {
      text += current
      escaped = false
      continue
    }
    if (current === "\\") {
      escaped = true
      continue
    }
    if (current === quote) return { text, nextIndex: index }
    text += current
  }
  return { text, nextIndex: index }
}
