import { isAbsolute, relative, resolve } from "node:path"

import { readBoundedTextFile } from "../io/bounded-path-walker.js"

export type SemanticJUnitTestcase = {
  readonly evidence: string
  readonly identity: string
  readonly kind: "failure" | "pass"
}

export type SemanticJUnitReadResult =
  | {
      readonly ok: true
      readonly value: {
        readonly failureCases: readonly SemanticJUnitTestcase[]
        readonly passingCases: readonly SemanticJUnitTestcase[]
        readonly testCount: number
      }
    }
  | {
      readonly diagnostics: readonly string[]
      readonly ok: false
    }

export function readSemanticJUnitEvidence(projectDir: string, refs: readonly string[]): SemanticJUnitReadResult {
  const uniqueRefs = [...new Set(refs)].sort()
  const failures: string[] = []
  const failureCases: SemanticJUnitTestcase[] = []
  const passingCases: SemanticJUnitTestcase[] = []
  let testCount = 0

  for (const ref of uniqueRefs) {
    const target = resolve(projectDir, ref)
    const relativePath = relative(projectDir, target)
    if (isAbsolute(ref) || relativePath.startsWith("../") || relativePath === "..") {
      failures.push(`junit-path-invalid:${ref}`)
      continue
    }
    const read = readBoundedTextFile(target, projectDir, ref)
    if (!read.ok) {
      failures.push(`junit-read-failed:${ref}`)
      continue
    }
    const parsed = parseJUnitXml(read.text)
    testCount += parsed.testCount
    failureCases.push(...parsed.failureCases)
    passingCases.push(...parsed.passingCases)
  }

  const identities = [...failureCases, ...passingCases].map((testcase) => testcase.identity)
  const duplicateIdentity = identities.find((identity, index) => identities.indexOf(identity) !== index)
  if (duplicateIdentity !== undefined) failures.push(`junit-duplicate-testcase:${duplicateIdentity}`)
  return failures.length > 0
    ? { diagnostics: [...new Set(failures)].sort(), ok: false }
    : { ok: true, value: { failureCases, passingCases, testCount } }
}

type ParsedJUnit = {
  readonly failureCases: readonly SemanticJUnitTestcase[]
  readonly passingCases: readonly SemanticJUnitTestcase[]
  readonly testCount: number
}

function parseJUnitXml(source: string): ParsedJUnit {
  const failureCases: SemanticJUnitTestcase[] = []
  const passingCases: SemanticJUnitTestcase[] = []
  let testCount = 0
  for (const match of source.matchAll(/<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase\s*>)/gu)) {
    const attributes = readAttributes(match[1] ?? "")
    const classname = attributes.classname
    const name = attributes.name
    if (classname === undefined || name === undefined || classname.length === 0 || name.length === 0) continue
    testCount += 1
    const identity = `${classname}#${name}`
    const body = match[2] ?? ""
    const failure = readFailureEvidence(body)
    if (failure !== undefined) {
      failureCases.push({ evidence: failure, identity, kind: "failure" })
    } else if (!/<skipped\b/iu.test(body)) {
      passingCases.push({ evidence: "testcase has no failure, error, or skipped element", identity, kind: "pass" })
    }
  }
  return { failureCases, passingCases, testCount }
}

function readAttributes(source: string): Readonly<Record<string, string>> {
  const attributes: Record<string, string> = {}
  for (const match of source.matchAll(/\s+([A-Za-z_:][A-Za-z0-9_.:-]*)="([^"]*)"/gu)) {
    const key = match[1]
    const value = match[2]
    if (key !== undefined && value !== undefined) attributes[key] = value
  }
  return attributes
}

function readFailureEvidence(body: string): string | undefined {
  const paired = body.match(/<(failure|error)\b([^>]*)>([\s\S]*?)<\/\1\s*>/iu)
  if (paired !== null) {
    const evidence = `${paired[2] ?? ""} ${paired[3] ?? ""}`.trim()
    return evidence.length > 0 ? evidence : undefined
  }
  const selfClosing = body.match(/<(failure|error)\b([^>]*)\/>/iu)
  if (selfClosing !== null) {
    const evidence = (selfClosing[2] ?? "").trim()
    return evidence.length > 0 ? evidence : undefined
  }
  return undefined
}
