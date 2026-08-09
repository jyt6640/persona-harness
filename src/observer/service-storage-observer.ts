import {
  collectJavaStringLiterals,
  collectJavaParameterLists,
  escapeRegExp,
  getJavaFileName,
  hasJavaClassOrRecord,
  normalizeJavaParameter,
  splitJavaParameters,
  stripJavaComments,
  stripJavaCommentsAndStrings,
  unique,
} from "./java-source.js"

export type ServiceStorageFinding = "PASS" | "INFO" | "WARN" | "UNKNOWN"

export type ServiceStorageConfidence = "HIGH" | "MEDIUM" | "LOW"

export type ServiceStorageEvidence = {
  readonly storageFields: readonly string[]
  readonly sequenceFields: readonly string[]
  readonly constructorParameters: readonly string[]
  readonly mutationCalls: readonly string[]
  readonly literalOnly: readonly string[]
}

export type ServiceStorageObservation = {
  readonly finding: ServiceStorageFinding
  readonly confidence?: ServiceStorageConfidence
  readonly evidence: ServiceStorageEvidence
  readonly limitations: readonly string[]
}

export type ObserveServiceStorageOwnershipInput = {
  readonly filePath: string
  readonly source: string
}

type VariableScan = {
  readonly evidence: readonly string[]
  readonly variableNames: readonly string[]
}

const STRING_BASED_LIMITATION =
  "String-based report-only observation; false positives or false negatives remain possible for unusual Java formatting."

const LITERAL_ONLY_LIMITATION =
  "Storage-like literal-only evidence is low confidence and must not be treated as a rule, prompt, or enforcement signal."

const STORAGE_TYPES = ["Map", "HashMap", "ConcurrentHashMap", "List", "ArrayList", "Set", "HashSet"] as const
const SEQUENCE_TYPES = ["AtomicLong", "AtomicInteger", "long", "Long", "int", "Integer"] as const
const SEQUENCE_NAMES = ["nextId", "idCounter", "sequence"] as const
const MUTATION_METHODS = ["put", "remove", "clear", "getAndIncrement", "incrementAndGet"] as const
const STORAGE_NAME_HINT = /(?:storage|store|cache|map|list|set|reservations|times|items|entities|records)$/i

/**
 * An instance field carries an access modifier; a local variable inside a method
 * body does not. The modifier used to be optional here, which was invisible
 * while this observer only ever saw `*Service.java` — an interface has no method
 * bodies to mismatch. Extending it to `*ServiceImpl.java` made every
 * `List<Foo> itemList = ...` inside a method look like Service-owned storage.
 *
 * Requiring the modifier misses a package-private field, which under-reports.
 * That is the safe direction: the alternative reinstates the false positives.
 */
const FIELD_MODIFIER = "(?:private|protected|public)\\s+"

/**
 * Type arguments on one line only. `[^;=]` previously matched newlines, so a
 * method signature could be swallowed whole and reported as a field.
 */
const FIELD_GENERIC_ARGUMENTS = "<[^;=(){}\\n]*>"
const LITERAL_STORAGE_WORD = /\b(?:Map|List|AtomicLong|nextId|idCounter|sequence|storage|store|put|remove|clear)\b/i

export function observeServiceStorageOwnership(input: ObserveServiceStorageOwnershipInput): ServiceStorageObservation {
  const fileName = getJavaFileName(input.filePath)
  // `FooService` + `FooServiceImpl` is the dominant Spring shape, and the
  // implementation is where fields and state live — the interface has neither.
  // Matching only `*Service.java` meant that in a codebase written that way this
  // observer inspected the one file that structurally cannot own storage and
  // never looked at the one that can.
  if (!fileName.endsWith("Service.java") && !fileName.endsWith("ServiceImpl.java")) {
    return unknownObservation("Target is not a Service Java file.")
  }

  const className = fileName.replace(/\.java$/, "")
  const scrubbedSource = stripJavaCommentsAndStrings(input.source)
  if (!hasJavaClassOrRecord(scrubbedSource, className)) {
    return unknownObservation("Service Java class or record was not recognized.")
  }

  const storageFields = scanStorageFields(scrubbedSource)
  const sequenceFields = scanSequenceFields(scrubbedSource)
  const constructorParameters = scanSequenceConstructorParameters(scrubbedSource, className)
  const mutationCalls = scanMutationCalls(scrubbedSource, [
    ...storageFields.variableNames,
    ...sequenceFields.variableNames,
    ...constructorParameters.variableNames,
    ...SEQUENCE_NAMES,
  ])
  const literalOnly = findStorageLikeLiterals(input.source)

  const evidence = {
    storageFields: storageFields.evidence,
    sequenceFields: sequenceFields.evidence,
    constructorParameters: constructorParameters.evidence,
    mutationCalls,
    literalOnly,
  } satisfies ServiceStorageEvidence

  if (
    storageFields.evidence.length > 0 ||
    sequenceFields.evidence.length > 0 ||
    constructorParameters.evidence.length > 0
  ) {
    return observation("WARN", "HIGH", evidence)
  }
  if (mutationCalls.length > 0) {
    return observation("WARN", "MEDIUM", evidence)
  }
  if (literalOnly.length > 0) {
    return observation("INFO", "LOW", evidence, [LITERAL_ONLY_LIMITATION])
  }
  // As above: a WARN cites storage fields, sequence fields, constructor
  // parameters, or mutation calls, while a PASS records only their absence.
  // MEDIUM matches the sibling observers rather than reporting no confidence at
  // all.
  return observation("PASS", "MEDIUM", evidence)
}

