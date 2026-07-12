const CONTROL_FLOW_NAMES = new Set(["catch", "for", "if", "switch", "synchronized", "while"])

export function parseJavaStructure(source) {
  const tokens = tokenizeJava(source)
  const imports = readImports(tokens)
  const parenthesisPairs = matchingPairs(tokens, "(", ")")
  const bracePairs = matchingPairs(tokens, "{", "}")
  const methods = []

  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index].value !== "{") continue
    const bodyCloseIndex = bracePairs.get(index)
    if (bodyCloseIndex === undefined) continue
    const method = methodAtBody(tokens, index, bodyCloseIndex, parenthesisPairs, imports)
    if (method !== undefined) methods.push(method)
  }

  return { methods, tokens }
}

export function methodContainingOffset(structure, offset) {
  let selected

  for (const method of structure.methods) {
    if (method.bodyStartOffset > offset || offset >= method.bodyEndOffset) continue
    if (selected === undefined || method.bodyEndOffset - method.bodyStartOffset < selected.bodyEndOffset - selected.bodyStartOffset) {
      selected = method
    }
  }

  return selected
}

export function isBlankStringLiteral(token) {
  if (token.kind !== "string") return false
  return decodeJavaString(token.value).trim().length === 0
}

function methodAtBody(tokens, bodyOpenIndex, bodyCloseIndex, parenthesisPairs, imports) {
  const closeParenthesisIndex = methodClosingParenthesis(tokens, bodyOpenIndex, parenthesisPairs)
  if (closeParenthesisIndex === undefined) return undefined

  const openParenthesisIndex = parenthesisPairs.get(closeParenthesisIndex)
  if (openParenthesisIndex === undefined) return undefined
  const nameToken = tokens[openParenthesisIndex - 1]
  const tokenBeforeName = tokens[openParenthesisIndex - 2]

  if (
    nameToken === undefined ||
    nameToken.kind !== "identifier" ||
    CONTROL_FLOW_NAMES.has(nameToken.value) ||
    tokenBeforeName?.value === "new"
  ) {
    return undefined
  }

  const memberStart = memberStartIndex(tokens, openParenthesisIndex)
  return {
    annotations: annotationsInRange(tokens, memberStart, openParenthesisIndex, parenthesisPairs, imports),
    bodyCloseIndex,
    bodyEndOffset: tokens[bodyCloseIndex].end,
    bodyOpenIndex,
    bodyStartOffset: tokens[bodyOpenIndex].start,
    name: nameToken.value,
  }
}

function methodClosingParenthesis(tokens, bodyOpenIndex, parenthesisPairs) {
  for (let index = bodyOpenIndex - 1; index >= 0; index -= 1) {
    const token = tokens[index]
    if (token.value === ";" || token.value === "{" || token.value === "}") return undefined
    if (token.value !== ")") continue

    const openParenthesisIndex = parenthesisPairs.get(index)
    if (openParenthesisIndex === undefined) continue
    const nameToken = tokens[openParenthesisIndex - 1]
    if (nameToken?.kind === "identifier" && !CONTROL_FLOW_NAMES.has(nameToken.value)) {
      return index
    }
  }

  return undefined
}

function memberStartIndex(tokens, openParenthesisIndex) {
  for (let index = openParenthesisIndex - 1; index >= 0; index -= 1) {
    if (tokens[index].value === ";" || tokens[index].value === "{" || tokens[index].value === "}") {
      return index + 1
    }
  }
  return 0
}

function annotationsInRange(tokens, startIndex, endIndex, parenthesisPairs, imports) {
  const annotations = []

  for (let index = startIndex; index < endIndex; index += 1) {
    if (tokens[index].value !== "@") continue
    const annotation = annotationAt(tokens, index, parenthesisPairs, imports)
    if (annotation === undefined) continue
    annotations.push(annotation)
    index = annotation.endIndex
  }

  return annotations
}

function annotationAt(tokens, atIndex, parenthesisPairs, imports) {
  const nameParts = []
  let index = atIndex + 1

  while (tokens[index]?.kind === "identifier") {
    nameParts.push(tokens[index].value)
    index += 1
    if (tokens[index]?.value !== ".") break
    index += 1
  }

  if (nameParts.length === 0) return undefined
  const argumentOpenIndex = tokens[index]?.value === "(" ? index : undefined
  const argumentCloseIndex = argumentOpenIndex === undefined ? undefined : parenthesisPairs.get(argumentOpenIndex)
  if (argumentOpenIndex !== undefined && argumentCloseIndex === undefined) return undefined

  return {
    argumentTokens: argumentOpenIndex === undefined ? undefined : tokens.slice(argumentOpenIndex + 1, argumentCloseIndex),
    endIndex: argumentCloseIndex ?? index - 1,
    qualifiedName: resolveAnnotationName(nameParts.join("."), imports),
  }
}

