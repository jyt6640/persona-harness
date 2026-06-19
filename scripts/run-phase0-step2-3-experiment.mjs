#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const rootDir = dirname(fileURLToPath(new URL("../package.json", import.meta.url)))
const args = new Set(process.argv.slice(2))
const shouldRun = args.has("--run")
const modelIndex = process.argv.indexOf("--model")
const model = modelIndex >= 0 ? process.argv[modelIndex + 1] : "opencode/north-mini-code-free"
const timeoutIndex = process.argv.indexOf("--timeout-ms")
const opencodeTimeoutMs = timeoutIndex >= 0 ? Number(process.argv[timeoutIndex + 1]) : 300000
const runId = new Date().toISOString().replace(/[:.]/g, "-")
const runDir = join(rootDir, "experiments", "phase0-runs", runId)
const sandboxDir = join(runDir, "sandbox")
const baselineDir = join(runDir, "sandbox-baseline")
const pluginPath = join(rootDir, "dist", "index.js")

const requirements = `# 2단계: 데이터베이스 연동 및 시간 관리

## 요구사항

1단계 메모리 저장은 서버 재시작 시 예약 데이터가 모두 사라지는 상황이다.

이를 해결하기 위해 예약 CRUD를 H2 데이터베이스로 전환한다.

관리자가 매번 예약 시간을 텍스트로 직접 입력해 번거롭고 실수가 나는 상황이다.

정해진 시간 슬롯을 관리자가 선택해서 쓸 수 있도록 시간 관리 기능을 추가하고 예약과 시간을 연결한다.

## API

- GET /reservations: 예약 목록 조회
- POST /reservations: name, date, timeId로 예약 추가
- DELETE /reservations/{id}: 예약 삭제
- POST /times: startAt으로 시간 추가
- GET /times: 시간 목록 조회
- DELETE /times/{id}: 시간 삭제

## 환경 설정

- build.gradle에 \`spring-boot-starter-jdbc\`, \`h2\` 의존성을 추가한다.
- application.properties에 H2 콘솔 활성화와 datasource URL을 설정한다.
- H2 콘솔을 활성화한다.
- H2 콘솔 경로는 \`/h2-console\`이다.
- datasource URL은 \`jdbc:h2:mem:database\`이다.

## 테이블 스키마

\`reservation_time\` 테이블을 생성한다.

필드:

- id
- start_at

제약:

- id는 자동 증가한다.
- id는 기본키다.
- start_at은 필수값이다.

\`reservation\` 테이블을 생성한다.

필드:

- id
- name
- date
- time_id

제약:

- id는 자동 증가한다.
- id는 기본키다.
- name, date는 필수값이다.
- time_id는 \`reservation_time.id\`를 참조하는 외래키다.

## 구현 전환

- 1단계에서 만든 예약 조회, 추가, 삭제 API를 모두 \`JdbcTemplate\` 기반으로 전환한다.
- 기존의 \`List<Reservation>\`, \`AtomicLong\`은 제거한다.
- \`reservation_time\` 테이블을 추가한다.
- 시간 추가, 조회, 삭제 API를 구현한다.
- \`reservation\` 테이블의 \`time\` 컬럼을 \`time_id\`로 변경한다.
- \`time_id\`는 \`reservation_time.id\`를 참조한다.
- \`Reservation\` 클래스의 \`time\` 필드를 \`String\`에서 \`ReservationTime\` 객체로 변경한다.
- 예약 추가 요청 본문은 \`time\`에서 \`timeId\`로 변경한다.
- 예약 추가 시 DB가 생성한 id를 응답에 담는다.
- 예약 조회 응답의 \`time\`은 객체 형태로 변경한다.
- \`time\` 객체는 \`id\`, \`startAt\`을 가진다.

## 완료 테스트

- \`JdbcTemplate\`으로 \`DataSource connection\`을 가져올 수 있다.
- connection은 null이 아니다.
- DB catalog는 \`DATABASE\`이다.
- \`RESERVATION\` 테이블이 존재한다.
- DB에 직접 예약 데이터를 추가한다.
- GET /reservations 요청 시 200 OK를 응답한다.
- API로 조회한 예약 목록 크기와 DB의 reservation row count가 같다.
- POST /reservations 요청 시 200 OK를 응답한다.
- 예약 추가 후 DB의 reservation row count는 1이다.
- DELETE /reservations/1 요청 시 200 OK를 응답한다.
- 예약 삭제 후 DB의 reservation row count는 0이다.
- POST /times 요청 시 200 OK를 응답한다.
- GET /times 요청 시 200 OK를 응답한다.
- 시간 추가 후 시간 목록 크기는 1이다.
- DELETE /times/1 요청 시 200 OK를 응답한다.
- 예약 추가 요청 본문은 name, date, timeId를 가진다.
- 예약 목록 크기는 1이다.
`

