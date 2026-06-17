#!/usr/bin/env node

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const rootDir = dirname(fileURLToPath(new URL("../package.json", import.meta.url)))
const args = new Set(process.argv.slice(2))
const noRun = args.has("--no-run")
const modelIndex = process.argv.indexOf("--model")
const model = modelIndex >= 0 ? process.argv[modelIndex + 1] : "opencode/north-mini-code-free"
const runId = new Date().toISOString().replace(/[:.]/g, "-")
const runDir = join(rootDir, "experiments", "phase0-runs", runId)
const sandboxDir = join(runDir, "sandbox")
const pluginPath = join(rootDir, "dist", "index.js")

function write(path, content) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

function run(command, commandArgs, options = {}) {
  return spawnSync(command, commandArgs, {
    cwd: options.cwd ?? rootDir,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 20,
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
  }

  for (const file of files) {
    const row = JSON.parse(readFileSync(file, "utf8"))
    summary.byRole[row.fileRole] = (summary.byRole[row.fileRole] ?? 0) + 1
    summary.byLocation[row.injectedInto] = (summary.byLocation[row.injectedInto] ?? 0) + 1
  }

  return summary
}

function createSandbox() {
  write(
    join(sandboxDir, ".opencode", "opencode.json"),
    `${JSON.stringify({ plugin: [pluginPath] }, null, 2)}\n`,
  )

  write(
    join(sandboxDir, "requirements-step1.md"),
    `# 1단계: 웹 요청-응답

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
`,
  )

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

const build = run("npm", ["run", "build"])
write(join(runDir, "build.stdout.log"), build.stdout)
write(join(runDir, "build.stderr.log"), build.stderr)
if (build.status !== 0) {
  throw new Error(`npm run build failed. See ${relative(rootDir, runDir)}/build.stderr.log`)
}

createSandbox()

const prompt = [
  "requirements-step1.md의 # 1단계: 웹 요청-응답만 구현 대상으로 삼아라.",
  "먼저 src/main/java/com/example/reservation/ReservationController.java 파일을 read 도구로 읽어라.",
  "그 다음 방탈출 예약 CRUD API를 메모리 저장 방식으로 구현해라.",
  "화면은 만들지 말고, GET /reservations, POST /reservations, DELETE /reservations/{id} 요구사항 테스트가 통과하도록 필요한 Java/Spring 파일과 테스트를 작성해라.",
  "2단계 이후 요구사항은 구현하지 마라.",
].join(" ")

write(join(runDir, "prompt.txt"), `${prompt}\n`)

let opencodeResult
if (!noRun) {
  opencodeResult = run(
    "opencode",
    [
      "run",
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
    { cwd: sandboxDir },
  )
  write(join(runDir, "opencode.stdout.jsonl"), opencodeResult.stdout)
  write(join(runDir, "opencode.stderr.log"), opencodeResult.stderr)
}

const evidenceSummary = noRun ? { count: 0, byRole: {}, byLocation: {} } : summarizeEvidence()
const generatedJavaFiles = listFiles(join(sandboxDir, "src"), (file) => file.endsWith(".java"))
  .map((file) => relative(sandboxDir, file))

write(
  join(runDir, "analysis.md"),
  `# Persona Harness Phase 0 Experiment

Run ID: ${runId}
Model: ${model}
Executed OpenCode: ${noRun ? "no" : "yes"}
Exit code: ${opencodeResult?.status ?? "not-run"}

## Prompt

\`\`\`text
${prompt}
\`\`\`

## Evidence Summary

\`\`\`json
${JSON.stringify(evidenceSummary, null, 2)}
\`\`\`

## Generated Java Files

${generatedJavaFiles.map((file) => `- ${file}`).join("\n") || "- none"}

## 냉정 분석 체크리스트

- [ ] targetFile이 포착됐는가?
- [ ] injection block이 tool output 또는 model input에 들어갔는가?
- [ ] 요구사항의 요청 본문이 name/date/time으로 유지됐는가?
- [ ] 응답이 id/name/date/time을 반환하는가?
- [ ] GET/POST/DELETE 요구사항 테스트가 실제로 실행됐는가?
- [ ] 생성물이 컴파일 가능한가?
- [ ] 모델이 fixture 바깥 경로를 탐색하지 않았는가?

## 판정

아직 수동 분석 필요.
`,
)

console.log(`Experiment saved to ${relative(rootDir, runDir)}`)
