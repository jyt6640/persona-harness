import { getJavaFileName, hasJavaClassOrRecord, stripJavaCommentsAndStrings } from "./java-source.js"

export type DtoBoundaryFinding = "PASS" | "WARN" | "UNKNOWN"

export type DtoBoundaryConfidence = "MEDIUM"

export type DtoBoundaryRole = "request" | "response" | "dto"

export type DtoBoundaryEvidence = {
  readonly className: string
  readonly role: DtoBoundaryRole
  readonly namingEvidence: readonly string[]
}

export type DtoBoundaryObservation = {
  readonly finding: DtoBoundaryFinding
  readonly confidence?: DtoBoundaryConfidence
  readonly evidence: DtoBoundaryEvidence
  readonly limitations: readonly string[]
}

export type ObserveDtoBoundaryInput = {
  readonly filePath: string
  readonly source: string
}

const STRING_BASED_LIMITATION =
  "String-based DTO boundary observation; false positives or false negatives remain possible for unusual Java formatting."

export function observeDtoBoundary(input: ObserveDtoBoundaryInput): DtoBoundaryObservation {
  const fileName = getJavaFileName(input.filePath)
  const className = fileName.replace(/\.java$/, "")
  const role = dtoRole(fileName)
  if (role === undefined) {
    return unknownObservation(className, "Target is not a request/response/DTO Java file.")
  }

  const scrubbedSource = stripJavaCommentsAndStrings(input.source)
  if (!hasJavaClassOrRecord(scrubbedSource, className)) {
    return unknownObservation(className, "DTO class or record declaration was not found.")
  }

  return {
    finding: role === "dto" ? "WARN" : "PASS",
    ...(role === "dto" ? {} : { confidence: "MEDIUM" as const }),
    evidence: {
      className,
      role,
      namingEvidence: [fileName],
    },
    limitations: [STRING_BASED_LIMITATION],
  }
}

function unknownObservation(className: string, reason: string): DtoBoundaryObservation {
  return {
    finding: "UNKNOWN",
    evidence: { className, role: "dto", namingEvidence: [] },
    limitations: [reason, STRING_BASED_LIMITATION],
  }
}

function dtoRole(fileName: string): DtoBoundaryRole | undefined {
  if (/Request\.java$/.test(fileName)) return "request"
  if (/Response\.java$/.test(fileName)) return "response"
  if (/(?:Dto|DTO)\.java$/.test(fileName)) return "dto"
  return undefined
}