const prompt = [
  "requirements.md의 # 2단계: 데이터베이스 연동 및 시간 관리 요구사항만 구현 대상으로 삼아라.",
  "이 예약 도메인은 Persona Harness의 Java/Spring 파일 역할별 규칙 주입을 검증하기 위한 fixture이며, 제품 범위 확장이 아니다.",
  "먼저 src/main/java/com/example/reservation/ReservationController.java 파일을 read 도구로 읽어라.",
  "H2/JdbcTemplate으로 1단계 예약 CRUD를 전환하라.",
  "build.gradle에 spring-boot-starter-jdbc, h2 의존성을 추가하라.",
  "application.properties에 H2 콘솔 활성화, /h2-console 경로, jdbc:h2:mem:database datasource URL을 설정하라.",
  "reservation_time 테이블과 reservation 테이블을 요구사항의 필드와 제약대로 생성하라.",
  "기존 List<Reservation>, AtomicLong, 직접 id sequence 같은 in-memory 저장 상태는 제거하라.",
  "reservation_time 테이블과 POST /times, GET /times, DELETE /times/{id} 시간 API를 추가하라.",
  "예약 생성 request body는 name, date, timeId다. time 문자열 필드를 요구하지 마라.",
  "예약 조회 response의 time은 문자열이 아니라 id, startAt을 가진 객체다.",
  "GET/POST/DELETE 성공 status는 모두 200 OK다. 201 Created나 204 No Content로 바꾸지 마라.",
  "Controller는 HTTP 요청/응답 변환과 Service 호출만 담당하고, JdbcTemplate, SQL, 저장소 구현 세부사항을 직접 다루지 마라.",
  "Service는 예약/시간 유스케이스 흐름을 조율하고, JdbcTemplate과 SQL은 Repository가 담당하게 하라.",
  "테스트는 JdbcTemplate DataSource connection, DB catalog DATABASE, RESERVATION 테이블 존재, API status, DB row count, time list size를 요구사항 그대로 검증하라.",
  "API request/response DTO는 src/main/java/com/example/reservation/dto/ 아래 별도 파일로 두어라. 단, 원문에 없는 response body 필드를 새로 강제하지 마라.",
  "구현을 마친 뒤 최종 응답 전에 glob 도구로 src/main/java/**/ReservationController.java, src/test/java/**/*Test.java, src/main/java/**/dto/*Request.java, src/main/java/**/dto/*Response.java 패턴의 실제 파일을 찾고, read 도구로 각 범주의 실제 파일을 최소 1개 이상 읽어라.",
  "원문에 없는 실패 케이스와 response body는 추정하지 마라.",
  "profile-aware, frontend, infra, benchmark routing, desktop app은 구현하지 마라.",
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
        if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "build") continue
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
    targetFiles: [],
  }

  for (const file of files) {
    const row = JSON.parse(readFileSync(file, "utf8"))
    summary.byRole[row.fileRole] = (summary.byRole[row.fileRole] ?? 0) + 1
    summary.byLocation[row.injectedInto] = (summary.byLocation[row.injectedInto] ?? 0) + 1
    if (row.targetFile && !summary.targetFiles.includes(row.targetFile)) {
      summary.targetFiles.push(row.targetFile)
    }
    for (const rule of row.selectedRules ?? []) {
      if (!summary.selectedRules.includes(rule)) {
        summary.selectedRules.push(rule)
      }
    }
  }

  return summary
}

