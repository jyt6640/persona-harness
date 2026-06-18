import type { TestContractConfidence } from "./test-contract-observer.js"
import { escapeRegExp, stripJavaCommentsAndStrings } from "./java-source.js"

export type AnchorCheck = {
  readonly anchor: string
  readonly present: boolean
  readonly confidence?: TestContractConfidence
  readonly evidence: readonly string[]
  readonly missingAnchor?: string
}

export function checkStep1Anchors(source: string, literals: readonly string[]): readonly AnchorCheck[] {
  return [
    routeAnchor("GET /reservations", "get", "/reservations", source, literals),
    routeAnchor("POST /reservations", "post", "/reservations", source, literals),
    routeAnchor("DELETE /reservations/{id}", "delete", "/reservations", source, literals),
    statusAnchor("200 OK", source),
    routeStatusAnchor("POST /reservations 200 OK", "post", "/reservations", source),
    routeStatusAnchor("DELETE /reservations/{id} 200 OK", "delete", "/reservations", source),
    idAnchor(source),
    listSizeTransitionAnchor(source),
    bodyFieldsAnchor("request body name/date/time", ["name", "date", "time"], source, literals),
  ]
}

export function checkStep23Anchors(source: string, literals: readonly string[]): readonly AnchorCheck[] {
  return [
    routeAnchor("GET /reservations", "get", "/reservations", source, literals),
    routeAnchor("POST /reservations", "post", "/reservations", source, literals),
    routeAnchor("DELETE /reservations/{id}", "delete", "/reservations", source, literals),
    routeAnchor("POST /times", "post", "/times", source, literals),
    routeAnchor("GET /times", "get", "/times", source, literals),
    routeAnchor("DELETE /times/{id}", "delete", "/times", source, literals),
    statusAnchor("200 OK", source),
    bodyFieldsAnchor("request body name/date/timeId", ["name", "date", "timeId"], source, literals),
    bodyFieldsAnchor("request body startAt", ["startAt"], source, literals),
    regexAnchor("reservation response time object", source, /\$\.time\.(?:id|startAt)|\btime\.(?:id|startAt)\b/),
    rowCountAnchor(source),
    timeCountAnchor(source),
  ]
}

function routeAnchor(
  anchor: string,
  methodName: "get" | "post" | "delete",
  route: string,
  source: string,
  literals: readonly string[],
): AnchorCheck {
  const explicitRegex = methodName === "delete"
    ? new RegExp(`\\bdelete\\s*\\(\\s*"${escapeRegExp(route)}(?:/\\d+|/\\{id\\})?"`, "i")
    : new RegExp(`\\b${methodName}\\s*\\(\\s*"${escapeRegExp(route)}"`, "i")
  if (explicitRegex.test(source)) return present(anchor, "HIGH", `${methodName}("${route}")`)

  const hasRouteConstant = literals.some((literal) => literal === route || literal.startsWith(`${route}/`))
  const helperRegex = new RegExp(`\\b${methodName}\\s*\\(\\s*[A-Z_][A-Z0-9_]*`, "i")
  if (hasRouteConstant && helperRegex.test(source)) return present(anchor, "MEDIUM", constantRouteEvidence(route))
  return missing(anchor)
}

