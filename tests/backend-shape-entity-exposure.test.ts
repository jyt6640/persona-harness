import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"

const tempProjects: string[] = []

afterEach(() => {
  while (tempProjects.length > 0) {
    const projectDir = tempProjects.pop()
    if (projectDir !== undefined) {
      rmSync(projectDir, { recursive: true, force: true })
    }
  }
})

function createTempProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-entity-exposure-test-"))
  tempProjects.push(projectDir)
  return projectDir
}

function writeFile(projectDir: string, relativePath: string, content: string): void {
  const fullPath = join(projectDir, relativePath)
  mkdirSync(join(fullPath, ".."), { recursive: true })
  writeFileSync(fullPath, content)
}

function writeGradleShell(projectDir: string): void {
  writeFileSync(join(projectDir, "settings.gradle"), "rootProject.name = 'shop'\n")
  writeFileSync(
    join(projectDir, "build.gradle"),
    [
      "plugins { id 'org.springframework.boot' version '3.5.0' }",
      "dependencies { implementation 'org.springframework.boot:spring-boot-starter-web' }",
    ].join("\n"),
  )
  writeFileSync(join(projectDir, "gradlew"), "#!/bin/sh\nexit 0\n")
}

function entityExposureRow(projectDir: string): { readonly result: string; readonly evidence: string } {
  const report = readFileSync(join(projectDir, ".persona", "workflow", "backend-shape-report.md"), "utf8")
  for (const line of report.split(/\r?\n/u)) {
    const match = /^\| (?<criterion>[^|]+) \| (?<result>PASS|WARN) \| (?<evidence>[^|]*) \|$/u.exec(line)
    if (match?.groups !== undefined && match.groups.criterion.trim() === "Entity direct exposure") {
      return { result: match.groups.result, evidence: match.groups.evidence.trim() }
    }
  }
  throw new Error("Entity direct exposure row was not found in the backend shape report.")
}

describe("backend shape entity direct exposure", () => {
  it("detects a flat-package @Entity returned straight from a Controller", () => {
    const projectDir = createTempProject()
    writeGradleShell(projectDir)
    writeFile(
      projectDir,
      "src/main/java/com/example/shop/Order.java",
      "import jakarta.persistence.Entity;\n@Entity\nclass Order { Long getId() { return 1L; } }\n",
    )
    writeFile(
      projectDir,
      "src/main/java/com/example/shop/OrderController.java",
      "import org.springframework.web.bind.annotation.RestController;\n@RestController\nclass OrderController { Order one() { return null; } }\n",
    )

    runPersonaCli(["review", "backend-shape"], { cwd: projectDir, env: {}, invocationName: "ph" })

    // The project has no `domain/` package, so the previous path-only heuristic
    // reported a clean PASS while the Controller returned the entity directly.
    expect(entityExposureRow(projectDir)).toMatchObject({ result: "WARN" })
    expect(entityExposureRow(projectDir).evidence).toContain("Order")
  })

  it("does not claim a clean boundary when no entity is recognizable", () => {
    const projectDir = createTempProject()
    writeGradleShell(projectDir)
    writeFile(
      projectDir,
      "src/main/java/com/example/shop/OrderController.java",
      "import org.springframework.web.bind.annotation.RestController;\n@RestController\nclass OrderController { String ping() { return \"ok\"; } }\n",
    )

    runPersonaCli(["review", "backend-shape"], { cwd: projectDir, env: {}, invocationName: "ph" })

    const row = entityExposureRow(projectDir)
    expect(row.result).toBe("WARN")
    expect(row.evidence).toContain("not determined")
  })

  it("passes when a recognized entity stays behind the Controller boundary", () => {
    const projectDir = createTempProject()
    writeGradleShell(projectDir)
    writeFile(
      projectDir,
      "src/main/java/com/example/shop/Order.java",
      "import jakarta.persistence.Entity;\n@Entity\nclass Order { Long getId() { return 1L; } }\n",
    )
    writeFile(
      projectDir,
      "src/main/java/com/example/shop/OrderResponse.java",
      "record OrderResponse(Long id) {}\n",
    )
    writeFile(
      projectDir,
      "src/main/java/com/example/shop/OrderController.java",
      "import org.springframework.web.bind.annotation.RestController;\n@RestController\nclass OrderController { OrderResponse one() { return null; } }\n",
    )

    runPersonaCli(["review", "backend-shape"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(entityExposureRow(projectDir)).toMatchObject({ result: "PASS" })
  })
})
