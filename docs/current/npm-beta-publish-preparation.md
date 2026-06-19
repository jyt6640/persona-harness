# npm Beta Publish Preparation

## Goal

`persona-harness`를 npm beta tag로 배포하기 직전까지 필요한 release-facing 표면을 정리한다. 실제 `npm publish`는 실행하지 않는다.

## Package Name

현재 `package.json` name은 `persona-harness`다. publish 전에는 npm registry에서 이름 사용 가능 여부를 다시 확인한다.

```bash
npm view persona-harness
```

## Version Candidate

현재 version은 `0.1.0`이다. 첫 공개 beta라면 `0.1.0-beta.0`을 추천한다.

## Required Package Surface

`package.json`에는 다음이 있어야 한다.

- `bin.persona-harness = ./dist/cli/init.js`
- `dist`
- `.persona/harness.jsonc`
- `.persona/rules`
- `scripts/verify-init-demo.mjs`
- `scripts/verify-bootstrap-demo.mjs`
- `scripts/verify-java-mvp-demo.mjs`
- `README.md`

`.persona/evidence`는 tarball에 포함하지 않는다.

## Dry Run

```bash
npm run demo:init
npm run demo:bootstrap
npm run demo:java-mvp
npm pack --dry-run
```

`npm pack --dry-run`에서 확인할 것:

- `dist/cli/init.js`가 포함된다.
- `dist/index.js`가 포함된다.
- `.persona/harness.jsonc`와 `.persona/rules`가 포함된다.
- `.persona/evidence`는 포함되지 않는다.

## External User Scenario

```bash
mkdir my-app
cd my-app
npm install -D persona-harness
npx persona-harness init
opencode run --dir . --model openai/gpt-5.4-mini-fast \
  "README.md를 읽고 요구사항 전체를 Gradle 기반 Spring 백엔드로 구현해줘."
```

## Publish Command

별도 명시가 있을 때만 실행한다.

```bash
npm login
npm publish --access public --tag beta
```

`latest` tag publish는 기본 추천이 아니다.
