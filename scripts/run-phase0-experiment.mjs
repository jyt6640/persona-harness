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
const opencodeTimeoutMs = timeoutIndex >= 0 ? Number(process.argv[timeoutIndex + 1]) : 300000
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
  "1단계 메모리 구현이어도 Repository를 생략하지 마라. Service 안에 List/Map 저장소, nextId, AtomicLong, id sequence를 두면 역할 분리 실패다.",
  "Repository는 ReservationRepository interface와 @Repository InMemoryReservationRepository 구현체로 분리하고, concrete ReservationRepository 클래스 하나로 저장 상태와 계약을 합치지 마라.",
  "id 발급은 Repository save 또는 in-memory Repository 구현에서 수행하고, Service는 생성 흐름을 조율한 뒤 저장 결과를 응답으로 반환하라.",
  "이 실험의 API 계약은 REST 관습보다 요구사항을 우선한다. POST /reservations와 DELETE /reservations/{id}는 반드시 200 OK를 반환해야 하며, 201 Created나 204 No Content를 반환하면 오답이다.",
  "Spring 테스트도 구현이 만든 status를 따라가지 말고 GET/POST/DELETE의 200 OK, POST 응답의 id/name/date/time, 첫 id=1, 생성 전 목록 크기 0, 생성 후 목록 크기 1, 삭제 후 목록 크기 0을 요구사항 그대로 검증하라.",
  "화면은 만들지 말고, GET /reservations, POST /reservations, DELETE /reservations/{id} 요구사항 테스트가 통과하도록 필요한 Java/Spring 파일과 테스트를 작성해라.",
  "Spring 테스트를 작성하거나 수정할 때, 메모리 저장소 또는 static 상태가 테스트 간 공유되지 않도록 @BeforeEach에서 Repository clear/reset을 직접 호출해 저장 데이터와 id sequence를 함께 초기화하라. HTTP DELETE로 테스트 초기화를 대신하지 마라.",
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

Phase 0 실험이 rate limit 또는 timeout으로 중단되지 않고 완주 run을 확보할 수 있도록, 실험 실행 조건을 최소 안정화한다.
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

- 같은 요구사항으로 injection 효과를 반복 비교하려면 먼저 timeout/rate-limit run과 완주 run을 명확히 구분해야 한다.
- timeout/rate-limit run은 backend 품질 샘플로 쓰지 않는다.

## Files

