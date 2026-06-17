# Persona Harness

Persona Harness is an OpenCode plugin MVP for proving one path first:

```text
targetFile -> injection block -> model input
```

Phase 0 does not implement the full rule loader yet. It proves that a Java/Spring file touched by a tool call can be detected deterministically and that a Persona Harness injection block can be placed into the next model-input message through OpenCode's messages transform hook.

## OpenCode Shape

The plugin exports an OpenCode `PluginModule` from `src/index.ts`, matching the same high-level shape used by OMO/OpenCode plugins:

```ts
export default {
  id: "persona-harness",
  server: async () => hooks,
}
```

The Phase 0 hooks are:

- `tool.execute.before`: capture Java/Spring `targetFile` from read/edit/write-style tool arguments.
- `tool.execute.after`: capture the same file if the host only exposes tool arguments after execution.
- `experimental.chat.messages.transform`: prepend the pending injection block to the latest user message that will be sent to the model.

## Verify

```bash
npm install
npm test
npm run typecheck
npm run build
```

The tests create Java fixture paths under `.persona-test-fixtures/`, which is intentionally ignored by Git.

## Use Locally

Build the plugin first:

```bash
npm install
npm run build
```

Then register the built plugin from an OpenCode project config. In a Java/Spring project you want to test, add a plugin entry that points to this repository's built output:

```jsonc
{
  "plugin": [
    "/Users/yongtae/Desktop/persona-harness/dist/index.js"
  ]
}
```

After OpenCode loads the plugin, touch a Java/Spring file with a read/edit/write style tool call. Phase 0 currently watches Java file paths such as:

```text
**/*Controller.java
**/*Service.java
**/*Repository.java
**/*Entity.java
**/*Request.java
**/*Response.java
**/*Exception.java
**/*Test.java
```

For example, when a tool call targets:

```text
src/main/java/com/example/reservation/ReservationController.java
```

Persona Harness stores a pending injection for that OpenCode session. On the next `experimental.chat.messages.transform` hook, it prepends a block like this to the latest user message before it reaches the model:

```text
[Persona Harness Injection]

현재 파일: src/main/java/com/example/reservation/ReservationController.java
파일 역할: controller

적용 정책:
- Controller는 HTTP 요청/응답 변환만 담당한다.
- Controller에는 비즈니스 로직을 넣지 않는다.
- Entity를 API 응답으로 직접 반환하지 않는다.
- Request/Response DTO를 명시적으로 사용한다.
- 메서드는 하나의 의도를 가져야 한다.
- 메서드 이름은 구현 방식이 아니라 유스케이스와 의도를 드러내야 한다.
```

That is the Phase 0 proof: `targetFile -> injection block -> model input`.

## Test Flow

Run the local proof:

```bash
npm test
```

The test suite creates ignored Java fixture files under `.persona-test-fixtures/` and simulates OpenCode hook calls for:

- `ReservationController.java`
- `ReservationService.java`
- `ReservationEntity.java`

These fixture files are intentionally not committed.

## OMO Reference Code

Do not commit the OMO source into this repository. Keep it as a local ignored reference checkout instead:

```bash
mkdir -p references
git clone https://github.com/code-yeongyu/oh-my-openagent references/oh-my-openagent
```

`references/` is ignored by Git, so the source is available for local analysis without vendoring OMO into Persona Harness.

Useful OMO reference anchors:

```text
references/oh-my-openagent/packages/omo-opencode/src/index.ts
references/oh-my-openagent/packages/omo-opencode/src/testing/create-plugin-module.ts
references/oh-my-openagent/packages/omo-opencode/src/plugin/tool-execute-before.ts
references/oh-my-openagent/packages/omo-opencode/src/plugin/tool-execute-after.ts
references/oh-my-openagent/packages/omo-opencode/src/plugin/messages-transform.ts
```

Persona Harness should copy the OpenCode plugin shape, not the full OMO system.
