# Workflow

## Phase 0 Injection Workflow

정식 주입 순서는 다음으로 고정한다.

```text
1. 요구사항/작업 범위 로드
2. target file 감지
3. file role 판별
4. clean-code baseline 선택
5. backend/java baseline 선택
6. file-role policy 선택
7. API contract policy 선택
8. injection block 생성
9. 모델 입력 또는 tool output에 주입
10. 구현
11. 테스트 실행
12. evidence 저장
13. analysis 작성
14. next action 도출
```

## 현재 구현 매핑

- 요구사항/작업 범위 로드: `scripts/run-phase0-experiment.mjs`와 `scripts/run-phase0-step2-3-experiment.mjs`가 `requirements.md`와 sandbox 요구사항 파일을 생성한다.
- target file 감지: `src/phase0/target-file.ts`
- file role 판별: `src/phase0/file-role.ts`
- rule 선택: `src/phase0/rule-loader.ts`
- injection block 생성: `src/phase0/injection.ts`
- tool output 주입: `src/phase0/hooks.ts`의 `tool.execute.after`
- model input 주입: `src/phase0/messages.ts`
- evidence 저장: `src/phase0/evidence.ts`
- analysis/next action 기록: `scripts/run-phase0-experiment.mjs`가 실험 템플릿을 생성하고 OpenCode 실행 후 요약을 갱신한다.

## MVP 경계

지금은 완전한 workflow engine을 만들지 않는다.

Phase 0은 OpenCode hook 기반으로 target file 감지와 주입 가능성을 증명한다.

중복 주입은 message/tool output에 이미 `[Persona Harness Injection]`이 있으면 건너뛰는 수준으로만 막는다.

방탈출 예약 #1/#2/#3 요구사항은 product가 아니라 Java/Spring fixture 입력이다. workflow의 구현/테스트 단계는 모델이 fixture를 어떻게 처리하는지 관찰하기 위한 단계이지, 예약 앱 완성도를 MVP 목표로 삼는 단계가 아니다.

## Rule Loader 범위

MVP rule-loader는 `.persona/rules/**/*.md` 파일에서 bullet 정책을 읽는다.

지원하는 것:

- file role별 rule path 선택
- rule 파일명 evidence 기록
- 주입 정책 dedupe
- API contract rule 우선 포함

지원하지 않는 것:

- full frontmatter validation
- glob matching engine
- severity 기반 routing
- profile-aware selection
- runtime rule editing

## Evidence Contract

Evidence는 metadata-only로 유지한다.

저장하는 것:

- hook 이름
- sessionID
- callID
- target file
- detected file role
- selected rule files
- injected policy count
- injection timing

저장하지 않는 것:

- 사용자 프롬프트 원문
- 전체 코드 원문
- rule 본문 전체
- 모델 출력 전체

## Phase 0 #1 Backend Closure Workflow

Phase 0 #1단계 Spring backend MVP 종료 판단은 다음 순서로 한다.

```text
1. 직전 drift run 확인
2. 보강 후 PASS run 확인
3. 같은 기본 명령의 반복 run 확인
4. API 계약 직접 확인
5. Controller/Service/Repository 역할 분리 직접 확인
6. detector 결과와 false positive 가능성 비교
7. 종료/보류 결정 기록
8. 남은 리스크와 다음 loop action 기록
```

현재 결정은 **종료**다.

이 결정은 `# 1단계: 웹 요청-응답` Java/Spring backend에만 적용한다. detector는 문자열 기반 보조 신호이므로, 생성 코드 직접 확인과 반복 PASS 근거 없이 detector 결과만으로 종료하지 않는다.
또한 이 종료는 #1 fixture가 MVP 주입 경로 증명에 충분하다는 뜻이며, 예약 앱 product 품질 보증을 뜻하지 않는다.

## Phase 0 #2-3 Live Evidence Workflow

#2-3 fixture에서는 다음을 추가로 확인한다.

```text
1. sandbox .persona/harness.jsonc에 scenario: step2-3 기록
2. Controller/Test/DTO 파일을 targetFile로 포착
3. Controller/Test/DTO selected rules에 backend/step2-3-api-contract.md 포함
4. Controller/Test/DTO selected rules에 backend/step1-api-contract.md 미포함
5. injection block이 tool output 또는 model input에 남았는지 확인
6. evidence gap과 prompt 유도 여부를 analysis에 기록
```

현재 `experiments/phase0-runs/2026-06-18T00-34-47-590Z`와 반복 run `experiments/phase0-runs/2026-06-18T01-02-20-056Z`에서 Controller/Test/Request DTO/Response DTO live evidence를 확보했다. 두 run 모두 Controller/Test/DTO selected rules에 `backend/step2-3-api-contract.md`가 들어갔고 `backend/step1-api-contract.md` 혼입은 0건이었다.

이 evidence는 prompt가 구현 후 `glob`/`read`를 명시적으로 유도한 결과다. 따라서 모델이 자연스럽게 항상 모든 역할 파일을 읽는다는 보장은 아니며, 앱 품질 보증이나 Guard/AST/linter 검증도 아니다.

현재 결정은 **#2-3 evidence 종료, Phase 0 MVP 종료**다. 이 결정은 Java/Spring Backend Phase 0 injection-path proof에만 적용한다.