function resolveAnnotationName(name, imports) {
  if (name.includes(".")) return name
  return imports.get(name) ?? name
}

function readImports(tokens) {
  const imports = new Map()

  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index].value !== "import") continue
    let cursor = index + 1
    const isStatic = tokens[cursor]?.value === "static"
    if (isStatic) cursor += 1
    const parts = []

    while (tokens[cursor] !== undefined && tokens[cursor].value !== ";") {
      if (tokens[cursor].kind === "identifier") parts.push(tokens[cursor].value)
      cursor += 1
    }
    index = cursor

    if (isStatic || parts.length === 0) continue
    imports.set(parts.at(-1), parts.join("."))
  }

  return imports
}

function matchingPairs(tokens, opening, closing) {
  const stack = []
  const pairs = new Map()

  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index].value === opening) stack.push(index)
    if (tokens[index].value !== closing) continue
    const openIndex = stack.pop()
    if (openIndex !== undefined) {
      pairs.set(openIndex, index)
      pairs.set(index, openIndex)
    }
  }

  return pairs
}

function tokenizeJava(source) {
  const tokens = []
  let index = 0

  while (index < source.length) {
    const character = source[index]

    if (isWhitespace(character)) {
      index += 1
      continue
    }
    if (source.startsWith("//", index)) {
      index = skipLineComment(source, index + 2)
      continue
    }
    if (source.startsWith("/*", index)) {
      index = skipBlockComment(source, index + 2)
      continue
    }
    if (character === "\"" || character === "'") {
      const end = quotedEnd(source, index, character)
      tokens.push({ end, kind: character === "\"" ? "string" : "character", start: index, value: source.slice(index, end) })
      index = end
      continue
    }
    if (isIdentifierStart(character)) {
      const end = identifierEnd(source, index + 1)
      tokens.push({ end, kind: "identifier", start: index, value: source.slice(index, end) })
      index = end
      continue
    }
    if (isDigit(character)) {
      const end = numberEnd(source, index + 1)
      tokens.push({ end, kind: "number", start: index, value: source.slice(index, end) })
      index = end
      continue
    }

    tokens.push({ end: index + 1, kind: "symbol", start: index, value: character })
    index += 1
  }

  return tokens
}

function skipLineComment(source, index) {
  const lineEnd = source.indexOf("\n", index)
  return lineEnd === -1 ? source.length : lineEnd + 1
}

function skipBlockComment(source, index) {
  const commentEnd = source.indexOf("*/", index)
  if (commentEnd === -1) throw new Error("Unterminated Java block comment")
  return commentEnd + 2
}

function quotedEnd(source, start, quote) {
  for (let index = start + 1; index < source.length; index += 1) {
    if (source[index] === "\\") {
      index += 1
      continue
    }
    if (source[index] === quote) return index + 1
  }
  throw new Error("Unterminated Java string or character literal")
}

function identifierEnd(source, index) {
  let cursor = index
  while (cursor < source.length && isIdentifierPart(source[cursor])) cursor += 1
  return cursor
}

function numberEnd(source, index) {
  let cursor = index
  while (cursor < source.length && /[A-Za-z0-9_.]/u.test(source[cursor])) cursor += 1
  return cursor
}

function isWhitespace(value) {
  return /\s/u.test(value)
}

function isIdentifierStart(value) {
  return /[A-Za-z_$]/u.test(value)
}

function isIdentifierPart(value) {
  return /[A-Za-z0-9_$]/u.test(value)
}

function isDigit(value) {
  return /[0-9]/u.test(value)
}

function decodeJavaString(value) {
  let decoded = ""

  for (let index = 1; index < value.length - 1; index += 1) {
    if (value[index] !== "\\") {
      decoded += value[index]
      continue
    }

    index += 1
    const escaped = value[index]
    const replacements = {
      b: "\b",
      f: "\f",
      n: "\n",
      r: "\r",
      s: " ",
      t: "\t",
    }
    decoded += replacements[escaped] ?? escaped
  }

  return decoded
}
