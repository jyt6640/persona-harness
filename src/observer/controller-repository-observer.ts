import { collectJavaParameterLists, splitJavaParameters } from "./java-source.js"

export type ObserverFinding = "PASS" | "WARN" | "UNKNOWN"

export type ControllerRepositoryEvidence = {
  readonly imports: readonly string[]
  readonly fields: readonly string[]
  readonly constructorParameters: readonly string[]
  readonly methodCalls: readonly string[]
}

export type ControllerRepositoryObservation = {
  readonly finding: ObserverFinding
  readonly evidence: ControllerRepositoryEvidence
  readonly limitations: readonly string[]
}

export type ObserveControllerRepositoryDependencyInput = {
  readonly filePath: string
  readonly source: string
}

type RepositoryVariableScan = {
  readonly evidence: readonly string[]
  readonly variableNames: readonly string[]
}

const STRING_BASED_LIMITATION =
  "String-based observation; false positives or false negatives remain possible for unusual Java formatting."

export function observeControllerRepositoryDependency(
  input: ObserveControllerRepositoryDependencyInput,
): ControllerRepositoryObservation {
  const fileName = getFileName(input.filePath)
  if (!fileName.endsWith("Controller.java")) {
    return unknownObservation("Target is not a Controller Java file.")
  }

  const className = fileName.replace(/\.java$/, "")
  const scrubbedSource = stripJavaCommentsAndStrings(input.source)
  if (!hasControllerClass(scrubbedSource, className)) {
    return unknownObservation("Controller class declaration was not found.")
  }

  const imports = collectMatches(scrubbedSource, /^\s*import\s+[\w.]*\w*Repository\w*\s*;/gm)
  const fields = scanRepositoryFields(scrubbedSource)
  const constructorParameters = scanConstructorParameters(scrubbedSource, className)
  const methodCalls = scanRepositoryMethodCalls(scrubbedSource, [
    ...fields.variableNames,
    ...constructorParameters.variableNames,
    "repository",
  ])

  const evidence = {
    imports,
    fields: fields.evidence,
    constructorParameters: constructorParameters.evidence,
    methodCalls,
  } satisfies ControllerRepositoryEvidence

  return {
    finding: hasEvidence(evidence) ? "WARN" : "PASS",
    evidence,
    limitations: [STRING_BASED_LIMITATION],
  }
}

function unknownObservation(reason: string): ControllerRepositoryObservation {
  return {
    finding: "UNKNOWN",
    evidence: {
      imports: [],
      fields: [],
      constructorParameters: [],
      methodCalls: [],
    },
    limitations: [reason, STRING_BASED_LIMITATION],
  }
}

function getFileName(filePath: string): string {
  const normalizedPath = filePath.replace(/\\/g, "/")
  const segments = normalizedPath.split("/")
  return segments[segments.length - 1] ?? normalizedPath
}

function hasControllerClass(source: string, className: string): boolean {
  return new RegExp(`\\b(?:class|record)\\s+${escapeRegExp(className)}\\b`).test(source)
}

function hasEvidence(evidence: ControllerRepositoryEvidence): boolean {
  return (
    evidence.imports.length > 0 ||
    evidence.fields.length > 0 ||
    evidence.constructorParameters.length > 0 ||
    evidence.methodCalls.length > 0
  )
}

function scanRepositoryFields(source: string): RepositoryVariableScan {
  const regex = /^\s*(?:private|protected|public)?\s*(?:static\s+)?(?:final\s+)?(\w*Repository\w*(?:\s*<[^;=]+>)?)\s+(\w+)\s*(?:[=;])/gm
  const evidence: string[] = []
  const variableNames: string[] = []

  for (const match of source.matchAll(regex)) {
    const rawMatch = match[0]?.trim()
    const variableName = match[2]
    if (rawMatch && variableName) {
      evidence.push(rawMatch)
      variableNames.push(variableName)
    }
  }

  return {
    evidence: unique(evidence),
    variableNames: unique(variableNames),
  }
}

