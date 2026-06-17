#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const rootDir = dirname(fileURLToPath(new URL("../package.json", import.meta.url)))
const args = new Set(process.argv.slice(2))
const noRun = args.has("--no-run")
const modelIndex = process.argv.indexOf("--model")
const model = modelIndex >= 0 ? process.argv[modelIndex + 1] : "opencode/north-mini-code-free"
const timeoutIndex = process.argv.indexOf("--timeout-ms")
const opencodeTimeoutMs = timeoutIndex >= 0 ? Number(process.argv[timeoutIndex + 1]) : 180000
const runId = new Date().toISOString().replace(/[:.]/g, "-")
const runDir = join(rootDir, "experiments", "phase0-runs", runId)
const sandboxDir = join(runDir, "sandbox")
const baselineDir = join(runDir, "sandbox-baseline")
const pluginPath = join(rootDir, "dist", "index.js")
const step1Requirements = `# 1단계: 웹 요청-응답

## 요구사항

방탈출 카페 관리자가 전화/현장 예약을 직접 등록/관리하는 상황에 필요한 예약 관리 API를 만든다.

- 별도의 데이터베이스 없이 메모리로 예약 상태를 관리한다.
- 서버를 재시작하면 데이터는 모두 사라진다.
- 화면은 만들지 않는다.
- API 동작 확인 방법은 테스트, HTTP 클라이언트 등을 활용한다.

## 예약 CRUD API

- GET /reservations: 예약 목록 조회
- POST /reservations: name, date, time으로 예약 추가
- DELETE /reservations/{id}: 예약 삭제

## 완료 테스트

- GET /reservations 요청 시 200 OK를 응답한다.
- 아직 생성 요청이 없으면 예약 목록 크기는 0이다.
- POST /reservations 요청 시 200 OK를 응답한다.
- 예약 추가 응답의 id는 1이다.
- 예약 추가 후 GET /reservations 요청 시 예약 목록 크기는 1이다.
- DELETE /reservations/1 요청 시 200 OK를 응답한다.
- 삭제 후 GET /reservations 요청 시 예약 목록 크기는 0이다.
`

const prompt = [
  "requirements.md의 # 1단계: 웹 요청-응답만 구현 대상으로 삼아라.",
  "먼저 src/main/java/com/example/reservation/ReservationController.java 파일을 read 도구로 읽어라.",
  "그 다음 방탈출 예약 CRUD API를 메모리 저장 방식으로 구현해라.",
  "Controller는 Repository, Map/List 저장 상태, id sequence를 직접 소유하거나 호출하지 말고 ReservationService 같은 Service만 주입받아 위임하라.",
  "Service는 예약 생성/목록 조회/삭제 유스케이스를 조율하고 Repository는 메모리 저장/조회/삭제와 id 발급만 담당하게 하라.",
  "이 실험의 API 계약은 REST 관습보다 요구사항을 우선한다. POST /reservations와 DELETE /reservations/{id}는 반드시 200 OK를 반환해야 하며, 201 Created나 204 No Content를 반환하면 오답이다.",
  "Spring 테스트도 구현이 만든 status를 따라가지 말고 GET/POST/DELETE의 200 OK, POST 응답의 id/name/date/time, 첫 id=1, 생성 전 목록 크기 0, 생성 후 목록 크기 1, 삭제 후 목록 크기 0을 요구사항 그대로 검증하라.",
  "화면은 만들지 말고, GET /reservations, POST /reservations, DELETE /reservations/{id} 요구사항 테스트가 통과하도록 필요한 Java/Spring 파일과 테스트를 작성해라.",
  "Spring 테스트를 작성하거나 수정할 때, 메모리 저장소 또는 static 상태가 테스트 간 공유되지 않도록 반드시 초기화하라. 각 테스트는 독립 실행 가능해야 하며, 전체 테스트 실행 순서에 의존하면 안 된다.",
  "2단계 이후 요구사항은 구현하지 마라.",
].join(" ")

