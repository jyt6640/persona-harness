import { createHash } from "node:crypto"
import { join } from "node:path"

import { walkBoundedFiles } from "../io/bounded-path-walker.js"
import {
  JUNIT_RESULT_DIRS,
  JUNIT_RESULT_DISCOVERY_LIMITS,
  type JunitResultSnapshot,
} from "./junit-result-discovery.js"

export type CooperativeJUnitAssessment =
  | { readonly code: string; readonly kind: "blocked" }
  | {
      readonly digest: string
      readonly kind: "passed"
      readonly passed: number
      readonly skipped: number
      readonly testCount: number
    }

type JunitTotals = {
  readonly errors: number
  readonly failures: number
  readonly skipped: number
  readonly tests: number
}

type XmlNode = {
  readonly attributes: ReadonlyMap<string, string>
  readonly children: XmlNode[]
  readonly name: string
}

export function assessCooperativeJUnit(
  projectDir: string,
  baseline: JunitResultSnapshot,
): CooperativeJUnitAssessment {
  if (!baseline.safe) return { code: "junit-unsafe-report", kind: "blocked" }

  const walked = JUNIT_RESULT_DIRS.map((root) => walkBoundedFiles(join(projectDir, root), projectDir, {
    ...JUNIT_RESULT_DISCOVERY_LIMITS,
    displayRoot: root,
    extensions: [".xml"],
    includeText: true,
  }))
  if (walked.some((result) => !result.safe)) return { code: "junit-unsafe-report", kind: "blocked" }

  const files = walked.flatMap((result, index) => result.files.flatMap((file) => file.text === undefined
    ? []
    : [{ ref: `${JUNIT_RESULT_DIRS[index]}/${file.relativePath}`, text: file.text }]))
    .sort((left, right) => left.ref.localeCompare(right.ref))
  if (files.length === 0) return { code: "junit-missing-report", kind: "blocked" }
  if (!files.some((file) => baseline.files.get(file.ref)?.sha256 !== sha256(file.text))) {
    return { code: "junit-stale-report", kind: "blocked" }
  }

  let errors = 0
  let failures = 0
  let skipped = 0
  let tests = 0
  for (const file of files) {
    const root = parseXml(file.text)
    if (root === undefined) return { code: "junit-malformed-xml", kind: "blocked" }
    const summary = summarize(root)
    if (summary.kind === "blocked") return summary
    errors += summary.value.errors
    failures += summary.value.failures
    skipped += summary.value.skipped
    tests += summary.value.tests
  }
  if (tests === 0) return { code: "junit-zero-tests", kind: "blocked" }
  if (failures > 0 || errors > 0) return { code: "junit-failed", kind: "blocked" }
  const passed = tests - skipped
  if (passed <= 0) return { code: "junit-skipped-only", kind: "blocked" }
  return {
    digest: `sha256:${sha256(files.map((file) => `${file.ref}\u0000${file.text}`).join("\u0000"))}`,
    kind: "passed",
    passed,
    skipped,
    testCount: tests,
  }
}

function summarize(root: XmlNode): { readonly kind: "blocked"; readonly code: string } | { readonly kind: "passed"; readonly value: JunitTotals } {
  if (root.name !== "testsuite" && root.name !== "testsuites") {
    return { code: "junit-malformed-xml", kind: "blocked" }
  }
  const suites = leafSuites(root)
  if (suites.length === 0) return { code: "junit-zero-tests", kind: "blocked" }
  let errors = 0
  let failures = 0
  let skipped = 0
  let tests = 0
  for (const suite of suites) {
    const cases = suite.children.filter((child) => child.name === "testcase")
    const actual = caseTotals(cases)
    const declared = readTotals(suite, true)
    if (declared === null || declared === undefined || !sameTotals(declared, actual)) {
      return { code: "junit-accounting-mismatch", kind: "blocked" }
    }
    errors += actual.errors
    failures += actual.failures
    skipped += actual.skipped
    tests += actual.tests
  }
  const totals = { errors, failures, skipped, tests }
  const aggregate = readTotals(root, false)
  if (aggregate === undefined || (aggregate !== null && !sameTotals(aggregate, totals))) {
    return { code: "junit-accounting-mismatch", kind: "blocked" }
  }
  return { kind: "passed", value: totals }
}

function leafSuites(node: XmlNode): readonly XmlNode[] {
  const childSuites = node.children.filter((child) => child.name === "testsuite")
  const directCases = node.children.some((child) => child.name === "testcase")
  return [
    ...(directCases ? [node] : []),
    ...childSuites.flatMap(leafSuites),
  ]
}

function caseTotals(cases: readonly XmlNode[]): JunitTotals {
  let errors = 0
  let failures = 0
  let skipped = 0
  for (const testCase of cases) {
    const hasError = testCase.children.some((child) => child.name === "error")
    const hasFailure = testCase.children.some((child) => child.name === "failure")
    const hasSkipped = testCase.children.some((child) => child.name === "skipped")
    errors += hasError ? 1 : 0
    failures += hasFailure ? 1 : 0
    skipped += hasSkipped ? 1 : 0
  }
  return { errors, failures, skipped, tests: cases.length }
}

