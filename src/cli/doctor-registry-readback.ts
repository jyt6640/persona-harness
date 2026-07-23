import { spawnSync } from "node:child_process"
import process from "node:process"

import {
  isDoctorRegistryVersion,
  type DoctorRegistryResponse,
} from "./doctor-registry.js"

export const DOCTOR_REGISTRY_ORIGIN = "https://registry.npmjs.org" as const
export const DOCTOR_REGISTRY_PACKAGE = "persona-harness" as const

export type DoctorRegistryRequest = {
  readonly args: readonly string[]
  readonly kind: "deprecation" | "dist-tags"
}

export type DoctorRegistryReader = (request: DoctorRegistryRequest) => DoctorRegistryResponse

export type DoctorRegistryReadback = {
  readonly deprecation: DoctorRegistryResponse
  readonly distTags: DoctorRegistryResponse
}

const MAX_REGISTRY_OUTPUT_BYTES = 64 * 1024
const REGISTRY_TIMEOUT_MS = 3_000

export function readDoctorRegistryFromNpm(
  installedVersion: unknown,
  reader: DoctorRegistryReader = readDoctorRegistryRequest,
): DoctorRegistryReadback {
  if (!isDoctorRegistryVersion(installedVersion)) {
    return {
      deprecation: { status: "unavailable" },
      distTags: { status: "malformed" },
    }
  }
  const distTags = reader({
    args: ["view", DOCTOR_REGISTRY_PACKAGE, "dist-tags", "--json", "--registry", DOCTOR_REGISTRY_ORIGIN],
    kind: "dist-tags",
  })
  const deprecation = reader({
    args: [
      "view",
      `${DOCTOR_REGISTRY_PACKAGE}@${installedVersion}`,
      "deprecated",
      "--json",
      "--registry",
      DOCTOR_REGISTRY_ORIGIN,
    ],
    kind: "deprecation",
  })
  return { deprecation, distTags }
}

function readDoctorRegistryRequest(request: DoctorRegistryRequest): DoctorRegistryResponse {
  const result = spawnSync("npm", request.args, {
    encoding: "utf8",
    env: process.env,
    maxBuffer: MAX_REGISTRY_OUTPUT_BYTES,
    stdio: ["ignore", "pipe", "ignore"],
    timeout: REGISTRY_TIMEOUT_MS,
  })
  if (result.error !== undefined) return errorResponse(result.error)
  if (result.signal !== null) return { status: "timeout" }
  if (result.status !== 0 || typeof result.stdout !== "string") return { status: "unavailable" }
  return Buffer.byteLength(result.stdout, "utf8") <= MAX_REGISTRY_OUTPUT_BYTES
    ? { status: "available", text: result.stdout.trim() }
    : { status: "malformed" }
}

function errorResponse(error: Error): DoctorRegistryResponse {
  if (isNodeError(error) && error.code === "ETIMEDOUT") return { status: "timeout" }
  if (isNodeError(error) && error.code === "ENOBUFS") return { status: "malformed" }
  return { status: "unavailable" }
}

function isNodeError(error: Error): error is NodeJS.ErrnoException {
  return "code" in error && typeof error.code === "string"
}