function write(path, content) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

function run(command, commandArgs, options = {}) {
  return spawnSync(command, commandArgs, {
    cwd: options.cwd ?? rootDir,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 20,
    timeout: options.timeoutMs,
  })
}

function listFiles(dir, predicate = () => true) {
  const result = []
  const visit = (current) => {
    if (!existsSync(current)) return
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".git") continue
        visit(fullPath)
      } else if (predicate(fullPath)) {
        result.push(fullPath)
      }
    }
  }
  visit(dir)
  return result.sort()
}

function summarizeEvidence() {
  const evidenceDir = join(sandboxDir, ".persona", "evidence", "phase0")
  const files = listFiles(evidenceDir, (file) => file.endsWith(".json"))
  const summary = {
    count: files.length,
    byRole: {},
    byLocation: {},
    selectedRules: [],
  }

  for (const file of files) {
    const row = JSON.parse(readFileSync(file, "utf8"))
    summary.byRole[row.fileRole] = (summary.byRole[row.fileRole] ?? 0) + 1
    summary.byLocation[row.injectedInto] = (summary.byLocation[row.injectedInto] ?? 0) + 1
    for (const rule of row.selectedRules ?? []) {
      if (!summary.selectedRules.includes(rule)) {
        summary.selectedRules.push(rule)
      }
    }
  }

  return summary
}

function writeLoopTemplates() {
  write(
    join(runDir, "goal.md"),
    `# Goal

Phase 0 hook workflow가 1단계 웹 요청-응답 요구사항에서 target file, file role, selected rules, injection timing을 재현 가능하게 기록하는지 확인한다.
`,
  )

  write(
    join(runDir, "worklog.md"),
    `# Worklog

## Changed

- 실험 sandbox 생성
- .persona/rules와 harness 설정 복사
- OpenCode plugin 연결 설정 생성
- 1단계 웹 요청-응답 요구사항과 prompt 저장

## Why

- 같은 요구사항으로 injection 효과를 반복 비교하기 위해서다.

## Files

- sandbox/.opencode/opencode.json
- sandbox/.persona/harness.jsonc
- sandbox/.persona/rules/**
- requirements.md
- prompt.md

## Not Changed

- Git에 추적되는 프로젝트 소스는 이 실험 스크립트 실행만으로 수정하지 않는다.
- 2단계 이후 요구사항은 실험 범위에 넣지 않는다.
`,
  )

  write(join(runDir, "requirements.md"), `${step1Requirements}\n`)

  write(
    join(runDir, "prompt.md"),
    `# Prompt

\`\`\`text
${prompt}
\`\`\`
`,
  )

  write(
    join(runDir, "rule-selection.md"),
    `# Rule Selection

## 가져온 원칙

- clean-code/common.md
- clean-code/method-design.md
- backend/java-common.md
- file role에 맞는 backend Spring rule
- Controller/DTO/Test 작업의 step1 API contract rule

## 제외한 원칙

- profile-aware routing
- frontend rule
- infra/deploy rule
- desktop app rule
- 과도한 DDD 강제
- 특정 프로젝트 취향에 가까운 세부 구조

## 제외 이유

- Phase 0 MVP는 Java/Spring Backend 1단계 웹 요청-응답 주입 가능성 검증에 집중한다.

## 반영 파일

- .persona/rules/**
- src/phase0/rule-loader.ts
- src/phase0/injection.ts

## 리스크

- rule-loader가 frontmatter/glob을 완전히 해석하지 않는다.
- 주입 정책 수를 제한하기 때문에 일부 rule bullet은 injection block에 들어가지 않을 수 있다.
`,
  )

  write(
    join(runDir, "next-actions.md"),
    `# Next Actions

## Must

- OpenCode 실제 실행 후 API 계약 준수 여부를 analysis.md에 평가한다.
- evidence.md에 selected rules와 injection timing이 남았는지 확인한다.

## Should

- 같은 요구사항으로 반복 실행해 결과 안정성을 비교한다.

## Won't

- profile-aware, frontend, infra, benchmark routing, desktop app은 이번 MVP에서 다루지 않는다.
`,
  )

  write(join(runDir, "stdout.log"), "")
  write(join(runDir, "stderr.log"), "")
  write(join(runDir, "diff.patch"), "")
}