function readTotals(node: XmlNode, required: boolean): JunitTotals | null | undefined {
  const keys = ["tests", "failures", "errors", "skipped"] as const
  const present = keys.filter((key) => node.attributes.has(key))
  if (present.length === 0) return required ? undefined : null
  if (present.length !== keys.length) return undefined
  const values = keys.map((key) => integer(node.attributes.get(key)))
  if (values.some((value) => value === undefined)) return undefined
  const [tests, failures, errors, skipped] = values
  if (tests === undefined || failures === undefined || errors === undefined || skipped === undefined) return undefined
  return { errors, failures, skipped, tests }
}

function integer(value: string | undefined): number | undefined {
  if (value === undefined || !/^(?:0|[1-9][0-9]*)$/u.test(value)) return undefined
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : undefined
}

function sameTotals(left: JunitTotals, right: JunitTotals): boolean {
  return left.tests === right.tests
    && left.failures === right.failures
    && left.errors === right.errors
    && left.skipped === right.skipped
}

function parseXml(source: string): XmlNode | undefined {
  const stack: { attributes: ReadonlyMap<string, string>; children: XmlNode[]; name: string }[] = []
  let root: XmlNode | undefined
  let cursor = 0
  while (cursor < source.length) {
    const start = source.indexOf("<", cursor)
    if (start === -1) return source.slice(cursor).trim() === "" && root !== undefined && stack.length === 0 ? root : undefined
    if (stack.length === 0 && source.slice(cursor, start).trim() !== "") return undefined
    if (source.startsWith("<!--", start)) {
      const end = source.indexOf("-->", start + 4)
      if (end < 0) return undefined
      cursor = end + 3
      continue
    }
    if (source.startsWith("<![CDATA[", start)) {
      const end = source.indexOf("]]>", start + 9)
      if (end < 0 || stack.length === 0) return undefined
      cursor = end + 3
      continue
    }
    if (source.startsWith("<?", start)) {
      const end = source.indexOf("?>", start + 2)
      if (end < 0) return undefined
      cursor = end + 2
      continue
    }
    if (source.startsWith("<!", start)) return undefined
    const end = tagEnd(source, start + 1)
    if (end === undefined) return undefined
    const body = source.slice(start + 1, end).trim()
    if (body.startsWith("/")) {
      const name = body.slice(1).trim()
      const current = stack.pop()
      if (!/^[A-Za-z_][A-Za-z0-9_.:-]*$/u.test(name) || current?.name !== name) return undefined
      const node: XmlNode = current
      if (stack.length === 0) {
        if (root !== undefined) return undefined
        root = node
      } else {
        stack.at(-1)?.children.push(node)
      }
      cursor = end + 1
      continue
    }
    const selfClosing = body.endsWith("/")
    const contents = (selfClosing ? body.slice(0, -1) : body).trim()
    const match = contents.match(/^([A-Za-z_][A-Za-z0-9_.:-]*)([\s\S]*)$/u)
    if (match?.[1] === undefined || match[2] === undefined) return undefined
    const attributes = parseAttributes(match[2])
    if (attributes === undefined) return undefined
    const node = { attributes, children: [], name: match[1] }
    if (selfClosing) {
      if (stack.length === 0) {
        if (root !== undefined) return undefined
        root = node
      } else {
        stack.at(-1)?.children.push(node)
      }
    } else {
      stack.push(node)
    }
    cursor = end + 1
  }
  return root !== undefined && stack.length === 0 ? root : undefined
}

function tagEnd(source: string, start: number): number | undefined {
  let quote: "'" | "\"" | undefined
  for (let index = start; index < source.length; index += 1) {
    const character = source[index]
    if (quote === undefined && (character === "'" || character === "\"")) quote = character
    else if (quote !== undefined && character === quote) quote = undefined
    else if (quote === undefined && character === ">") return index
  }
  return undefined
}

function parseAttributes(source: string): ReadonlyMap<string, string> | undefined {
  const values = new Map<string, string>()
  let cursor = 0
  while (cursor < source.length) {
    while (/\s/u.test(source[cursor] ?? "")) cursor += 1
    if (cursor === source.length) return values
    const name = source.slice(cursor).match(/^[A-Za-z_:][A-Za-z0-9_.:-]*/u)?.[0]
    if (name === undefined || values.has(name)) return undefined
    cursor += name.length
    while (/\s/u.test(source[cursor] ?? "")) cursor += 1
    if (source[cursor] !== "=") return undefined
    cursor += 1
    while (/\s/u.test(source[cursor] ?? "")) cursor += 1
    const quote = source[cursor]
    if (quote !== "'" && quote !== "\"") return undefined
    const end = source.indexOf(quote, cursor + 1)
    if (end < 0) return undefined
    values.set(name, source.slice(cursor + 1, end))
    cursor = end + 1
  }
  return values
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}
