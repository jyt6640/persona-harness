# Java Backend Bootstrap OpenCode Demo

## Goal

clean project에서 `persona-harness init` 이후 README target만으로 Java backend bootstrap injection이 발동하는지 수동 검증한다.

이 문서는 generated Spring app product-quality 보증이 아니라 bootstrap injection과 backend product code shape guidance가 clean project에서 발동하는지 확인하는 manual path다.

## Clean Demo

```bash
mkdir /tmp/persona-demo
cd /tmp/persona-demo
npm install -D persona-harness
npx persona-harness init
```

`README.md`를 작성한 뒤 OpenCode를 실행한다.

```bash
opencode run --dir /tmp/persona-demo --model openai/gpt-5.4-mini-fast \
  "README.md를 끝까지 읽고, 요구사항의 모든 스텝을 Gradle 기반 Spring 백엔드 프로젝트로 구현해줘."
```

## Checkpoints

- `.persona/harness.jsonc`가 있다.
- `.persona/rules/`가 있다.
- init 직후 `.persona/evidence/`는 없다.
- OpenCode run 이후 `.persona/evidence/phase0/*.json`이 생긴다.
- README 또는 build.gradle bootstrap evidence가 있다.
- Java 코드 생성 후 Controller/Service/Repository evidence가 생긴다.
- Gradle project가 생성된다.
- 가능하면 `./gradlew clean test`가 통과한다.

## Existing Local Testing Project

`/Users/yongtae/IdeaProjects/testing`은 이전 evidence가 섞였을 수 있으므로 직접 확인할 때만 아래 절차를 사용한다. 이 경로는 CI, smoke script, npm package 검증에 의존시키지 않는다.

```bash
cd /Users/yongtae/IdeaProjects/testing
rm -rf .persona .opencode

npx persona-harness init

opencode run --dir /Users/yongtae/IdeaProjects/testing --model openai/gpt-5.4-mini-fast \
  "README.md를 끝까지 읽고, 요구사항의 모든 스텝을 Gradle 기반 Spring 백엔드 프로젝트로 구현해줘."
```

확인할 것:

- evidence가 이번 run만 남는지
- README/build.gradle bootstrap evidence가 있는지
- Java Controller/Service/Repository evidence가 있는지
- Gradle project가 생성됐는지
- `./gradlew clean test` 통과 여부

## Non-Goals

- 이 절차는 test-quality gate가 아니다.
- generated app product-quality 보증이 아니다.
- package name exact match를 성공 기준으로 삼지 않는다.
