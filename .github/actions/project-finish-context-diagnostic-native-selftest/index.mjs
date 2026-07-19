import { runRequiredNativeProjectFinishContextSelftest } from "./native-selftest.mjs"

const FAILURE_CODE = "project-finish-producer-context-diagnostic-selftest-failed"

await runRequiredNativeProjectFinishContextSelftest().catch(() => {
  process.stderr.write(`${FAILURE_CODE}\n`)
  process.exitCode = 1
})
