# Rule Policy

## Goal

`.persona/rules`는 Java/Spring Backend MVP에서 모델 입력에 결정적으로 주입할 기준 문서다.

이 문서는 어떤 철학을 rule로 승격하고 어떤 철학을 제외하는지 정의한다.

## 가져올 수 있는 원칙

- 작은 메서드
- 명확한 이름
- 의도를 드러내는 코드
- 성급하지 않은 중복 제거
- 테스트 가능한 구조
- Controller는 HTTP 요청/응답 변환에 집중
- Service는 유스케이스 흐름을 표현
- Repository는 영속성 세부사항을 숨김
- DTO는 API 계약을 명확히 표현
- Entity는 도메인 불변성과 상태 변경을 책임짐
- 테스트는 구현 세부사항보다 행위를 검증
- 예외와 검증은 경계에서 명확히 처리
- API 요청/응답 계약은 테스트와 DTO에 명시적으로 드러나야 함

## 제외할 원칙

- 개인 취향이 강한 네이밍 강제
- 특정 프로젝트에서만 맞는 레이어 구조
- 과도한 DDD 강제
- 과도한 추상화 강제
- 항상/절대 류의 극단적 규칙
- 프론트엔드 규칙
- 인프라 규칙
- AI 모델 라우팅 규칙
- profile-aware 규칙
- desktop app 규칙
- 아직 MVP에 필요 없는 운영 규칙

## Rule 작성 기준

- 한 rule 파일은 하나의 책임만 다룬다.
- 문장은 짧고 실행 가능해야 한다.
- 모델에게 행동 기준을 주되 과도한 설계를 강제하지 않는다.
- API contract rule은 요구사항 필드명을 그대로 보존한다.
- Spring 역할별 rule은 Controller, Service, Repository, Entity, DTO, Test 책임선을 흐리지 않는다.

## Rule 변경 기준

Rule을 바꿀 때는 다음을 같이 남긴다.

- 왜 바꿨는가
- 어떤 실험에서 문제가 보였는가
- 어떤 원칙을 가져왔는가
- 어떤 원칙을 제외했는가
- 다음 실험에서 무엇을 확인할 것인가

기준 문서는 Git에 남기고, 개별 실험의 판단 원문은 `experiments/phase0-runs/{timestamp}/rule-selection.md`에 남긴다.
