import {
  collectJavaParameterLists,
  collectMatches,
  FIELD_ANNOTATION_PREFIX,
  getJavaFileName,
  hasJavaClassOrRecord,
  normalizeJavaParameter,
  splitJavaParameters,
  stripJavaCommentsAndStrings,
  unique,
} from "./java-source.js"

export type ControllerServiceFinding = "PASS" | "WARN" | "UNKNOWN"

export type ControllerServiceConfidence = "HIGH" | "MEDIUM"

export type ControllerServiceEvidence = {
  readonly fields: readonly string[]
  readonly constructorParameters: readonly string[]
  readonly methodCalls: readonly string[]
}

export type ControllerServiceObservation = {
  readonly finding: ControllerServiceFinding
  readonly confidence?: ControllerServiceConfidence
  readonly evidence: ControllerServiceEvidence
  readonly limitations: readonly string[]
}

export type ObserveControllerServiceDependencyInput = {
  readonly filePath: string
  readonly source: string
}

type VariableScan = {
  readonly evidence: readonly string[]
  readonly variableNames: readonly string[]
}

const STRING_BASED_LIMITATION =
  "String-based report-only observation; false positives or false negatives remain possible for unusual Java formatting."

const SERVICE_TYPE_PATTERN = String.raw`(?:[\w.]+\.)?\w*Service(?:<[^;(){}]+>)?`

// An instance field of any type: a modifier, not `static`, and a declaration
// that terminates in `=` or `;` rather than `(`, which keeps method signatures
// out. No `g` flag — `test` would otherwise carry `lastIndex` between calls.
const INSTANCE_FIELD_PATTERN = new RegExp(
  String.raw`^\s*${FIELD_ANNOTATION_PREFIX}(?:private|protected|public)\s+(?!static\b)(?:final\s+)?[\w.$]+(?:<[^;(){}]*>)?(?:\[\])?\s+\w+\s*[=;]`,
  "m",
)

export function observeControllerServiceDependency(input: ObserveControllerServiceDependencyInput): ControllerServiceObservation {
  const fileName = getJavaFileName(input.filePath)
  if (!fileName.endsWith("Controller.java")) {
    return unknownObservation("Target is not a Controller Java file.")
  }

  const className = fileName.replace(/\.java$/, "")
  const scrubbedSource = stripJavaCommentsAndStrings(input.source)
  if (!hasJavaClassOrRecord(scrubbedSource, className)) {
    return unknownObservation("Controller class declaration was not found.")
  }

  const fields = scanServiceFields(scrubbedSource)
  const constructorParameters = scanConstructorParameters(scrubbedSource, className)
  const methodCalls = scanServiceMethodCalls(scrubbedSource, [...fields.variableNames, ...constructorParameters.variableNames])
  const evidence = {
    fields: fields.evidence,
    constructorParameters: constructorParameters.evidence,
    methodCalls,
  } satisfies ControllerServiceEvidence

  if (fields.evidence.length > 0 || constructorParameters.evidence.length > 0) {
    return observation("PASS", "HIGH", evidence)
  }
  if (methodCalls.length > 0) {
    return observation("PASS", "MEDIUM", evidence)
  }
  // A Controller that injects nothing at all has no orchestration to place, so
  // "the Service layer is missing" is not something this file can show either
  // way. Spring's own reference application has two such Controllers — one
  // returns a view name, the other throws — and reporting them as a
  // high-confidence layering warning stated something untrue about them.
  if (!hasInjectedCollaborator(scrubbedSource, className)) {
    return unknownObservation("Controller injects no collaborator, so a missing Service layer cannot be observed.")
  }
  // The Controller does collaborate with something, and none of it is a
  // Service. The absence is the observation, so it is definitive.
  return observation("WARN", "HIGH", evidence)
}

/**
 * Whether the Controller injects anything at all — any instance field or any
 * constructor parameter, of any type.
 *
 * Deliberately conservative: an undetected collaborator downgrades a WARN to
 * UNKNOWN, which under-reports, while over-detecting would reinstate the false
 * positive this guards against.
 */
function hasInjectedCollaborator(source: string, className: string): boolean {
  const hasConstructorParameter = collectJavaParameterLists(source, className).some(
    (parameters) => parameters.trim().length > 0,
  )
  return hasConstructorParameter || INSTANCE_FIELD_PATTERN.test(source)
}

function observation(
  finding: ControllerServiceFinding,
  confidence: ControllerServiceConfidence | undefined,
  evidence: ControllerServiceEvidence,
): ControllerServiceObservation {
  return {
    finding,
    ...(confidence === undefined ? {} : { confidence }),
    evidence,
    limitations: [STRING_BASED_LIMITATION],
  }
}

function unknownObservation(reason: string): ControllerServiceObservation {
  return {
    finding: "UNKNOWN",
    evidence: { fields: [], constructorParameters: [], methodCalls: [] },
    limitations: [reason, STRING_BASED_LIMITATION],
  }
}

function scanServiceFields(source: string): VariableScan {
  const regex = new RegExp(
    String.raw`^\s*${FIELD_ANNOTATION_PREFIX}(?:private|protected|public)?\s*(?:static\s+)?(?:final\s+)?(${SERVICE_TYPE_PATTERN})\s+(\w+)\s*(?:[=;])`,
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
      const parameterMatch = normalizedParameter.match(new RegExp(String.raw`\b${SERVICE_TYPE_PATTERN}\s+(\w+)\b`))
      const variableName = parameterMatch?.[1]
      if (variableName) {
        evidence.push(normalizedParameter)
        variableNames.push(variableName)
      }
    }
  }

  return { evidence: unique(evidence), variableNames: unique(variableNames) }
}

function scanServiceMethodCalls(source: string, variableNames: readonly string[]): readonly string[] {
  return unique(
    variableNames.flatMap((variableName) =>
      collectMatches(source, new RegExp(String.raw`\b${variableName}\.\w+\s*\(`, "g")),
    ),
  )
}

function scanVariableDeclarations(source: string, regex: RegExp): VariableScan {
  const evidence: string[] = []
  const variableNames: string[] = []
  for (const match of source.matchAll(regex)) {
    const declaration = match[0]?.trim()
    const variableName = match[2]
    if (declaration && variableName) {
      evidence.push(declaration)
      variableNames.push(variableName)
    }
  }
  return { evidence: unique(evidence), variableNames: unique(variableNames) }
}
