import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

const PROJECT_DIR = process.argv[2] === undefined ? process.cwd() : resolve(process.argv[2])

const FILES = {
  status: "docs/mvp-scope-status.json",
  router: "src/phase0/shared-skill-router.ts",
  types: "src/phase0/types.ts",
  settlement: "docs/phase2-scope-settlement.md",
  board: "docs/project-progress-board.md",
}

async function loadOptional(path) {
  try {
    return await readFile(resolve(PROJECT_DIR, path), "utf8")
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null
    }
    throw error
  }
}

function parseStringArray(value, fieldName) {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error(`Invalid ${fieldName}: expected string array`)
  }
  return value
}

function parseStatus(source) {
  const parsed = JSON.parse(source)
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid scope status: expected object")
  }

  return {
    mvpScope: typeof parsed.mvpScope === "string" ? parsed.mvpScope : "",
    activeSharedSkills: parseStringArray(parsed.activeSharedSkills, "activeSharedSkills"),
    inactiveVendoredReferences: parseStringArray(parsed.inactiveVendoredReferences, "inactiveVendoredReferences"),
    experimentalFileRoles: parseStringArray(parsed.experimentalFileRoles, "experimentalFileRoles"),
    parkingFileRoles: parseStringArray(parsed.parkingFileRoles, "parkingFileRoles"),
    scopeDecision: typeof parsed.scopeDecision === "string" ? parsed.scopeDecision : "",
  }
}

function extractArrayConstant(source, name) {
  const pattern = new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const`)
  const match = source.match(pattern)
  if (match === null) {
    return null
  }
  return [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1])
}

function missingTerms(source, terms) {
  return terms.filter((term) => !source.includes(term))
}

function compareArray(label, actual, expected, diagnostics) {
  if (actual.join(",") !== expected.join(",")) {
    diagnostics.push(`WARN: ${label} changed from ${expected.join(", ")} to ${actual.join(", ")}.`)
  }
}

async function main() {
  const statusSource = await loadOptional(FILES.status)
  if (statusSource === null) {
    throw new Error(`Missing required scope status file: ${FILES.status}`)
  }

  const status = parseStatus(statusSource)
  const diagnostics = []

  if (status.mvpScope !== "java-spring-backend-clean-code") {
    diagnostics.push(`WARN: mvpScope is ${status.mvpScope || "(empty)"}, expected java-spring-backend-clean-code.`)
  }
  if (status.scopeDecision !== "java-backend-mvp-first") {
    diagnostics.push(`WARN: scopeDecision is ${status.scopeDecision || "(empty)"}, expected java-backend-mvp-first.`)
  }

  const router = await loadOptional(FILES.router)
  if (router !== null) {
    const activeSkills = extractArrayConstant(router, "ACTIVE_SHARED_SKILL_NAMES")
    const inactiveSkills = extractArrayConstant(router, "INACTIVE_VENDORED_SHARED_SKILL_NAMES")

    if (activeSkills === null) {
      diagnostics.push("WARN: ACTIVE_SHARED_SKILL_NAMES was not found in shared-skill-router.ts.")
    } else {
      compareArray("active shared skills", activeSkills, status.activeSharedSkills, diagnostics)
    }

    if (inactiveSkills === null) {
      diagnostics.push("WARN: INACTIVE_VENDORED_SHARED_SKILL_NAMES was not found in shared-skill-router.ts.")
    } else {
      for (const skill of status.inactiveVendoredReferences) {
        if (!inactiveSkills.includes(skill)) {
          diagnostics.push(`WARN: ${skill} is not listed as an inactive vendored reference in shared-skill-router.ts.`)
        }
      }
    }
  } else {
    diagnostics.push("INFO: shared-skill-router.ts is absent; skipped source-router comparison.")
  }

  const types = await loadOptional(FILES.types)
  if (types !== null) {
    for (const role of [...status.experimentalFileRoles, ...status.parkingFileRoles]) {
      if (!types.includes(`| "${role}"`)) {
        diagnostics.push(`INFO: FileRole ${role} is absent; scope may have narrowed.`)
      }
    }
  } else {
    diagnostics.push("INFO: types.ts is absent; skipped FileRole comparison.")
  }

  const settlement = await loadOptional(FILES.settlement)
  if (settlement !== null) {
    const missing = missingTerms(settlement, [
      "Java/Spring backend Clean Code injection",
      "experimental",
      "parking",
      "inactive reference",
    ])
    if (missing.length > 0) {
      diagnostics.push(`WARN: phase2 scope settlement is missing required scope terms: ${missing.join(", ")}.`)
    }
  } else {
    diagnostics.push("INFO: phase2 scope settlement doc is absent; skipped settlement comparison.")
  }

  const board = await loadOptional(FILES.board)
  if (board !== null) {
    const missing = missingTerms(board, [
      "limited active routing",
      "experimental",
      "parking surfaces",
      "inactive references",
    ])
    if (missing.length > 0) {
      diagnostics.push(`WARN: progress board is missing required scope terms: ${missing.join(", ")}.`)
    }
  } else {
    diagnostics.push("INFO: progress board is absent; skipped board comparison.")
  }

  const finding = diagnostics.some((item) => item.startsWith("WARN")) ? "WARN" : "PASS"
  console.log(`MVP scope diagnostics finding: ${finding}`)
  console.log(`MVP scope diagnostics count: ${diagnostics.length}`)
  if (diagnostics.length > 0) {
    console.log("")
    for (const diagnostic of diagnostics) {
      console.log(`- ${diagnostic}`)
    }
  }
  console.log("")
  console.log("This is diagnostics-only. It does not block build, tests, packaging, or injection.")
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