function writeRootFiles() {
  write(
    join(runDir, "goal.md"),
    `# Goal

Phase 0 #2-3 데이터베이스 연동 및 시간 관리 fixture를 통해 규칙 주입 경로를 관찰할 수 있도록, 기존 #1 runner를 깨지 않는 방식으로 #2-3 requirements/prompt 경로를 준비하고 prepare-only 결과를 검증한다.

이 run의 목표는 방탈출 예약 앱 product 구현이 아니다. 목표는 더 복잡한 Java/Spring fixture에서도 targetFile -> injection block -> 실제 모델 입력 경로를 재현 가능하게 준비하는 것이다.
`,
  )

  write(
    join(runDir, "worklog.md"),
    `# Worklog

## Changed

- #2-3 prepare-only experiment package 생성
- #2-3 requirements.md 생성
- #2-3 prompt.md 생성
- sandbox에 .persona rules와 OpenCode plugin 설정 복사
- Gradle 기반 Java/Spring sandbox skeleton 생성

## Why

- 기존 #1 runner 기본 흐름을 유지하면서 #2-3 실험 입력만 별도로 검증하기 위해서다.
- 예약 도메인은 제품 구현 목표가 아니라 Java/Spring rule injection을 검증하기 위한 fixture다.
- #1/#2/#3 요구사항은 생성 모델의 앱 완성도를 평가하는 product backlog가 아니라 복잡도가 다른 Spring fixture 입력이다.

## Not Changed

- OpenCode 구현 run은 실행하지 않았다.
- 기존 #1 runner는 수정하지 않았다.
- injection 구조와 rule engine은 수정하지 않았다.
`,
  )

  write(join(runDir, "requirements.md"), `${requirements}\n`)

  write(
    join(runDir, "prompt.md"),
    `# Prompt

\`\`\`text
${prompt}
\`\`\`
`,
  )

  write(
    join(runDir, "evidence.md"),
    `# Evidence

## Scenario

step2-3 prepare-only

## OpenCode

not-run

## Notes

- This run only verifies generated requirements.md and prompt.md.
- No model implementation output exists in this prepare-only run.
`,
  )

  write(join(runDir, "stdout.log"), "prepare-only: OpenCode not executed\n")
  write(join(runDir, "stderr.log"), "")
  write(join(runDir, "diff.patch"), "")
  write(
    join(runDir, "next-actions.md"),
    `# Next Actions

## Next Loop

- Inspect this run's requirements.md and prompt.md.
- If they match docs/phases/phase0/phase0-step2-scope.md, run the actual #2-3 implementation experiment in a separate loop.

## Do Not

- Do not use this prepare-only run as a backend quality sample.
- Do not treat the reservation app as the Persona Harness product.
- Do not infer Open Questions as implementation requirements.
`,
  )
}

