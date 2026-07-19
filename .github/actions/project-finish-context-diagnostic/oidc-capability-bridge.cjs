const { join } = require("node:path")
const { pathToFileURL } = require("node:url")
const {
  contextBridgeFailure,
  createContextBridgeSummaryWriter,
  createNativeBridgeSummaryWriter,
  nativeBridgeFailure,
  nativeFallbackSummary,
} = require("./oidc-capability-bridge-summary.cjs")

const OIDC_AUDIENCE = "persona-harness-project-finish-attestation"

async function runProjectFinishContextDiagnosticWithCore({ core, runnerTemp }) {
  const summaryWriter = createContextBridgeSummaryWriter(runnerTemp)
  try {
    const token = await getIdToken(core)
    if (token === undefined) {
      const summary = contextBridgeFailure("capability")
      summaryWriter.replace(summary)
      return summary
    }
    try {
      const { runProjectFinishContextDiagnosticAction } = await importSource("index.mjs")
      return await runProjectFinishContextDiagnosticAction({
        githubActionsCoreToken: token,
      })
    } catch {
      const summary = contextBridgeFailure("bridge")
      summaryWriter.replace(summary)
      return summary
    }
  } finally {
    summaryWriter.close()
  }
}

async function runRequiredNativeProjectFinishContextSelftestWithCore({ core, runnerTemp }) {
  const summaryWriter = createNativeBridgeSummaryWriter(runnerTemp)
  try {
    summaryWriter.replace(nativeFallbackSummary())
    const token = await getIdToken(core)
    if (token === undefined) {
      const summary = nativeBridgeFailure("capability")
      summaryWriter.replace(summary)
      return summary
    }
    try {
      const { runRequiredNativeProjectFinishContextSelftest } = await importSource(
        "../project-finish-context-diagnostic-native-selftest/native-selftest.mjs",
      )
      return await runRequiredNativeProjectFinishContextSelftest({
        githubActionsCoreToken: token,
        summaryWriter,
      })
    } catch {
      const summary = nativeBridgeFailure("bridge")
      summaryWriter.replace(summary)
      return summary
    }
  } finally {
    summaryWriter.close()
  }
}

async function getIdToken(core) {
  if (typeof core !== "object" || core === null || typeof core.getIDToken !== "function") {
    return undefined
  }
  try {
    const token = await core.getIDToken(OIDC_AUDIENCE)
    return typeof token === "string" && token.length > 0 && token.length <= 16 * 1024 && !/[\u0000\r\n]/u.test(token)
      ? token
      : undefined
  } catch {
    return undefined
  }
}

function importSource(relativePath) {
  return import(pathToFileURL(join(__dirname, relativePath)).href)
}

module.exports = {
  runProjectFinishContextDiagnosticWithCore,
  runRequiredNativeProjectFinishContextSelftestWithCore,
}
