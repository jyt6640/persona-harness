const { join } = require("node:path")
const { pathToFileURL } = require("node:url")

const OIDC_AUDIENCE = "persona-harness-project-finish-attestation"

async function runProjectFinishContextDiagnosticWithCore({ core }) {
  const token = await getIdToken(core)
  const { runProjectFinishContextDiagnosticAction } = await importSource("index.mjs")
  return runProjectFinishContextDiagnosticAction({
    githubActionsCoreToken: token,
  })
}

async function runRequiredNativeProjectFinishContextSelftestWithCore({ core }) {
  const token = await getIdToken(core)
  const { runRequiredNativeProjectFinishContextSelftest } = await importSource(
    "../project-finish-context-diagnostic-native-selftest/native-selftest.mjs",
  )
  return runRequiredNativeProjectFinishContextSelftest({
    getIdToken: async () => token,
  })
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
