import {
  collectJavaStringLiterals,
  collectJavaParameterLists,
  collectMatches,
  escapeRegExp,
  getJavaFileName,
  hasJavaClassOrRecord,
  normalizeJavaParameter,
  splitJavaParameters,
  stripJavaComments,
  stripJavaCommentsAndStrings,
  unique,
} from "./java-source.js"

export type ControllerSqlFinding = "PASS" | "INFO" | "WARN" | "UNKNOWN"

export type ControllerSqlConfidence = "HIGH" | "MEDIUM" | "LOW"

export type ControllerSqlEvidence = {
  readonly imports: readonly string[]
  readonly fields: readonly string[]
  readonly constructorParameters: readonly string[]
  readonly methodCalls: readonly string[]
  readonly sqlLiterals: readonly string[]
}

export type ControllerSqlObservation = {
  readonly finding: ControllerSqlFinding
  readonly confidence?: ControllerSqlConfidence
  readonly evidence: ControllerSqlEvidence
  readonly limitations: readonly string[]
}

export type ObserveControllerSqlAccessInput = {
  readonly filePath: string
  readonly source: string
}

type VariableScan = {
  readonly evidence: readonly string[]
  readonly variableNames: readonly string[]
}

const STRING_BASED_LIMITATION =
  "String-based observation; false positives or false negatives remain possible for unusual Java formatting."

const SQL_LITERAL_LIMITATION =
  "SQL-like literal-only evidence is low confidence and needs additional import/type/member evidence before rule or prompt changes."

const SQL_ACCESS_TYPES = ["JdbcTemplate", "NamedParameterJdbcTemplate", "DataSource"] as const
const SQL_ACCESS_TYPE_PATTERN = `(?:[\\w.]+\\.)?(?:${SQL_ACCESS_TYPES.join("|")})`
const SQL_ACCESS_METHODS = [
  "query",
  "update",
  "queryForObject",
  "queryForList",
  "batchUpdate",
  "execute",
  "getConnection",
] as const
const MEDIUM_CONFIDENCE_VARIABLES = ["jdbcTemplate", "namedParameterJdbcTemplate", "dataSource"] as const

export function observeControllerSqlAccess(input: ObserveControllerSqlAccessInput): ControllerSqlObservation {
  const fileName = getJavaFileName(input.filePath)
  if (!fileName.endsWith("Controller.java")) {
    return unknownObservation("Target is not a Controller Java file.")
  }

  const className = fileName.replace(/\.java$/, "")
  const scrubbedSource = stripJavaCommentsAndStrings(input.source)
  if (!hasJavaClassOrRecord(scrubbedSource, className)) {
    return unknownObservation("Controller class declaration was not found.")
  }

  const imports = collectSqlAccessImports(scrubbedSource)
  const fields = scanSqlAccessFields(scrubbedSource)
  const constructorParameters = scanConstructorParameters(scrubbedSource, className)
  const highConfidenceMethodCalls = scanSqlAccessMethodCalls(scrubbedSource, [
    ...fields.variableNames,
    ...constructorParameters.variableNames,
  ])
  const mediumConfidenceMethodCalls = scanSqlAccessMethodCalls(scrubbedSource, MEDIUM_CONFIDENCE_VARIABLES).filter(
    (call) => !highConfidenceMethodCalls.includes(call),
  )
  const sqlLiterals = findSqlLikeLiterals(input.source)

  const evidence = {
    imports,
    fields: fields.evidence,
    constructorParameters: constructorParameters.evidence,
    methodCalls: highConfidenceMethodCalls.length > 0 ? highConfidenceMethodCalls : mediumConfidenceMethodCalls,
    sqlLiterals,
  } satisfies ControllerSqlEvidence

  if (hasHighConfidenceEvidence(imports, fields.evidence, constructorParameters.evidence, highConfidenceMethodCalls)) {
    return observation("WARN", "HIGH", evidence)
  }
  if (mediumConfidenceMethodCalls.length > 0) {
    return observation("WARN", "MEDIUM", evidence)
  }
  if (sqlLiterals.length > 0) {
    return observation("INFO", "LOW", evidence, [SQL_LITERAL_LIMITATION])
  }
  return observation("PASS", undefined, evidence)
}