function observation(
  finding: ServiceStorageFinding,
  confidence: ServiceStorageConfidence | undefined,
  evidence: ServiceStorageEvidence,
  extraLimitations: readonly string[] = [],
): ServiceStorageObservation {
  return {
    finding,
    ...(confidence === undefined ? {} : { confidence }),
    evidence,
    limitations: [STRING_BASED_LIMITATION, ...extraLimitations],
  }
}

function unknownObservation(reason: string): ServiceStorageObservation {
  return {
    finding: "UNKNOWN",
    evidence: {
      storageFields: [],
      sequenceFields: [],
      constructorParameters: [],
      mutationCalls: [],
      literalOnly: [],
    },
    limitations: [reason, STRING_BASED_LIMITATION],
  }
}

function scanStorageFields(source: string): VariableScan {
  const typePattern = STORAGE_TYPES.join("|")
  const regex = new RegExp(
    `^\\s*${FIELD_MODIFIER}(?:static\\s+)?(?:final\\s+)?(${typePattern})(?:\\s*${FIELD_GENERIC_ARGUMENTS})?\\s+(\\w+)\\s*(?:[=;])`,
    "gm",
  )
  const evidence: string[] = []
  const variableNames: string[] = []

  for (const match of source.matchAll(regex)) {
    const rawMatch = match[0]?.trim()
    const storageType = match[1]
    const variableName = match[2]
    if (!rawMatch || !storageType || !variableName) continue
    if (storageType === "List" || storageType === "ArrayList" || storageType === "Set" || storageType === "HashSet") {
      if (!STORAGE_NAME_HINT.test(variableName)) continue
    }
    evidence.push(rawMatch)
    variableNames.push(variableName)
  }

  return { evidence: unique(evidence), variableNames: unique(variableNames) }
}

function scanSequenceFields(source: string): VariableScan {
  const typePattern = SEQUENCE_TYPES.join("|")
  const namePattern = SEQUENCE_NAMES.join("|")
  const regex = new RegExp(
    `^\\s*${FIELD_MODIFIER}(?:static\\s+)?(?:final\\s+)?(?:${typePattern})\\s+(${namePattern})\\s*(?:[=;])`,
    "gm",
  )
  return scanFieldDeclarations(source, regex)
}

function scanSequenceConstructorParameters(source: string, className: string): VariableScan {
  const evidence: string[] = []
  const variableNames: string[] = []
  const typePattern = SEQUENCE_TYPES.join("|")
  const namePattern = SEQUENCE_NAMES.join("|")

  for (const parameters of collectJavaParameterLists(source, className)) {
    for (const parameter of splitJavaParameters(parameters)) {
      const normalizedParameter = normalizeJavaParameter(parameter)
      const parameterMatch = normalizedParameter.match(new RegExp(`\\b(?:${typePattern})\\s+(${namePattern})\\b`))
      const variableName = parameterMatch?.[1]
      if (variableName) {
        evidence.push(normalizedParameter)
        variableNames.push(variableName)
      }
    }
  }

  return { evidence: unique(evidence), variableNames: unique(variableNames) }
}

function scanFieldDeclarations(source: string, regex: RegExp): VariableScan {
  const evidence: string[] = []
  const variableNames: string[] = []
  for (const match of source.matchAll(regex)) {
    const rawMatch = match[0]?.trim()
    const variableName = match[1]
    if (rawMatch && variableName) {
      evidence.push(rawMatch)
      variableNames.push(variableName)
    }
  }
  return { evidence: unique(evidence), variableNames: unique(variableNames) }
}

function scanMutationCalls(source: string, variableNames: readonly string[]): readonly string[] {
  const variablePattern = unique(variableNames).map(escapeRegExp).join("|")
  if (!variablePattern) return []

  const evidence: string[] = []
  const methodPattern = MUTATION_METHODS.join("|")
  const regex = new RegExp(`\\b(${variablePattern})\\s*\\.\\s*(${methodPattern})\\s*\\(`, "g")
  for (const match of source.matchAll(regex)) {
    const variableName = match[1]
    const methodName = match[2]
    if (variableName && methodName) evidence.push(`${variableName}.${methodName}(`)
  }
  return unique(evidence)
}

function findStorageLikeLiterals(source: string): readonly string[] {
  const sourceWithoutComments = stripJavaComments(source)
  const literals = collectJavaStringLiterals(sourceWithoutComments)
  return unique(literals.map(normalizeLiteral).filter((literal) => LITERAL_STORAGE_WORD.test(literal)))
}

function normalizeLiteral(literal: string): string {
  return literal.replace(/\s+/g, " ").trim()
}
