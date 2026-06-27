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

export function splitJavaParameters(parameters: string): readonly string[] {
  const result: string[] = []
  let startIndex = 0
  let angleDepth = 0
  let parenDepth = 0
  let bracketDepth = 0
  let braceDepth = 0
  let index = 0

  while (index < parameters.length) {
    const token = readProtectedJavaToken(parameters, index)
    if (token !== undefined) {
      index = token.nextIndex
      continue
    }

    const current = parameters[index]
    if (current === "<") angleDepth += 1
    if (current === ">" && angleDepth > 0) angleDepth -= 1
    if (current === "(") parenDepth += 1
    if (current === ")" && parenDepth > 0) parenDepth -= 1
    if (current === "[") bracketDepth += 1
    if (current === "]" && bracketDepth > 0) bracketDepth -= 1
    if (current === "{") braceDepth += 1
    if (current === "}" && braceDepth > 0) braceDepth -= 1
    if (current === "," && angleDepth === 0 && parenDepth === 0 && bracketDepth === 0 && braceDepth === 0) {
      pushJavaParameter(result, parameters.slice(startIndex, index))
      startIndex = index + 1
    }
    index += 1
  }

  pushJavaParameter(result, parameters.slice(startIndex))
  return result
}

export function collectJavaParameterLists(source: string, callableName: string): readonly string[] {
  const lists: string[] = []
  const regex = new RegExp(`\\b${escapeRegExp(callableName)}\\s*\\(`, "g")
  for (const match of source.matchAll(regex)) {
    const openParenIndex = (match.index ?? 0) + match[0].length - 1
    const parameterList = readBalancedParentheses(source, openParenIndex)
    if (parameterList !== undefined) lists.push(parameterList)
  }
  return lists
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

function readProtectedJavaToken(source: string, startIndex: number): { readonly nextIndex: number } | undefined {
  if (source.slice(startIndex, startIndex + 3) === '"""') {
    return { nextIndex: readTextBlock(source, startIndex).nextIndex }
  }
  const current = source[startIndex]
  if (current === '"' || current === "'") {
    return { nextIndex: readQuotedLiteral(source, startIndex, current).nextIndex }
  }
  if (current === "/" && source[startIndex + 1] === "/") {
    const lineEnd = source.indexOf("\n", startIndex + 2)
    return { nextIndex: lineEnd === -1 ? source.length : lineEnd + 1 }
  }
  if (current === "/" && source[startIndex + 1] === "*") {
    const blockEnd = source.indexOf("*/", startIndex + 2)
    return { nextIndex: blockEnd === -1 ? source.length : blockEnd + 2 }
  }
  return undefined
}

function pushJavaParameter(result: string[], parameter: string): void {
  const trimmed = parameter.trim()
  if (trimmed.length > 0) result.push(trimmed)
}

function readBalancedParentheses(source: string, openParenIndex: number): string | undefined {
  let depth = 0
  let index = openParenIndex
  while (index < source.length) {
    const token = readProtectedJavaToken(source, index)
    if (token !== undefined) {
      index = token.nextIndex
      continue
    }

    const current = source[index]
    if (current === "(") depth += 1
    if (current === ")") {
      depth -= 1
      if (depth === 0) return source.slice(openParenIndex + 1, index)
    }
    index += 1
  }
  return undefined
}