function observation(
  finding: ControllerSqlFinding,
  confidence: ControllerSqlConfidence | undefined,
  evidence: ControllerSqlEvidence,
  extraLimitations: readonly string[] = [],
): ControllerSqlObservation {
  return {
    finding,
    ...(confidence === undefined ? {} : { confidence }),
    evidence,
    limitations: [STRING_BASED_LIMITATION, ...extraLimitations],
  }
}

function unknownObservation(reason: string): ControllerSqlObservation {
  return {
    finding: "UNKNOWN",
    evidence: {
      imports: [],
      fields: [],
      constructorParameters: [],
      methodCalls: [],
      sqlLiterals: [],
    },
    limitations: [reason, STRING_BASED_LIMITATION],
  }
}

function hasHighConfidenceEvidence(
  imports: readonly string[],
  fields: readonly string[],
  constructorParameters: readonly string[],
  methodCalls: readonly string[],
): boolean {
  return imports.length > 0 || fields.length > 0 || constructorParameters.length > 0 || methodCalls.length > 0
}

function collectSqlAccessImports(source: string): readonly string[] {
  return [
    ...collectMatches(source, /^\s*import\s+[\w.]*\.(?:JdbcTemplate|NamedParameterJdbcTemplate|DataSource)\s*;/gm),
    ...collectMatches(source, /^\s*import\s+java\.sql\.(?:\*|\w+)\s*;/gm),
  ]
}

function scanSqlAccessFields(source: string): VariableScan {
  const regex = new RegExp(
    `^\\s*(?:private|protected|public)?\\s*(?:static\\s+)?(?:final\\s+)?(${SQL_ACCESS_TYPE_PATTERN})\\s+(\\w+)\\s*(?:[=;])`,
    "gm",
  )
  return scanVariableDeclarations(source, regex)
}

function scanConstructorParameters(source: string, className: string): VariableScan {
  const evidence: string[] = []
  const variableNames: string[] = []

  for (const parameters of collectJavaParameterLists(source, className)) {
    for (const parameter of splitJavaParameters(parameters)) {
      const normalizedParameter = normalizeJavaParameter(parameter)
      const parameterMatch = normalizedParameter.match(new RegExp(`\\b${SQL_ACCESS_TYPE_PATTERN}\\s+(\\w+)\\b`))
      const variableName = parameterMatch?.[1]
      if (variableName) {
        evidence.push(normalizedParameter)
        variableNames.push(variableName)
      }
    }
  }

  return { evidence: unique(evidence), variableNames: unique(variableNames) }
}

function scanVariableDeclarations(source: string, regex: RegExp): VariableScan {
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
  return { evidence: unique(evidence), variableNames: unique(variableNames) }
}

function scanSqlAccessMethodCalls(source: string, variableNames: readonly string[]): readonly string[] {
  const evidence: string[] = []
  const methodPattern = SQL_ACCESS_METHODS.join("|")
  for (const variableName of unique(variableNames)) {
    const regex = new RegExp(`\\b${escapeRegExp(variableName)}\\s*\\.\\s*(${methodPattern})\\s*\\(`, "g")
    for (const match of source.matchAll(regex)) {
      const methodName = match[1]
      if (methodName) evidence.push(`${variableName}.${methodName}(`)
    }
  }
  return unique(evidence)
}

function findSqlLikeLiterals(source: string): readonly string[] {
  const sourceWithoutComments = stripJavaComments(source)
  const literals = collectJavaStringLiterals(sourceWithoutComments)
  return unique(literals.map(normalizeLiteral).filter(isSqlLikeLiteral))
}

function isSqlLikeLiteral(literal: string): boolean {
  return /\bSELECT\b[\s\S]*\bFROM\b/i.test(literal) ||
    /\bINSERT\s+INTO\b/i.test(literal) ||
    /\bUPDATE\b[\s\S]*\bSET\b/i.test(literal) ||
    /\bDELETE\s+FROM\b/i.test(literal)
}

function normalizeLiteral(literal: string): string {
  return literal.replace(/\s+/g, " ").trim()
}