function createSandbox() {
  cpSync(join(rootDir, ".persona", "rules"), join(sandboxDir, ".persona", "rules"), { recursive: true })
  cpSync(join(rootDir, ".persona", "harness.jsonc"), join(sandboxDir, ".persona", "harness.jsonc"))

  write(
    join(sandboxDir, ".opencode", "opencode.json"),
    `${JSON.stringify({ plugin: [pluginPath] }, null, 2)}\n`,
  )

  write(join(sandboxDir, "requirements.md"), `${step1Requirements}\n`)

  write(
    join(sandboxDir, "pom.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.5.0</version>
        <relativePath/>
    </parent>
    <groupId>com.example</groupId>
    <artifactId>reservation-step1</artifactId>
    <version>0.0.1-SNAPSHOT</version>
    <properties>
        <java.version>21</java.version>
    </properties>
    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>
</project>
`,
  )

  write(
    join(sandboxDir, "src", "main", "java", "com", "example", "ReservationApplication.java"),
    `package com.example;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class ReservationApplication {
    public static void main(String[] args) {
        SpringApplication.run(ReservationApplication.class, args);
    }
}
`,
  )

  write(
    join(sandboxDir, "src", "main", "java", "com", "example", "reservation", "ReservationController.java"),
    `package com.example.reservation;

public class ReservationController {
}
`,
  )
}

mkdirSync(runDir, { recursive: true })
writeLoopTemplates()

const build = run("npm", ["run", "build"])
write(join(runDir, "build.stdout.log"), build.stdout)
write(join(runDir, "build.stderr.log"), build.stderr)
if (build.status !== 0) {
  throw new Error(`npm run build failed. See ${relative(rootDir, runDir)}/build.stderr.log`)
}

createSandbox()
cpSync(sandboxDir, baselineDir, { recursive: true })

let opencodeResult
if (!noRun) {
  opencodeResult = run(
    "opencode",
    [
      "run",
      "--dir",
      sandboxDir,
      "--print-logs",
      "--log-level",
      "DEBUG",
      "--model",
      model,
      "--dangerously-skip-permissions",
      "--format",
      "json",
      prompt,
    ],
    { cwd: sandboxDir, timeoutMs: opencodeTimeoutMs },
  )
  write(join(runDir, "stdout.log"), opencodeResult.stdout)
  write(join(runDir, "stderr.log"), opencodeResult.stderr || opencodeResult.error?.message || "")
}

const evidenceSummary = noRun ? { count: 0, byRole: {}, byLocation: {}, selectedRules: [] } : summarizeEvidence()
const generatedJavaFiles = listFiles(join(sandboxDir, "src"), (file) => file.endsWith(".java"))
  .map((file) => relative(sandboxDir, file))
const runOutput = `${opencodeResult?.stdout ?? ""}\n${opencodeResult?.stderr ?? ""}`
const timedOut = opencodeResult?.error?.message?.includes("ETIMEDOUT") || opencodeResult?.signal === "SIGTERM"
const buildSuccessDetected =
  runOutput.includes("BUILD SUCCESS") && /Tests run:\s+\d+,\s+Failures:\s+0,\s+Errors:\s+0/.test(runOutput)
const testFailureDetected =
  !buildSuccessDetected && (runOutput.includes("BUILD FAILURE") || runOutput.includes("There are test failures"))
const hasEvidence = evidenceSummary.count > 0
const result =
  noRun ? "UNKNOWN" : hasEvidence && !timedOut && buildSuccessDetected ? "PASS" : hasEvidence ? "WEAK" : "FAIL"
const diff = run("diff", [
  "-ruN",
  "-x",
  "node_modules",
  "-x",
  "target",
  "-x",
  "package-lock.json",
  "-x",
  "package.json",
  baselineDir,
  sandboxDir,
])
write(join(runDir, "diff.patch"), diff.stdout)

write(
  join(runDir, "evidence.md"),
  `# Evidence

## Target File

${evidenceSummary.count > 0 ? "See sandbox/.persona/evidence/phase0/*.json" : "not-run"}

## Detected File Role

\`\`\`json
${JSON.stringify(evidenceSummary.byRole, null, 2)}
\`\`\`

## Injected Rules

${evidenceSummary.selectedRules?.map((rule) => `- ${rule}`).join("\n") || "- not-run"}

## Injection Timing

\`\`\`json
${JSON.stringify(evidenceSummary.byLocation, null, 2)}
\`\`\`

## Injection Block

${evidenceSummary.count > 0 ? "Stored as metadata evidence plus tool/model output logs." : "OpenCode was not executed in this prepare run."}

## Notes

- Evidence is metadata-only.
- Full code output and logs remain inside this ignored experiment directory.
`,
)

write(
  join(runDir, "analysis.md"),
  `# Phase 0 Analysis

## Goal

Phase 0 hook workflow가 1단계 웹 요청-응답 요구사항에서 target file, file role, selected rules, injection timing을 재현 가능하게 기록하는지 확인한다.

## Result

${result}

## Requirement Compliance

${testFailureDetected ? "FAIL" : "UNKNOWN"}

## API Contract Compliance

${testFailureDetected ? "FAIL" : "UNKNOWN"}

## Clean Code Compliance

UNKNOWN

## Backend Role Compliance

UNKNOWN

## Injection Evidence

${hasEvidence ? "PASS" : "FAIL"}

\`\`\`json
${JSON.stringify(evidenceSummary, null, 2)}
\`\`\`

## Test Result

- OpenCode executed: ${noRun ? "no" : "yes"}
- OpenCode exit code: ${opencodeResult?.status ?? "not-run"}
- OpenCode signal: ${opencodeResult?.signal ?? "none"}
- OpenCode error: ${opencodeResult?.error?.message ?? "none"}
- Final Maven build success detected: ${buildSuccessDetected ? "yes" : "no"}
- Test failure detected in logs: ${testFailureDetected ? "yes" : buildSuccessDetected ? "no" : "unknown"}
- Generated Java files:
${generatedJavaFiles.map((file) => `  - ${file}`).join("\n") || "  - none"}

## Cold Assessment

${noRun ? "Prepare run only. injection 효과 검증은 아직 약하다." : hasEvidence ? "injection은 되지만 효과 검증이 약하다." : "아직 빈 하네스에 가깝다."}

## Problems

- 실제 모델 산출 품질은 prepare run만으로 판단할 수 없다.
- OpenCode가 timeout 또는 수동 중단되면 evidence와 diff가 비어 있을 수 있다.
${timedOut ? "- OpenCode 실행이 timeout으로 끝났다." : ""}
${testFailureDetected ? "- 생성된 Spring 테스트가 실패했다." : ""}

## Cause Guess

- 주입 자체는 발생했지만 모델이 테스트 격리와 Spring bean 구성까지 안정적으로 마무리하지 못했다.
- timeout이 짧으면 수정 루프가 끝나기 전에 실험이 종료될 수 있다.

## Next Loop Action

- 생성 코드의 실패 원인을 API 계약, 테스트 격리, Spring bean 구성 기준으로 분리해서 다음 prompt/rule 보강 후보를 정한다.
- OpenCode timeout 기본값과 실험 prompt 길이를 조정한다.

## Out of Scope

- profile-aware, frontend, infra, benchmark routing, desktop app
`,
)

console.log(`Experiment saved to ${relative(rootDir, runDir)}`)
