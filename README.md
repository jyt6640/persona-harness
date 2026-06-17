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