function writeAnalysis() {
  if (shouldRun) {
    write(
      join(runDir, "analysis.md"),
      `# Phase 0 Analysis

## Goal

Phase 0 #2-3 fixture 실제 implementation run을 1회 실행하고, 복잡한 Spring/H2/JdbcTemplate fixture에서도 targetFile → injection block → model input → model behavior 경로가 유지되는지 증거 중심으로 평가한다.

## Result

UNKNOWN

## Run Inspected

${relative(rootDir, runDir)}

## Fixture Framing

예약 앱은 product가 아니라 Java/Spring rule-injection fixture다. 이 run은 앱 완성도 보증이 아니라 targetFile → injection block → model input → model behavior 경로 관찰을 목표로 한다.

## Injection Path Evidence

Pending. OpenCode run has not completed yet.

## Model Behavior Evidence

Pending. OpenCode run has not completed yet.

## Auxiliary Spring Observation

Pending. OpenCode run has not completed yet.

## Failure Classification

L

## Root Cause

Pending.

## Rule Change

없음.

## Prompt Change

없음.

## Verification

- OpenCode implementation run: pending

## Cold Assessment

Pending.

## Next Loop Action

Pending.

## Out of Scope

- product-grade reservation app quality evaluation
- Guard/AST/linter enforcement
- profile-aware, frontend, infra, benchmark routing, desktop app
- OMO 핵심 skill 복사/각색
- 대규모 rule engine 리팩터링
- injection 구조 변경
`,
    )
    return
  }

  write(
    join(runDir, "analysis.md"),
    `# Phase 0 Analysis

## Goal

Phase 0 문서와 #2-3 runner 표현을 MVP 목표에 맞게 재정렬해, 방탈출 예약 앱이 product가 아니라 규칙 주입 경로를 검증하기 위한 Java/Spring fixture임을 명확히 한다.

## Result

PASS

## Alignment Decision

MVP 목표는 완성도 높은 방탈출 예약 앱을 만드는 것이 아니라 targetFile -> injection block -> 실제 모델 입력 -> 모델 행동 변화 관찰 경로가 재현 가능하게 이어지는지 증명하는 것으로 고정했다.

## Files Reviewed

- docs/current/mvp-goal.md
- README.md
- docs/phases/phase0/phase0-step2-scope.md
- docs/phases/phase0/phase-0-report.md
- docs/current/workflow.md
- scripts/run-phase0-step2-3-experiment.mjs

## Documentation Change

- Documented that the room-escape reservation app is a Java/Spring fixture, not the product.
- Clarified that #1/#2/#3 requirements are fixture inputs with increasing complexity.
- Clarified that generated Spring app quality is useful as observation but is not the MVP center.
- Clarified that detector is a string-based helper, not a quality gate.
- Clarified that Phase 0 does not enforce rules with Guard/AST/linter.

## Runner Text Change

- goal.md now frames #2-3 as fixture preparation for observing the injection path.
- worklog.md now says the reservation domain is a fixture, not a product goal.
- prompt.md keeps the source-stated #2-3 API/DB/test contract and explicitly says the domain is a fixture.
- analysis.md records this MVP alignment decision instead of presenting app quality as the center.

## Fixture Framing

- #1 fixture checks the basic Spring Controller/Service/Repository/API-contract injection path.
- #2-3 fixture raises complexity with H2/JdbcTemplate, schema, and time linking.
- The fixture exists to observe whether role-specific policy injection stays visible and useful as Spring context becomes more complex.
- The fixture is not a product backlog for a room-escape reservation application.

## Out-of-Scope Guardrail

- Did not run an OpenCode implementation experiment.
- Did not evaluate product-grade reservation app quality.
- Did not add Guard/AST/linter enforcement.
- Did not change profile-aware, frontend, infra, benchmark routing, or desktop app scope.
- Did not copy or adapt OMO core skills.
- Did not refactor the rule engine or injection structure.

## Verification

- Prepare command: npm run experiment:phase0:step2-3:prepare
- OpenCode implementation run: not executed

## Cold Assessment

이 정렬은 필요했다. 이전 표현은 예약 앱 품질 평가 쪽으로 읽힐 여지가 있었고, MVP 중심인 규칙 주입 경로 증명이 흐려질 수 있었다. 다만 여전히 fixture 요구사항이 API/DB/test 계약을 포함하므로, 다음 loop에서도 product 구현 목표로 오해하지 않도록 계속 문구를 조심해야 한다.

## Next Loop Action

- #2-3 fixture prepare output을 다시 확인한 뒤, 실제 implementation run을 실행할지 결정한다.
- 실행한다면 생성 앱 완성도가 아니라 주입 경로와 모델 행동 변화 관찰을 중심으로 분석한다.

## Out of Scope

- #2-3 구현 실험 실행
- product-grade reservation app quality evaluation
- Guard/AST/linter enforcement
- #1 runner behavior changes
- profile-aware, frontend, infra, benchmark routing, desktop app
- OMO 핵심 skill 복사/각색
- injection 구조 변경
- 대규모 rule engine 리팩터링
- detector 선제 확장
`,
  )
}

