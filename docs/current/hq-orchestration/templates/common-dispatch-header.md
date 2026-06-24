# Common Dispatch Header

공통 지시:

- 반드시 한국어로 답한다.
- 담당 범위 밖 작업은 직접 하지 말고 `Handoff`에 보고한다.
- 새 thread를 만들지 말고, 담당 영역의 기존 공용 lane을 재사용한다. HQ가 새 thread를 만들었다면 반복 업무용 공용 lane으로 승격할지 확인한다.
- 작업 단위별 atomic commit을 지킨다.
- 기능/테스트/문서/release 변경이 독립이면 커밋을 나눈다.
- 커밋 전 staged diff가 이번 작업만 포함하는지 확인한다.
- unrelated dirty file은 건드리거나 커밋에 섞지 않는다.
- push는 하지 않는다.
- 결과는 `result-report-format.md` 형식으로 보고한다.
- 모든 결과와 중요한 판단은 문서화 가능한 형태로 남긴다.
- 작업이 끝나면 자기 thread final answer에 결과를 남긴 뒤, 가능하면 thread tool로 HQ thread `019ed945-1bd4-7262-a4ff-66563c4cf0aa`에 같은 결과를 직접 보낸다.
- HQ로 보낼 때는 `[HQ_RESULT] <세션명>: <짧은 결과>` 제목으로 시작한다.
- thread tool이 없거나 HQ 전송에 실패하면 `Handoff`에 그 사실을 명시한다.