function scanConstructorParameters(source: string, className: string): RepositoryVariableScan {
  const evidence: string[] = []
  const variableNames: string[] = []

  for (const parameters of collectJavaParameterLists(source, className)) {
    for (const parameter of splitJavaParameters(parameters)) {
      const normalizedParameter = normalizeJavaParameter(parameter)
      const parameterMatch = normalizedParameter.match(/\b\w*Repository\w*(?:\s*<[^>]+>)?\s+(\w+)\b/)
      const variableName = parameterMatch?.[1]
      if (variableName) {
        evidence.push(normalizedParameter)
        variableNames.push(variableName)
      }
    }
  }

  return {
    evidence: unique(evidence),
    variableNames: unique(variableNames),
  }
}

function normalizeJavaParameter(parameter: string): string {
  return parameter
    .replace(/@\w+(?:\([^)]*\))?\s*/g, "")
    .replace(/\bfinal\s+/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function scanRepositoryMethodCalls(source: string, variableNames: readonly string[]): readonly string[] {
  const evidence: string[] = []

  for (const variableName of unique(variableNames)) {
    const regex = new RegExp(`\\b${escapeRegExp(variableName)}\\s*\\.\\s*(\\w+)\\s*\\(`, "g")
    for (const match of source.matchAll(regex)) {
      const methodName = match[1]
      if (methodName) evidence.push(`${variableName}.${methodName}(`)
    }
  }

  return unique(evidence)
}

function collectMatches(source: string, regex: RegExp): readonly string[] {
  const matches: string[] = []
  for (const match of source.matchAll(regex)) {
    const value = match[0]?.trim()
    if (value) matches.push(value)
  }
  return unique(matches)
}

function stripJavaCommentsAndStrings(source: string): string {
  let output = ""
  let index = 0

  while (index < source.length) {
    const current = source[index]
    const next = source[index + 1]

    if (current === "/" && next === "/") {
      const stripped = stripUntilLineEnd(source, index)
      output += stripped.text
      index = stripped.nextIndex
      continue
    }

    if (current === "/" && next === "*") {
      const stripped = stripBlockComment(source, index)
      output += stripped.text
      index = stripped.nextIndex
      continue
    }

    if (current === '"' || current === "'") {
      const stripped = stripQuotedLiteral(source, index, current)
      output += stripped.text
      index = stripped.nextIndex
      continue
    }

    output += current
    index += 1
  }

  return output
}

function stripUntilLineEnd(source: string, startIndex: number): { readonly text: string; readonly nextIndex: number } {
  let text = ""
  let index = startIndex
  while (index < source.length && source[index] !== "\n") {
    text += " "
    index += 1
  }
  if (source[index] === "\n") {
    text += "\n"
    index += 1
  }
  return { text, nextIndex: index }
}

function stripBlockComment(source: string, startIndex: number): { readonly text: string; readonly nextIndex: number } {
  let text = "  "
  let index = startIndex + 2
  while (index < source.length) {
    const current = source[index]
    const next = source[index + 1]
    if (current === "*" && next === "/") {
      text += "  "
      return { text, nextIndex: index + 2 }
    }
    text += current === "\n" ? "\n" : " "
    index += 1
  }
  return { text, nextIndex: index }
}

function stripQuotedLiteral(
  source: string,
  startIndex: number,
  quote: '"' | "'",
): { readonly text: string; readonly nextIndex: number } {
  let text = " "
  let index = startIndex + 1
  let escaped = false

  while (index < source.length) {
    const current = source[index]
    text += current === "\n" ? "\n" : " "
    index += 1

    if (escaped) {
      escaped = false
      continue
    }
    if (current === "\\") {
      escaped = true
      continue
    }
    if (current === quote) return { text, nextIndex: index }
  }

  return { text, nextIndex: index }
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)]
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