function statusAnchor(anchor: string, source: string): AnchorCheck {
  if (hasStatusOk(source)) return present(anchor, "HIGH", "status().isOk()")
  if (/\bassertOk\s*\(/.test(source)) return present(anchor, "MEDIUM", "helper: assertOk(")
  if (/\b(?:HttpStatus\.OK|200)\b/.test(source)) return present(anchor, "MEDIUM", "status keyword: 200/OK")
  return missing(anchor)
}

function routeStatusAnchor(
  anchor: string,
  methodName: "post" | "delete",
  route: string,
  source: string,
): AnchorCheck {
  const directCall = findRouteCallIndex(methodName, route, source)
  if (directCall !== -1 && hasStatusOk(operationSegment(source, directCall))) {
    return present(anchor, "HIGH", `${methodName} ${route} status().isOk()`)
  }
  if (/\bassertOk\s*\(/.test(source)) return present(anchor, "MEDIUM", "helper: assertOk(")
  return missing(anchor)
}

function regexAnchor(anchor: string, source: string, regex: RegExp): AnchorCheck {
  const match = source.match(regex)?.[0]
  return match ? present(anchor, "HIGH", normalizeLiteral(match)) : missing(anchor)
}

function idAnchor(source: string): AnchorCheck {
  const explicitMatch = source.match(/\bjsonPath\s*\(\s*"\$\.id"\s*\)\s*\.value\s*\(\s*1\s*\)|"id"\s*:\s*1/)?.[0]
  if (explicitMatch) return present("id = 1", "HIGH", normalizeLiteral(explicitMatch))
  if (/\bassertCreatedId\s*\(\s*1\s*\)/.test(source)) return present("id = 1", "MEDIUM", "helper: assertCreatedId(1)")
  return missing("id = 1")
}

function listSizeTransitionAnchor(source: string): AnchorCheck {
  const zeroMatches = source.match(/hasSize\s*\(\s*0\s*\)|isEqualTo\s*\(\s*0\s*\)/g) ?? []
  const oneMatches = source.match(/hasSize\s*\(\s*1\s*\)|isEqualTo\s*\(\s*1\s*\)/g) ?? []
  if (zeroMatches.length >= 2 && oneMatches.length >= 1) return present("list size 0/1/0", "HIGH", "list size 0/1/0")
  if (/\bassertListTransition\s*\(\s*0\s*,\s*1\s*,\s*0\s*\)/.test(source)) {
    return present("list size 0/1/0", "MEDIUM", "helper: assertListTransition(0, 1, 0)")
  }
  return missing("list size 0/1/0")
}

function bodyFieldsAnchor(
  anchor: string,
  fields: readonly string[],
  source: string,
  literals: readonly string[],
): AnchorCheck {
  if (fields.every((field) => literals.some((literal) => literal.includes(field)))) {
    return present(anchor, "HIGH", fields.map((field) => `body field: ${field}`))
  }
  if (fields.every((field) => new RegExp(`["']${escapeRegExp(field)}["']`).test(source))) {
    return present(anchor, "MEDIUM", fields.map((field) => `helper/body field: ${field}`))
  }
  return missing(anchor)
}

function rowCountAnchor(source: string): AnchorCheck {
  const sourceWithoutStrings = stripJavaCommentsAndStrings(source)
  if (hasDirectReservationCountAssertions(source, sourceWithoutStrings)) {
    return present("reservation row count 1/0", "HIGH", "reservation row count 1/0")
  }
  if (hasReservationCountHelperAssertions(source)) {
    return present("reservation row count 1/0", "HIGH", "reservation count helper 1/0")
  }
  if (hasReservationRowCountVariableAssertions(source, sourceWithoutStrings)) {
    return present("reservation row count 1/0", "MEDIUM", "reservation rowCount variable 1/0")
  }
  return missing("reservation row count 1/0")
}

function hasDirectReservationCountAssertions(source: string, sourceWithoutStrings: string): boolean {
  return hasReservationCountSql(source) && hasExpectedOne(sourceWithoutStrings) && hasExpectedZero(sourceWithoutStrings)
}

function hasReservationCountHelperAssertions(source: string): boolean {
  const sourceWithoutStrings = stripJavaCommentsAndStrings(source)
  if (!hasCountReservationsHelperReturningReservationCount(source)) return false
  return hasExpectedForExpression(sourceWithoutStrings, "countReservations()", "1")
    && hasExpectedForExpression(sourceWithoutStrings, "countReservations()", "0")
}

function hasReservationRowCountVariableAssertions(source: string, sourceWithoutStrings: string): boolean {
  const variableNames = reservationRowCountVariableNames(source)
  return variableNames.some((variableName) =>
    hasExpectedForExpression(sourceWithoutStrings, variableName, "1")
    && hasExpectedForExpression(sourceWithoutStrings, variableName, "0"),
  )
}

function hasCountReservationsHelperReturningReservationCount(source: string): boolean {
  return /\bcountReservations\s*\([^)]*\)\s*\{[\s\S]{0,500}?\bqueryForObject\s*\(\s*"select\s+count\s*\(\s*\*\s*\)\s+from\s+reservation\b/i
    .test(source)
}

function reservationRowCountVariableNames(source: string): readonly string[] {
  const names: string[] = []
  const assignmentRegex =
    /\b(?:long|Long|int|Integer|var)\s+([A-Za-z][A-Za-z0-9_]*)\s*=\s*jdbcTemplate\s*\.\s*queryForObject\s*\(\s*"select\s+count\s*\(\s*\*\s*\)\s+from\s+reservation\b/gi
  for (const match of source.matchAll(assignmentRegex)) {
    const name = match[1]
    if (name !== undefined) names.push(name)
  }
  return names
}

function hasExpectedForExpression(source: string, expression: string, expected: "0" | "1"): boolean {
  return new RegExp(
    `\\bassertThat\\s*\\(\\s*${escapeRegExp(expression)}\\s*\\)\\s*\\.\\s*isEqualTo\\s*\\(\\s*${expected}[lL]?\\s*\\)`,
  ).test(source)
}

function hasReservationCountSql(source: string): boolean {
  return /COUNT\s*\(\s*\*\s*\)\s+FROM\s+reservation\b/i.test(source)
}

function hasExpectedOne(source: string): boolean {
  return /isEqualTo\s*\(\s*1[lL]?\s*\)/.test(source)
}

function hasExpectedZero(source: string): boolean {
  return /isEqualTo\s*\(\s*0[lL]?\s*\)/.test(source)
}

function timeCountAnchor(source: string): AnchorCheck {
  if (/\breservation_time\b/i.test(source) && /isEqualTo\s*\(\s*1\s*\)/.test(source)) {
    return present("reservation_time table or time list size 1", "HIGH", "reservation_time row count 1")
  }
  const timesCall = findRouteCallIndex("get", "/times", source)
  const hasTimeListSize = timesCall !== -1 && /hasSize\s*\(\s*1\s*\)/.test(source.slice(timesCall, timesCall + 260))
  return hasTimeListSize
    ? present("reservation_time table or time list size 1", "HIGH", "time list size 1")
    : missing("reservation_time table or time list size 1")
}

function findRouteCallIndex(methodName: "get" | "post" | "delete", route: string, source: string): number {
  const regex = methodName === "delete"
    ? new RegExp(`\\bdelete\\s*\\(\\s*"${escapeRegExp(route)}(?:/\\d+|/\\{id\\})?"`, "i")
    : new RegExp(`\\b${methodName}\\s*\\(\\s*"${escapeRegExp(route)}"`, "i")
  return source.search(regex)
}

function operationSegment(source: string, startIndex: number): string {
  const endIndex = source.indexOf(";", startIndex)
  return endIndex === -1 ? source.slice(startIndex) : source.slice(startIndex, endIndex)
}

function hasStatusOk(source: string): boolean {
  return /\bstatus\s*\(\s*\)\s*\.\s*isOk\s*\(\s*\)/.test(source)
}

function present(
  anchor: string,
  confidence: TestContractConfidence,
  evidence: string | readonly string[],
): AnchorCheck {
  return {
    anchor,
    present: true,
    confidence,
    evidence: Array.isArray(evidence) ? evidence : [evidence],
  }
}

function missing(anchor: string): AnchorCheck {
  return { anchor, present: false, evidence: [] }
}

function constantRouteEvidence(route: string): readonly string[] {
  return [`constant/helper: ${route === "/reservations" ? "RESERVATIONS" : "TIMES"}`]
}

function normalizeLiteral(literal: string): string {
  return literal.replace(/\s+/g, " ").trim()
}
