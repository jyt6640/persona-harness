# Loop Engineering

## Goal

Persona Harness의 모든 개선은 작은 loop로 수행한다.

각 loop는 하나의 목표를 정하고, 작업하고, 실험하고, 결과를 기록하고, 냉정하게 분석한 뒤 다음 action을 남긴다.

## Loop Contract

```text
Goal 설정
-> 작업 수행
-> 실험 실행
-> 결과 기록
-> 냉정 분석
-> 다음 개선점 도출
```

모든 loop는 다음 형식으로 시작한다.

```md
Goal: 이번 loop에서 달성할 단 하나의 목표
```

모든 loop는 다음 형식으로 끝난다.

```md
## Loop Result

### Goal

### Changed Files

### Generated Docs

### Experiment Path

### Verification

### Cold Assessment

### Next Action
```

## Documentation Contract

코드 변경은 worklog 없이 완료된 것으로 보지 않는다.

실험 실행은 analysis 없이 완료된 것으로 보지 않는다.

Injection 변경은 evidence 없이 완료된 것으로 보지 않는다.

Rule 변경은 rule-selection 없이 완료된 것으로 보지 않는다.

## Experiment Contract

모든 실험은 `experiments/phase0-runs/{timestamp}/` 아래에 저장한다.

각 실험 디렉터리는 다음 파일을 가진다.

```text
goal.md
worklog.md
requirements.md
prompt.md
evidence.md
stdout.log
stderr.log
diff.patch
rule-selection.md
analysis.md
next-actions.md
```

없는 내용은 빈 파일이 아니라 판단 가능한 템플릿으로 남긴다.

## Loop 0: Baseline

목표: 현재 플러그인이 빌드/테스트되고 실험 패키지가 생성되는지 확인한다.

검증:

```bash
npm test
npm run typecheck
npm run build
npm run experiment:phase0:prepare
```

## Loop 1: Rule Selection

목표: `references/diff-rules`에서 보편적인 클린코드/백엔드 원칙만 선별해 `.persona/rules` 정본을 강화한다.

개인 취향, 과도한 DDD, 특정 프로젝트 맥락, frontend/infra/profile-aware/desktop 규칙은 제외한다.

## Loop 2: Injection Workflow

목표: target file 감지부터 evidence 저장까지의 hook 흐름이 문서와 코드에서 같은 순서로 드러나게 한다.

완전한 workflow engine을 만들지 않고 Phase 0 hook 안에서만 표현한다.

## Loop 3: OpenCode Experiment

목표: OpenCode에 실제 연결해 `# 1단계: 웹 요청-응답` 요구사항으로 실험한다.

저장할 것:

- goal
- worklog
- requirements
- prompt
- stdout/stderr
- injection evidence
- generated diff
- test result
- analysis
- next actions

## Loop 4: Cold Analysis

목표: 요구사항 준수, API 계약, 클린코드, 백엔드 역할 분리, 하네스 효과를 냉정하게 평가한다.

평가는 `PASS`, `WEAK`, `FAIL`, `UNKNOWN` 중 하나로 남긴다.

## Loop 5: Minimal Improvement

목표: 분석에서 나온 문제 중 MVP에 직접 필요한 것만 수정한다.

우선순위:

1. API 계약 누락
2. target file 감지 실패
3. rule 선택 실패
4. injection 미작동
5. evidence 저장 누락
6. 실험 기록 누락
7. README 사용법 오류
8. 테스트 스크립트 실패

## Done Criteria

- 실험이 재현 가능하다.
- evidence만 보고 어떤 rule이 언제 주입됐는지 알 수 있다.
- analysis만 보고 다음 loop를 시작할 수 있다.
- Git에는 기준 문서와 하네스 코드만 남고, 실험 원문은 남지 않는다.