function writeSandbox() {
  cpSync(join(rootDir, ".persona", "rules"), join(sandboxDir, ".persona", "rules"), { recursive: true })
  cpSync(join(rootDir, ".persona", "harness.jsonc"), join(sandboxDir, ".persona", "harness.jsonc"))
  write(
    join(sandboxDir, ".persona", "harness.jsonc"),
    `${readFileSync(join(rootDir, ".persona", "harness.jsonc"), "utf8").replace(/\n}\s*$/, ',\n  "scenario": "step2-3"\n}\n')}`,
  )

  write(
    join(sandboxDir, ".opencode", "opencode.json"),
    `${JSON.stringify({ plugin: [pluginPath] }, null, 2)}\n`,
  )

  write(join(sandboxDir, "requirements.md"), `${requirements}\n`)
  write(join(sandboxDir, "settings.gradle"), "pluginManagement { repositories { gradlePluginPortal() } }\ndependencyResolutionManagement { repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS); repositories { mavenCentral() } }\nrootProject.name = 'reservation-step2-3'\n")
  write(
    join(sandboxDir, "build.gradle"),
    `plugins {
    id 'java'
    id 'org.springframework.boot' version '3.5.0'
    id 'io.spring.dependency-management' version '1.1.7'
}

group = 'com.example'
version = '0.0.1-SNAPSHOT'

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

dependencies {
    implementation 'org.springframework.boot:spring-boot-starter-web'
    testImplementation 'org.springframework.boot:spring-boot-starter-test'
}

tasks.named('test') {
    useJUnitPlatform()
}
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
writeRootFiles()
writeAnalysis()
writeSandbox()

if (shouldRun) {
  const build = run("npm", ["run", "build"])
  write(join(runDir, "build.stdout.log"), build.stdout)
  write(join(runDir, "build.stderr.log"), build.stderr)
  if (build.status !== 0) {
    write(join(runDir, "stderr.log"), build.stderr)
    throw new Error(`npm run build failed. See ${relative(rootDir, runDir)}/build.stderr.log`)
  }

  cpSync(sandboxDir, baselineDir, { recursive: true })

  const startedAt = Date.now()
  const opencodeResult = run(
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
  const endedAt = Date.now()

  write(join(runDir, "stdout.log"), opencodeResult.stdout)
  write(
    join(runDir, "stderr.log"),
    [
      opencodeResult.stderr,
      opencodeResult.error?.message ? `[runner error] ${opencodeResult.error.message}` : "",
      `[runner summary] exit=${opencodeResult.status ?? "not-run"} signal=${opencodeResult.signal ?? "none"} elapsedMs=${endedAt - startedAt} timeoutMs=${opencodeTimeoutMs}`,
    ].filter(Boolean).join("\n"),
  )

  const diff = run("diff", [
    "-ruN",
    "-x",
    "node_modules",
    "-x",
    "build",
    "-x",
    ".gradle",
    baselineDir,
    sandboxDir,
  ])
  write(join(runDir, "diff.patch"), diff.stdout)

  const evidenceSummary = summarizeEvidence()
  const output = `${opencodeResult.stdout}\n${opencodeResult.stderr}\n${opencodeResult.error?.message ?? ""}`
  const timedOut = opencodeResult.error?.message?.includes("ETIMEDOUT") || opencodeResult.signal === "SIGTERM"
  const rateLimited = /rate limit|rate_limit|too many requests/i.test(output)
  const completed = !timedOut && !rateLimited && opencodeResult.status === 0
  const result = rateLimited ? "RATE_LIMIT" : timedOut ? "TIMEOUT" : evidenceSummary.count > 0 && completed ? "PASS" : evidenceSummary.count > 0 ? "WEAK" : completed ? "WEAK" : "FAIL"
  const generatedJavaFiles = listFiles(join(sandboxDir, "src"), (file) => file.endsWith(".java"))
    .map((file) => relative(sandboxDir, file))

  write(
    join(runDir, "evidence.md"),
    `# Evidence

## Scenario

step2-3 implementation

## Target Files

${evidenceSummary.targetFiles.map((file) => `- ${file}`).join("\n") || "- no target files captured"}

## Detected File Roles

\`\`\`json
${JSON.stringify(evidenceSummary.byRole, null, 2)}
\`\`\`

## Selected Rules

${evidenceSummary.selectedRules.map((rule) => `- ${rule}`).join("\n") || "- no selected rules recorded"}

## Injection Timing

\`\`\`json
${JSON.stringify(evidenceSummary.byLocation, null, 2)}
\`\`\`

## Runner

- OpenCode model: ${model}
- Timeout option: ${opencodeTimeoutMs} ms
- OpenCode elapsed time: ${endedAt - startedAt} ms
- OpenCode exit code: ${opencodeResult.status ?? "not-run"}
- OpenCode signal: ${opencodeResult.signal ?? "none"}
- OpenCode error: ${opencodeResult.error?.message ?? "none"}
- Rate limit detected: ${rateLimited ? "yes" : "no"}
- Timeout detected: ${timedOut ? "yes" : "no"}
- Generated Java files:
${generatedJavaFiles.map((file) => `  - ${file}`).join("\n") || "  - none"}
`,
  )

  write(
    join(runDir, "analysis.md"),
    `# Phase 0 Analysis

## Goal

Phase 0 #2-3 fixture 실제 implementation run을 1회 실행하고, 복잡한 Spring/H2/JdbcTemplate fixture에서도 targetFile → injection block → model input → model behavior 경로가 유지되는지 증거 중심으로 평가한다.

## Result

${result}

## Run Inspected

${relative(rootDir, runDir)}

## Fixture Framing

예약 앱은 product가 아니라 Java/Spring rule-injection fixture다. 이 run은 앱 완성도 보증이 아니라 targetFile → injection block → model input → model behavior 경로 관찰을 목표로 한다.

## Injection Path Evidence

- Evidence count: ${evidenceSummary.count}
- Target files:
${evidenceSummary.targetFiles.map((file) => `  - ${file}`).join("\n") || "  - none"}
- File roles:
\`\`\`json
${JSON.stringify(evidenceSummary.byRole, null, 2)}
\`\`\`
- Selected rules:
${evidenceSummary.selectedRules.map((rule) => `  - ${rule}`).join("\n") || "  - none"}
- Injection locations:
\`\`\`json
${JSON.stringify(evidenceSummary.byLocation, null, 2)}
\`\`\`

## Model Behavior Evidence

Pending manual review.

## Auxiliary Spring Observation

Pending manual review.

## Failure Classification

${rateLimited ? "I" : timedOut ? "I" : evidenceSummary.count > 0 ? "K" : "D"}

## Root Cause

${rateLimited ? "Rate limit was detected in OpenCode output." : timedOut ? "OpenCode run timed out or was terminated." : evidenceSummary.count > 0 ? "Initial runner evidence indicates the injection path produced metadata evidence. Manual code review is still required." : "No injection evidence was recorded by the runner."}

## Rule Change

없음.

## Prompt Change

없음.

## Verification

- npm run build inside runner: ${build.status === 0 ? "passed" : "failed"}
- OpenCode implementation command: npm run experiment:phase0:step2-3 -- --model ${model} --timeout-ms ${opencodeTimeoutMs}
- OpenCode exit code: ${opencodeResult.status ?? "not-run"}
- OpenCode signal: ${opencodeResult.signal ?? "none"}
- OpenCode elapsedMs: ${endedAt - startedAt}
- Rate limit detected: ${rateLimited ? "yes" : "no"}
- Timeout detected: ${timedOut ? "yes" : "no"}

## Cold Assessment

This runner-generated analysis only records initial execution evidence. It is not a product-quality assessment and needs manual inspection of generated files before final classification.

## Next Loop Action

- Manually inspect generated Spring/H2/JdbcTemplate files and tests.
- Interpret generated app quality only as auxiliary evidence for injection behavior.

## Out of Scope

- product-grade reservation app quality evaluation
- Guard/AST/linter enforcement
- profile-aware, frontend, infra, benchmark routing, desktop app
- OMO 핵심 skill 복사/각색
- 대규모 rule engine 리팩터링
- injection 구조 변경
`,
  )
}

console.log(`Experiment saved to ${relative(rootDir, runDir)}`)