- sandbox/.opencode/opencode.json
- sandbox/.persona/harness.jsonc
- sandbox/.persona/rules/**
- requirements.md
- prompt.md

## Not Changed

- Git에 추적되는 프로젝트 소스는 이 실험 스크립트 실행만으로 수정하지 않는다.
- 2단계 이후 요구사항은 실험 범위에 넣지 않는다.
- backend rule/prompt를 drift 기준으로 보강하지 않는다.
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

- OpenCode 실제 실행이 완주했는지, timeout/rate-limit로 중단됐는지 analysis.md에 명확히 기록한다.
- timeout/rate-limit run은 backend 품질 샘플에서 제외한다.
- 완주 run을 확보한 뒤에만 생성 Java/Spring 품질을 평가한다.

## Should

- retry 자동화가 필요한지 다음 loop에서 판단한다.

## Won't

- profile-aware, frontend, infra, benchmark routing, desktop app은 이번 MVP에서 다루지 않는다.
- backend rule/prompt를 drift 기준으로 보강하지 않는다.
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

const { detectBackendDrift, formatDriftReport } = await import("../dist/phase0/drift-detector.js")

createSandbox()
cpSync(sandboxDir, baselineDir, { recursive: true })

let opencodeResult
let opencodeStartedAt = 0
let opencodeEndedAt = 0
if (!noRun) {
  opencodeStartedAt = Date.now()
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
  opencodeEndedAt = Date.now()
  write(join(runDir, "stdout.log"), opencodeResult.stdout)
  write(
    join(runDir, "stderr.log"),
    [
      opencodeResult.stderr,
      opencodeResult.error?.message ? `[runner error] ${opencodeResult.error.message}` : "",
      `[runner summary] exit=${opencodeResult.status ?? "not-run"} signal=${opencodeResult.signal ?? "none"} elapsedMs=${opencodeEndedAt - opencodeStartedAt} timeoutMs=${opencodeTimeoutMs}`,
    ].filter(Boolean).join("\n"),
  )
}

const evidenceSummary = noRun ? { count: 0, byRole: {}, byLocation: {}, selectedRules: [] } : summarizeEvidence()
const generatedJavaFiles = listFiles(join(sandboxDir, "src"), (file) => file.endsWith(".java"))
  .map((file) => relative(sandboxDir, file))
const runOutput = `${opencodeResult?.stdout ?? ""}\n${opencodeResult?.stderr ?? ""}\n${opencodeResult?.error?.message ?? ""}`
const timedOut = opencodeResult?.error?.message?.includes("ETIMEDOUT") || opencodeResult?.signal === "SIGTERM"
const rateLimited = /rate limit|rate_limit|too many requests/i.test(runOutput)
const opencodeElapsedMs = noRun ? 0 : opencodeEndedAt - opencodeStartedAt
const completionClassifications = [
  !noRun && rateLimited ? "Rate Limit" : undefined,
  !noRun && timedOut ? "Timeout" : undefined,
  !noRun && !rateLimited && !timedOut && opencodeResult?.status === 0 ? "Completed" : undefined,
].filter(Boolean)
if (!noRun && completionClassifications.length === 0) {
  completionClassifications.push("Unknown")
}
const buildSuccessDetected =
  runOutput.includes("BUILD SUCCESS") && /Tests run:\s+\d+,\s+Failures:\s+0,\s+Errors:\s+0/.test(runOutput)
const testFailureDetected =
  !buildSuccessDetected && (runOutput.includes("BUILD FAILURE") || runOutput.includes("There are test failures"))
const qualitySampleUsable = !noRun && !timedOut && !rateLimited && opencodeResult?.status === 0 && buildSuccessDetected
const hasEvidence = evidenceSummary.count > 0
const driftReport = detectBackendDrift({
  sandboxDir,
  runOutput,
  timedOut,
  buildSuccessDetected,
  testFailureDetected,
})
const result =
  noRun
    ? "UNKNOWN"
    : rateLimited
      ? "RATE_LIMIT"
      : timedOut
        ? "TIMEOUT"
        : hasEvidence && buildSuccessDetected && !driftReport.hasFail
      ? "PASS"
      : hasEvidence
        ? "WEAK"
        : "FAIL"
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
write(join(runDir, "drift-report.md"), formatDriftReport(driftReport))

write(
  join(runDir, "evidence.md"),
  `# Evidence

## Target File

${evidenceSummary.count > 0 ? "See sandbox/.persona/evidence/phase0/*.json" : noRun ? "not-run" : "no evidence recorded"}

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

${evidenceSummary.count > 0 ? "Stored as metadata evidence plus tool/model output logs." : noRun ? "OpenCode was not executed in this prepare run." : "OpenCode executed, but no injection evidence was recorded before completion failure."}

## Notes

- Evidence is metadata-only.
- Full code output and logs remain inside this ignored experiment directory.

## Runner

- Timeout option: ${opencodeTimeoutMs} ms
- OpenCode elapsed time: ${opencodeElapsedMs} ms
- OpenCode exit code: ${opencodeResult?.status ?? "not-run"}
- OpenCode signal: ${opencodeResult?.signal ?? "none"}
- OpenCode error: ${opencodeResult?.error?.message ?? "none"}
- Completion classification: ${completionClassifications.join(", ") || "not-run"}
- Quality sample usable: ${qualitySampleUsable ? "yes" : "no"}

## Backend Drift

See drift-report.md.
`,
)

write(
  join(runDir, "analysis.md"),
  `# Phase 0 Analysis

## Goal

Phase 0 실험이 rate limit 또는 timeout으로 중단되지 않고 완주 run을 확보할 수 있도록, 실험 실행 조건을 최소 안정화한다.

## Result

${result}

## Runs Inspected

- latest run: ${runId}
- current run directory: ${relative(rootDir, runDir)}
- previous complete run referenced by operator: 2026-06-17T10-06-06-829Z
- latest failed run referenced by operator: 2026-06-17T10-09-21-965Z

## Completion Classification

${completionClassifications.map((classification) => `- ${classification}`).join("\n") || "- not-run"}

## Root Cause

${rateLimited ? "- OpenCode output contains a rate-limit error. This run is not a backend quality sample." : ""}
${timedOut ? "- OpenCode execution reached the runner timeout or was terminated by SIGTERM." : ""}
${!noRun && !rateLimited && !timedOut && opencodeResult?.status === 0 ? "- OpenCode completed without timeout or rate-limit classification." : ""}
${noRun ? "- Prepare run only. OpenCode was not executed." : ""}

## Runner Change

- Default OpenCode timeout increased to 300000 ms.
- stderr.log now records OpenCode exit code, signal, error, elapsed time, and timeout option.
- analysis.md now separates completion classification from backend quality sampling.
- RATE_LIMIT and TIMEOUT results are reported before PASS/WEAK/FAIL quality judgment.
- timeout/rate-limit runs are marked as not usable for backend quality sampling.

## Prompt Change

없음.

## Quality Sampling Decision

${qualitySampleUsable ? "- 이 run은 timeout/rate-limit 없이 완주했고 Maven 성공 로그가 있어 backend 품질 샘플로 사용할 수 있다." : "- 이 run은 backend 품질 샘플로 사용하지 않는다."}
${rateLimited ? "- 제외 이유: rate limit이 감지됐다." : ""}
${timedOut ? "- 제외 이유: timeout/SIGTERM이 감지됐다." : ""}
${!buildSuccessDetected ? "- 제외 이유: 최종 Maven 성공 로그가 감지되지 않았다." : ""}

## Verification

- OpenCode executed: ${noRun ? "no" : "yes"}
- OpenCode timeout option: ${opencodeTimeoutMs} ms
- OpenCode elapsed time: ${opencodeElapsedMs} ms
- OpenCode exit code: ${opencodeResult?.status ?? "not-run"}
- OpenCode signal: ${opencodeResult?.signal ?? "none"}
- OpenCode error: ${opencodeResult?.error?.message ?? "none"}
- Rate limit detected: ${rateLimited ? "yes" : "no"}
- Timeout detected: ${timedOut ? "yes" : "no"}
- Final Maven build success detected: ${buildSuccessDetected ? "yes" : "no"}
- Test failure detected in logs: ${testFailureDetected ? "yes" : buildSuccessDetected ? "no" : "unknown"}
- Generated Java files:
${generatedJavaFiles.map((file) => `  - ${file}`).join("\n") || "  - none"}

## Cold Assessment

${qualitySampleUsable ? "완주 run은 확보했지만 한 번 완주했다고 안정적이라고 말할 수는 없다." : "이번 run은 완주 run 확보에 실패했거나 prepare run이라 품질 샘플로 쓸 수 없다."}

## Next Loop Action

- 완주 run이 확보되지 않았으면 retry 자동화 또는 모델 호출 간격 조정 필요성을 검토한다.
- 완주 run이 확보됐으면 그 run만 backend 품질 샘플로 사용해 drift detector 결과를 해석한다.

## Out of Scope

- profile-aware, frontend, infra, benchmark routing, desktop app
- backend rule/prompt drift 보강
- detector 범위 확장
- OpenCode hook/injection 구조 변경
- 여러 모델 fallback 또는 복잡한 retry scheduler
- 백엔드 MVP 기능 확장
`,
)

console.log(`Experiment saved to ${relative(rootDir, runDir)}`)
