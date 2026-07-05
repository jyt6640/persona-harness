# Public Behavior Based TDD

## 상태

accepted

## 문제 상황

기능을 "로그인", "회원가입" 같은 큰 작업 단위로 인식하면 테스트가 통합 테스트나 인수 테스트에 치우친다.

그 결과 Domain, Validator, Policy의 책임이 직접 테스트되지 않고 Service 테스트에 묻힌다.

## 선택한 방향

테스트 단위는 production class의 public behavior 단위로 잡는다.

Acceptance Test는 마지막 전체 시나리오 검증으로만 사용한다.

## 현재 판단

모든 production class는 직접 테스트하는 것을 기본으로 한다.
직접 테스트하지 않는 경우 단순 DTO, 설정, 부트스트랩, 상수처럼 제외 가능한 이유가 있어야 한다.