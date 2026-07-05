# Method Design

이 문서는 메서드 설계 기준을 정의한다.

메서드는 단순 코드 묶음이 아니라,
하나의 의도와 책임을 표현하는 단위로 본다.

---

## 핵심 방향

- 한 메서드는 한 가지 의도만 표현한다.
- 흐름과 판단을 분리한다.
- 명시성을 재사용보다 우선한다.
- 메서드 이름만으로 의도를 이해 가능해야 한다.
- 작은 메서드보다 명확한 메서드를 우선한다.

---

## 메서드 책임

메서드는 하나의 행위만 수행해야 한다.

좋은 예시:

    validateOwner()
    cancel()
    calculateTotalPrice()

지양하는 예시:

    validateAndCancel()
    process()
    handle()

---

## 메서드 길이

메서드는 가능한 짧고 명확하게 유지한다.

### 기준

- 한 가지 흐름이 자연스럽게 읽혀야 한다.
- 메서드 내부에서 여러 단계의 역할이 섞이지 않아야 한다.
- 메서드 추출보다 흐름 이해를 우선한다.

---

## 인자 정책

- 인자는 가능한 적게 유지한다.
- 인자가 많아지면 의미 단위로 묶는다.
- boolean 파라미터로 정책 차이를 숨기지 않는다.

좋은 예시:

    create(command)

지양하는 예시:

    create(isAdmin, isEvent, isTest)

---

## 검증과 흐름 분리

Service는 흐름을 조율하고,
검증은 Domain / Policy / Validator에 위임한다.

좋은 예시:

    validator.validateDuplicate()
    order.validateOwner()

지양하는 예시:

    if (...) {
        if (...) {
            ...
        }
    }

---

## early return / early throw

else보다 early return / throw를 우선한다.

좋은 예시:

    if (isInvalid()) {
        throw exception;
    }

    proceed();

지양하는 예시:

    if (isValid()) {
        proceed();
    } else {
        ...
    }

---

## 조건문 정책

- 조건문은 가능한 의미 있는 메서드로 추출한다.
- 복잡한 분기는 Policy 또는 객체 책임을 검토한다.
- switch보다 다형성을 우선 고려한다.

---

## null 정책

- null은 의미 있는 부재일 때만 사용한다.
- 조회 실패는 Optional 또는 예외로 표현한다.
- null 반환을 기본 전략으로 사용하지 않는다.

---

## 변수 선언

변수는 사용하는 위치 근처에서 선언한다.

좋은 예시:

    Order order = repository.findById(id);

지양하는 예시:

    Order order;

    ...

    order = repository.findById(id);

---

## 메서드 추출 기준

아래 상황은 메서드 추출 신호로 본다.

- 이름이 자연스럽게 붙는다.
- 조건문이 복잡해진다.
- 같은 흐름이 반복된다.
- 주석이 필요해진다.
- 하나의 메서드 안에서 역할이 바뀐다.

---

## 지양하는 구조

### 의미 없는 추상화

지양:
- 공통화만을 위한 메서드 추출
- 한 번만 사용하는 과도한 유틸 메서드

### 모호한 이름

지양:

    process()
    execute()
    handle()

### 정책 분기를 boolean으로 처리

지양:

    validate(isAdmin)

---

## 판단 기준

메서드 설계가 헷갈리면 아래 질문으로 판단한다.

- 이 메서드는 하나의 의도만 표현하는가?
- 이름만으로 역할을 이해 가능한가?
- 흐름과 판단이 섞여있지 않은가?
- 조건문이 정책을 숨기고 있지 않은가?

하나라도 NO라면 구조를 다시 검토한다.