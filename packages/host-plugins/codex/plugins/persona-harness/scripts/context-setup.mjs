import process$1 from "node:process";
import { fileURLToPath } from "node:url";
import { closeSync, constants, existsSync, fchmodSync, fstatSync, fsyncSync, linkSync, lstatSync, mkdirSync, openSync, readFileSync, readSync, realpathSync, renameSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, parse, posix, relative, resolve, sep, win32 } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { homedir } from "node:os";
//#region dist/context-core/context-budget.js
const DEFAULT_CONTEXT_BUDGET = Object.freeze({
	maxCapsules: 8,
	maxChars: 1600
});
//#endregion
//#region dist/config/jsonc.js
function isRecord$6(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function stripJsonComments(input) {
	let output = "";
	let index = 0;
	let inString = false;
	let escaped = false;
	while (index < input.length) {
		const current = input[index];
		const next = input[index + 1];
		if (inString) {
			output += current;
			if (escaped) escaped = false;
			else if (current === "\\") escaped = true;
			else if (current === "\"") inString = false;
			index += 1;
			continue;
		}
		if (current === "\"") {
			inString = true;
			output += current;
			index += 1;
			continue;
		}
		if (current === "/" && next === "/") {
			while (index < input.length && input[index] !== "\n") index += 1;
			continue;
		}
		if (current === "/" && next === "*") {
			index += 2;
			while (index < input.length && !(input[index] === "*" && input[index + 1] === "/")) index += 1;
			index += 2;
			continue;
		}
		output += current;
		index += 1;
	}
	return output;
}
//#endregion
//#region dist/config/context-config.js
const CONTEXT_CONFIG_KEYS = [
	"enabled",
	"maxCapsules",
	"maxChars",
	"mode"
];
const MAX_CONTEXT_CAPSULES$2 = 16;
const MAX_CONTEXT_CHARS$1 = 4e3;
const DEFAULT_CONTEXT_CONFIG = Object.freeze({
	enabled: false,
	maxCapsules: DEFAULT_CONTEXT_BUDGET.maxCapsules,
	maxChars: DEFAULT_CONTEXT_BUDGET.maxChars,
	mode: "targeted"
});
function parseContextConfig(value) {
	if (value === void 0) return {
		config: DEFAULT_CONTEXT_CONFIG,
		diagnostics: []
	};
	if (!isRecord$6(value) || !hasKnownKeys$2(value) || !hasValidValues(value)) return invalidContextConfig();
	return {
		config: {
			enabled: readBoolean$1(value.enabled, DEFAULT_CONTEXT_CONFIG.enabled),
			maxCapsules: readBoundedInteger(value.maxCapsules, DEFAULT_CONTEXT_CONFIG.maxCapsules),
			maxChars: readBoundedInteger(value.maxChars, DEFAULT_CONTEXT_CONFIG.maxChars),
			mode: "targeted"
		},
		diagnostics: []
	};
}
function invalidContextConfig() {
	return {
		config: DEFAULT_CONTEXT_CONFIG,
		diagnostics: [{
			code: "context-config-invalid",
			message: "Context configuration is invalid; Context remains disabled."
		}]
	};
}
function hasKnownKeys$2(value) {
	const knownKeys = new Set(CONTEXT_CONFIG_KEYS);
	return Object.keys(value).every((key) => knownKeys.has(key));
}
function hasValidValues(value) {
	return (value.enabled === void 0 || typeof value.enabled === "boolean") && (value.mode === void 0 || value.mode === "targeted") && (value.maxCapsules === void 0 || isBoundedInteger$1(value.maxCapsules, 1, MAX_CONTEXT_CAPSULES$2)) && (value.maxChars === void 0 || isBoundedInteger$1(value.maxChars, 1, MAX_CONTEXT_CHARS$1));
}
function readBoolean$1(value, fallback) {
	return typeof value === "boolean" ? value : fallback;
}
function readBoundedInteger(value, fallback) {
	return typeof value === "number" && Number.isInteger(value) ? value : fallback;
}
function isBoundedInteger$1(value, minimum, maximum) {
	return typeof value === "number" && Number.isInteger(value) && value >= minimum && value <= maximum;
}
//#endregion
//#region dist/io/no-follow-file.js
function captureNoFollowDirectory(path) {
	try {
		const stat = lstatSync(path, { bigint: true });
		if (stat.isSymbolicLink() || !stat.isDirectory()) return {
			code: "unsafe",
			kind: "blocked"
		};
		return {
			kind: "ready",
			value: pathIdentity(stat)
		};
	} catch (error) {
		return errno(error) === "ENOENT" ? { kind: "absent" } : {
			code: "unreadable",
			kind: "blocked"
		};
	}
}
function readNoFollowRegularFile(path, maxBytes, parentPath) {
	const beforeParent = parentPath === void 0 ? void 0 : captureNoFollowDirectory(parentPath);
	if (beforeParent?.kind === "blocked") return beforeParent;
	if (beforeParent?.kind === "absent") return {
		code: "unsafe",
		kind: "blocked"
	};
	let descriptor;
	try {
		descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
	} catch (error) {
		return errno(error) === "ENOENT" ? { kind: "absent" } : {
			code: "unsafe",
			kind: "blocked"
		};
	}
	try {
		const before = fstatSync(descriptor, { bigint: true });
		if (!isNoFollowSingleLinkRegularFile(before)) return {
			code: "unsafe",
			kind: "blocked"
		};
		if (before.size > BigInt(maxBytes)) return {
			code: "limit",
			kind: "blocked"
		};
		const bytes = readFixedSizeDescriptor(descriptor, Number(before.size));
		const after = fstatSync(descriptor, { bigint: true });
		const current = lstatSync(path, { bigint: true });
		if (!isNoFollowSingleLinkRegularFile(after) || !isNoFollowSingleLinkRegularFile(current) || !sameNoFollowPathIdentity(pathIdentity(before), pathIdentity(after)) || !sameNoFollowPathIdentity(pathIdentity(after), pathIdentity(current)) || bytes.byteLength !== Number(after.size)) return {
			code: "replaced",
			kind: "blocked"
		};
		if (beforeParent !== void 0 && parentPath !== void 0) {
			const afterParent = captureNoFollowDirectory(parentPath);
			if (afterParent.kind !== "ready" || !sameNoFollowPathIdentity(beforeParent.value, afterParent.value)) return {
				code: "replaced",
				kind: "blocked"
			};
		}
		return {
			kind: "ready",
			value: {
				bytes,
				identity: pathIdentity(after)
			}
		};
	} catch {
		return {
			code: "unreadable",
			kind: "blocked"
		};
	} finally {
		if (descriptor !== void 0) closeSync(descriptor);
	}
}
function readNoFollowProjectFile(projectDir, relativePath, maxBytes) {
	const segments = safeRelativeSegments(relativePath);
	if (segments === void 0) return {
		code: "unsafe",
		kind: "blocked"
	};
	const rootPath = resolve(projectDir);
	const root = captureNoFollowDirectory(rootPath);
	if (root.kind !== "ready") return root.kind === "absent" ? { kind: "absent" } : root;
	const reservations = [{
		identity: root.value,
		path: rootPath
	}];
	let parentPath = rootPath;
	for (const segment of segments.slice(0, -1)) {
		parentPath = join(parentPath, segment);
		const directory = captureNoFollowDirectory(parentPath);
		if (directory.kind !== "ready") return directory.kind === "absent" ? { kind: "absent" } : directory;
		reservations.push({
			identity: directory.value,
			path: parentPath
		});
	}
	const leaf = segments.at(-1);
	if (leaf === void 0) return {
		code: "unsafe",
		kind: "blocked"
	};
	const file = readNoFollowRegularFile(join(parentPath, leaf), maxBytes, parentPath);
	if (file.kind !== "ready") return file;
	for (const reservation of reservations) {
		const current = captureNoFollowDirectory(reservation.path);
		if (current.kind !== "ready" || !sameNoFollowPathIdentity(reservation.identity, current.value)) return {
			code: "replaced",
			kind: "blocked"
		};
	}
	return file;
}
function sameNoFollowPathIdentity(left, right) {
	return left.ctimeNs === right.ctimeNs && left.dev === right.dev && left.ino === right.ino && left.mode === right.mode && left.mtimeNs === right.mtimeNs && left.size === right.size;
}
function sameNoFollowPathLocation(left, right) {
	return left.dev === right.dev && left.ino === right.ino && left.mode === right.mode;
}
function noFollowPathIdentityFromStat(stat) {
	return pathIdentity(stat);
}
function isNoFollowSingleLinkRegularFile(stat) {
	return stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1n;
}
function pathIdentity(stat) {
	return {
		ctimeNs: stat.ctimeNs.toString(),
		dev: stat.dev.toString(),
		ino: stat.ino.toString(),
		mode: Number(stat.mode & 511n).toString(8).padStart(4, "0"),
		mtimeNs: stat.mtimeNs.toString(),
		size: stat.size.toString()
	};
}
function readFixedSizeDescriptor(descriptor, expectedBytes) {
	if (!Number.isSafeInteger(expectedBytes) || expectedBytes < 0) throw new Error("invalid bounded file size");
	const bytes = Buffer.alloc(expectedBytes);
	let offset = 0;
	while (offset < expectedBytes) {
		const read = readSync(descriptor, bytes, offset, expectedBytes - offset, offset);
		if (!Number.isSafeInteger(read) || read <= 0) throw new Error("bounded file read ended early");
		offset += read;
	}
	return bytes;
}
function errno(error) {
	return error !== null && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : void 0;
}
function safeRelativeSegments(relativePath) {
	if (relativePath.length === 0 || relativePath.length > 240 || relativePath.includes("\\0") || relativePath.includes("\\") || isAbsolute(relativePath)) return;
	const segments = relativePath.split("/");
	return segments.length === 0 || segments.some((segment) => !isSafeNoFollowRelativeSegment(segment)) ? void 0 : segments;
}
function isSafeNoFollowRelativeSegment(segment) {
	return segment.length > 0 && segment !== "." && segment !== ".." && !segment.endsWith(".") && /^[A-Za-z0-9._@+-]+$/u.test(segment);
}
//#endregion
//#region dist/cli/context-init.js
const CONFIG_FILE_NAME = "harness.jsonc";
const PERSONA_DIRECTORY_NAME = ".persona";
function runContextInitCommand(args, projectDir) {
	if (args.length === 0) return preview();
	if (args.length !== 1 || args[0] !== "--enable") return failure$4("context-init-arguments-invalid");
	const outcome = enableContext(projectDir);
	if (outcome === "created") return enabled();
	if (outcome === "existing") return failure$4("context-init-existing-config");
	if (outcome === "unsafe") return failure$4("context-init-path-unsafe");
	return failure$4("context-init-write-unavailable");
}
function enableContext(projectDir) {
	const rootPath = resolve(projectDir);
	const root = captureNoFollowDirectory(rootPath);
	if (root.kind !== "ready") return "unsafe";
	const persona = reservePersonaDirectory(rootPath, root.value);
	if (persona === void 0) return "unsafe";
	const configPath = join(persona.path, CONFIG_FILE_NAME);
	const before = inspectConfigFile(configPath);
	if (before === "existing") return "existing";
	if (before === "unsafe") {
		removeEmptyCreatedPersona(persona);
		return "unsafe";
	}
	let descriptor;
	let createdIdentity;
	let completed = false;
	try {
		if (!sameDirectoryLocation(rootPath, root.value) || !sameDirectoryLocation(persona.path, persona.identity)) return "unsafe";
		descriptor = openSync(configPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 384);
		const opened = fstatSync(descriptor, { bigint: true });
		if (!opened.isFile()) return "unsafe";
		createdIdentity = noFollowPathIdentityFromStat(opened);
		writeFileSync(descriptor, contextConfigText());
		fsyncSync(descriptor);
		const afterWrite = noFollowPathIdentityFromStat(fstatSync(descriptor, { bigint: true }));
		const pathAfterWrite = lstatSync(configPath, { bigint: true });
		if (!pathAfterWrite.isFile() || pathAfterWrite.isSymbolicLink() || !sameNoFollowPathIdentity(afterWrite, noFollowPathIdentityFromStat(pathAfterWrite)) || !sameDirectoryLocation(rootPath, root.value) || !sameDirectoryLocation(persona.path, persona.identity)) return "unsafe";
		createdIdentity = afterWrite;
		completed = true;
		return "created";
	} catch (error) {
		const after = inspectConfigFile(configPath);
		if (after === "existing" && createdIdentity === void 0) return "existing";
		if (after === "unsafe") return "unsafe";
		return isAlreadyPresent(error) ? "existing" : "unavailable";
	} finally {
		if (descriptor !== void 0) closeSync(descriptor);
		if (!completed && createdIdentity !== void 0) removeOwnedConfig(configPath, createdIdentity);
		if (!completed) removeEmptyCreatedPersona(persona);
	}
}
function reservePersonaDirectory(rootPath, rootIdentity) {
	const personaPath = join(rootPath, PERSONA_DIRECTORY_NAME);
	const existing = captureNoFollowDirectory(personaPath);
	if (existing.kind === "ready") return {
		created: false,
		identity: existing.value,
		path: personaPath
	};
	if (existing.kind === "blocked") return void 0;
	let createdHere = false;
	try {
		mkdirSync(personaPath, { mode: 448 });
		createdHere = true;
	} catch (error) {
		if (!isAlreadyPresent(error)) return void 0;
	}
	const created = captureNoFollowDirectory(personaPath);
	if (created.kind !== "ready" || !sameDirectoryLocation(rootPath, rootIdentity)) return void 0;
	return {
		created: createdHere,
		identity: created.value,
		path: personaPath
	};
}
function inspectConfigFile(path) {
	try {
		const stat = lstatSync(path, { bigint: true });
		return stat.isFile() && !stat.isSymbolicLink() ? "existing" : "unsafe";
	} catch (error) {
		return isMissing(error) ? "absent" : "unsafe";
	}
}
function sameDirectoryLocation(path, expected) {
	const current = captureNoFollowDirectory(path);
	return current.kind === "ready" && sameNoFollowPathLocation(current.value, expected);
}
function contextConfigText() {
	return `${JSON.stringify({ context: {
		enabled: true,
		maxCapsules: DEFAULT_CONTEXT_CONFIG.maxCapsules,
		maxChars: DEFAULT_CONTEXT_CONFIG.maxChars,
		mode: DEFAULT_CONTEXT_CONFIG.mode
	} }, null, 2)}\n`;
}
function preview() {
	return success$4([
		"Context Personalization (Experimental)",
		"Initialization: preview-only",
		"Context enabled: false",
		"Context Core: available",
		"No files were written.",
		""
	].join("\n"));
}
function enabled() {
	return success$4([
		"Context Personalization (Experimental)",
		"Initialization: enabled",
		"Configuration: .persona/harness.jsonc",
		"Context enabled: true",
		"No host adapter was activated.",
		""
	].join("\n"));
}
function success$4(stdout) {
	return {
		status: 0,
		stderr: "",
		stdout
	};
}
function failure$4(code) {
	return {
		status: 1,
		stderr: `${code}\n`,
		stdout: ""
	};
}
function removeOwnedConfig(path, expected) {
	try {
		const current = lstatSync(path, { bigint: true });
		if (current.isFile() && !current.isSymbolicLink() && sameNoFollowPathLocation(expected, noFollowPathIdentityFromStat(current))) unlinkSync(path);
	} catch {}
}
function removeEmptyCreatedPersona(persona) {
	if (!persona.created || !sameDirectoryLocation(persona.path, persona.identity)) return;
	try {
		rmdirSync(persona.path);
	} catch {}
}
function isAlreadyPresent(error) {
	return error !== null && typeof error === "object" && "code" in error && error.code === "EEXIST";
}
function isMissing(error) {
	return error !== null && typeof error === "object" && "code" in error && error.code === "ENOENT";
}
//#endregion
//#region dist/context-core/context-digest.js
var ContextDigestError = class extends Error {
	code = "context-digest-invalid";
	constructor() {
		super("context-digest-invalid");
		this.name = "ContextDigestError";
	}
};
function canonicalContextJson(value) {
	if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
	if (typeof value === "number") {
		if (!Number.isFinite(value)) throw new ContextDigestError();
		return JSON.stringify(value);
	}
	if (Array.isArray(value)) return `[${value.map((entry) => canonicalContextJson(entry)).join(",")}]`;
	if (isRecord$5(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalContextJson(value[key])}`).join(",")}}`;
	throw new ContextDigestError();
}
function canonicalContextDigest(value) {
	return createHash("sha256").update(canonicalContextJson(value)).digest("hex");
}
function isRecord$5(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
//#endregion
//#region dist/context-core/context-envelope.js
const CONTEXT_ENVELOPE_SCHEMA = "persona-context-envelope.v1";
//#endregion
//#region dist/context-core/context-renderer.js
const CONTEXT_DELIVERY_MARKER = "[Persona Harness Context]";
function renderContextBlock(capsules) {
	return capsules.length === 0 ? "" : `${CONTEXT_DELIVERY_MARKER}\n${capsules.join("\n")}`;
}
function renderContextEnvelope(envelope) {
	return envelope.status === "blocked" ? "" : renderContextBlock([...envelope.warnings.map((warning) => warning.message), ...envelope.selected.map((capsule) => capsule.content)]);
}
//#endregion
//#region dist/context-core/context-envelope-input.js
const INPUT_KEYS$1 = [
	"budget",
	"resolution",
	"target"
];
const TARGET_KEYS = [
	"fileRole",
	"language",
	"path"
];
const BUDGET_KEYS = ["maxCapsules", "maxChars"];
const RESOLVED_KEYS = [
	"conflicts",
	"selected",
	"shadowed",
	"status"
];
const BLOCKED_KEYS = [
	"conflicts",
	"reason",
	"selected",
	"shadowed",
	"status"
];
const SELECTION_KEYS = [
	"id",
	"layer",
	"reason",
	"rule",
	"topic"
];
const SHADOW_KEYS = [
	"id",
	"reason",
	"topic",
	"winnerId"
];
const CONFLICT_KEYS = [
	"reason",
	"ruleIds",
	"topic"
];
const MAX_CONTEXT_CAPSULES$1 = 16;
const MAX_CONTEXT_CHARS = 4e3;
function parseContextEnvelopeInput(value) {
	if (!isRecord$4(value) || !hasKnownKeys$1(value, INPUT_KEYS$1) || !Object.hasOwn(value, "resolution") || !Object.hasOwn(value, "target")) return void 0;
	const target = parseTarget(value.target);
	const budget = parseBudget(value.budget);
	const resolution = parseResolution(value.resolution);
	if (target === void 0 || budget === void 0 || resolution === void 0) return void 0;
	return {
		budget,
		resolution,
		target
	};
}
function isSafeEnvelopeIdentifier(value) {
	return typeof value === "string" && value.length > 0 && value.length <= 120 && !/[\u0000-\u001f\u007f]/u.test(value) && !/^(?:[A-Za-z]:[\\/]|[\\/]{1,2}|https?:\/\/)/u.test(value);
}
function parseTarget(value) {
	if (!isRecord$4(value) || !hasKnownKeys$1(value, TARGET_KEYS) || !isSafeRelativePath(value.path)) return void 0;
	const language = value.language;
	const fileRole = value.fileRole;
	if (!isOptionalIdentifier$1(language) || !isOptionalIdentifier$1(fileRole)) return void 0;
	if (language !== void 0 && fileRole !== void 0) return {
		fileRole,
		language,
		path: value.path
	};
	if (language !== void 0) return {
		language,
		path: value.path
	};
	if (fileRole !== void 0) return {
		fileRole,
		path: value.path
	};
	return { path: value.path };
}
function parseBudget(value) {
	if (value === void 0) return DEFAULT_CONTEXT_BUDGET;
	if (!isRecord$4(value) || !hasExactKeys$3(value, BUDGET_KEYS)) return void 0;
	if (!isBoundedInteger(value.maxCapsules, 1, MAX_CONTEXT_CAPSULES$1) || !isBoundedInteger(value.maxChars, 1, MAX_CONTEXT_CHARS)) return void 0;
	return {
		maxCapsules: value.maxCapsules,
		maxChars: value.maxChars
	};
}
function parseResolution(value) {
	if (!isRecord$4(value)) return void 0;
	if (value.status === "resolved") {
		const selected = parseSelections(value.selected);
		const shadowed = parseShadows(value.shadowed);
		if (!hasExactKeys$3(value, RESOLVED_KEYS) || selected === void 0 || shadowed === void 0 || !isEmptyArray(value.conflicts)) return void 0;
		return {
			conflicts: [],
			selected,
			shadowed,
			status: "resolved"
		};
	}
	if (value.status === "blocked") {
		const conflicts = parseConflicts(value.conflicts);
		if (!hasExactKeys$3(value, BLOCKED_KEYS) || !isBlockReason(value.reason) || !isEmptyArray(value.selected) || !isEmptyArray(value.shadowed) || conflicts === void 0) return void 0;
		return {
			conflicts,
			reason: value.reason,
			selected: [],
			shadowed: [],
			status: "blocked"
		};
	}
}
function parseSelections(value) {
	if (!Array.isArray(value)) return void 0;
	const selections = [];
	for (const entry of value) {
		if (!isRecord$4(entry) || !hasExactKeys$3(entry, SELECTION_KEYS) || typeof entry.id !== "string" || typeof entry.layer !== "string" || typeof entry.reason !== "string" || typeof entry.rule !== "string" || typeof entry.topic !== "string") return void 0;
		selections.push({
			id: entry.id,
			layer: entry.layer,
			reason: entry.reason,
			rule: entry.rule,
			topic: entry.topic
		});
	}
	return selections;
}
function parseShadows(value) {
	if (!Array.isArray(value)) return void 0;
	const shadows = [];
	for (const entry of value) {
		if (!isRecord$4(entry) || !hasExactKeys$3(entry, SHADOW_KEYS) || !isSafeEnvelopeIdentifier(entry.id) || entry.reason !== "higher-precedence" || !isSafeEnvelopeIdentifier(entry.topic) || !isSafeEnvelopeIdentifier(entry.winnerId)) return void 0;
		shadows.push({
			id: entry.id,
			reason: entry.reason,
			topic: entry.topic,
			winnerId: entry.winnerId
		});
	}
	return shadows;
}
function parseConflicts(value) {
	if (!Array.isArray(value)) return void 0;
	const conflicts = [];
	for (const entry of value) {
		if (!isRecord$4(entry) || !hasExactKeys$3(entry, CONFLICT_KEYS) || entry.reason !== "same-layer-conflict" || !isSafeEnvelopeIdentifier(entry.topic) || !isSafeIdentifierArray$1(entry.ruleIds) || entry.ruleIds.length < 2) return void 0;
		conflicts.push({
			reason: entry.reason,
			ruleIds: [...entry.ruleIds].sort(),
			topic: entry.topic
		});
	}
	return conflicts.sort((left, right) => left.topic.localeCompare(right.topic));
}
function isRecord$4(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function hasExactKeys$3(value, keys) {
	return Object.keys(value).length === keys.length && hasKnownKeys$1(value, keys);
}
function hasKnownKeys$1(value, keys) {
	const expected = new Set(keys);
	return Object.keys(value).every((key) => expected.has(key));
}
function isEmptyArray(value) {
	return Array.isArray(value) && value.length === 0;
}
function isBoundedInteger(value, minimum, maximum) {
	return typeof value === "number" && Number.isInteger(value) && value >= minimum && value <= maximum;
}
function isBlockReason(value) {
	return value === "malformed-input" || value === "profile-unavailable" || value === "ambiguous-conflict" || value === "selection-overflow";
}
function isOptionalIdentifier$1(value) {
	return value === void 0 || isSafeEnvelopeIdentifier(value);
}
function isSafeIdentifierArray$1(value) {
	return Array.isArray(value) && value.every((entry) => isSafeEnvelopeIdentifier(entry));
}
function isSafeRelativePath(value) {
	return isSafeEnvelopeIdentifier(value) && !value.split(/[\\/]/u).some((segment) => segment === "." || segment === "..");
}
//#endregion
//#region dist/context-core/context-envelope-builder.js
function buildContextEnvelope(value) {
	const parsed = parseContextEnvelopeInput(value);
	if (parsed === void 0) return blockedEnvelope("malformed-input", unavailableTarget(), [], DEFAULT_CONTEXT_BUDGET, 0, 0);
	if (parsed.resolution.status === "blocked") return blockedEnvelope("resolution-blocked", parsed.target, parsed.resolution.conflicts, parsed.budget, 0, 0);
	const selected = normalizeSelections(parsed.resolution.selected);
	if (selected === void 0) return blockedEnvelope("unsafe-content", parsed.target, [], parsed.budget, 0, 0);
	const usedCapsules = selected.length;
	const usedChars = renderContextBlock(selected.map((capsule) => capsule.content)).length;
	if (usedCapsules > parsed.budget.maxCapsules || usedChars > parsed.budget.maxChars) return blockedEnvelope("budget-exceeded", parsed.target, [], parsed.budget, usedCapsules, usedChars);
	return resolvedEnvelope(parsed.target, selected, normalizeShadows(parsed.resolution.shadowed), parsed.budget, usedCapsules, usedChars);
}
function normalizeSelections(selections) {
	const normalized = [];
	for (const selection of selections) {
		if (!isSafeEnvelopeIdentifier(selection.id) || !isContextLayer(selection.layer) || !isSafeEnvelopeIdentifier(selection.topic) || !isSelectionReason(selection.reason) || !isSafeRuleText$2(selection.rule)) return void 0;
		normalized.push({
			content: selection.rule,
			contentDigest: canonicalContextDigest(selection.rule),
			id: selection.id,
			layer: selection.layer,
			reason: selection.reason,
			topic: selection.topic
		});
	}
	return normalized.sort(compareCapsules);
}
function normalizeShadows(shadows) {
	return shadows.map(({ id, reason, winnerId }) => ({
		id,
		reason,
		winnerId
	})).sort((left, right) => left.id.localeCompare(right.id) || left.winnerId.localeCompare(right.winnerId));
}
function resolvedEnvelope(target, selected, shadowed, budget, usedCapsules, usedChars) {
	const payload = {
		budget: {
			...budget,
			usedCapsules,
			usedChars
		},
		conflicts: [],
		schemaVersion: CONTEXT_ENVELOPE_SCHEMA,
		selected,
		shadowed,
		status: "resolved",
		target,
		warnings: []
	};
	return {
		...payload,
		digest: canonicalContextDigest(payload)
	};
}
function blockedEnvelope(blockReason, target, conflicts, budget, usedCapsules, usedChars) {
	const payload = {
		blockReason,
		budget: {
			...budget,
			usedCapsules,
			usedChars
		},
		conflicts,
		schemaVersion: CONTEXT_ENVELOPE_SCHEMA,
		selected: [],
		shadowed: [],
		status: "blocked",
		target,
		warnings: []
	};
	return {
		...payload,
		digest: canonicalContextDigest(payload)
	};
}
function compareCapsules(left, right) {
	return layerPriority(right.layer) - layerPriority(left.layer) || left.topic.localeCompare(right.topic) || left.id.localeCompare(right.id);
}
function layerPriority(layer) {
	return [
		"common",
		"language",
		"personal",
		"team",
		"project",
		"task",
		"invariant"
	].indexOf(layer);
}
function unavailableTarget() {
	return { path: "unavailable" };
}
function isContextLayer(value) {
	return value === "invariant" || value === "task" || value === "project" || value === "team" || value === "personal" || value === "language" || value === "common";
}
function isSelectionReason(value) {
	return value === "topic+scope" || value === "topic+scope+file-role" || value === "topic+scope+file-role+language" || value === "topic+scope+file-role+language+skill" || value === "topic+scope+file-role+skill" || value === "topic+scope+language" || value === "topic+scope+language+skill" || value === "topic+scope+skill";
}
function isSafeRuleText$2(value) {
	return value.length > 0 && value.length <= 1e3 && !/[\u0000-\u001f\u007f]/u.test(value) && !/(?:https?:\/\/|(?:api[_-]?key|access[_-]?token|password|secret|authorization)\s*[:=])/iu.test(value) && !/(?:^|\s)(?:[A-Za-z]:[\\/]|[\\/]{1,2})[^\s]*/u.test(value) && !/(?:^|\n)\s*(?:class|const|export|function|import|package|private|public)\b/iu.test(value);
}
//#endregion
//#region dist/context-core/effective-context-v2-input.js
const INPUT_KEYS = [
	"commonDefaults",
	"languageDefaults",
	"maxCapsules",
	"personalProfileAvailable",
	"personalRules",
	"productInvariants",
	"projectContracts",
	"relevance",
	"taskDecisions",
	"teamContracts"
];
const RELEVANCE_KEYS = [
	"fileRole",
	"language",
	"projectKey",
	"skillIds",
	"taskKey",
	"teamKey",
	"topics"
];
const RULE_KEYS$2 = [
	"fileRoles",
	"id",
	"languages",
	"rule",
	"scope",
	"skillIds",
	"status",
	"topic"
];
const SCOPE_KEYS = ["key", "kind"];
function parseEffectiveContextInput(value) {
	if (!isRecord$3(value) || !hasRecognizedKeys(value, INPUT_KEYS)) return void 0;
	if (!isRuleArray(value.productInvariants) || !isRuleArray(value.taskDecisions) || !isRuleArray(value.projectContracts) || !isRuleArray(value.teamContracts) || !isRuleArray(value.personalRules) || !isRuleArray(value.languageDefaults) || !isRuleArray(value.commonDefaults)) return void 0;
	const relevance = parseRelevance(value.relevance);
	if (relevance === void 0) return void 0;
	if (!isValidMaxCapsules(value.maxCapsules) || !isValidAvailability(value.personalProfileAvailable)) return void 0;
	return {
		commonDefaults: value.commonDefaults,
		languageDefaults: value.languageDefaults,
		maxCapsules: value.maxCapsules,
		personalProfileAvailable: value.personalProfileAvailable,
		personalRules: value.personalRules,
		productInvariants: value.productInvariants,
		projectContracts: value.projectContracts,
		relevance,
		taskDecisions: value.taskDecisions,
		teamContracts: value.teamContracts
	};
}
function matchesContextRelevance(rule, relevance) {
	if (!relevance.topics.includes(rule.topic)) return false;
	if (!matchesScope(rule.scope, relevance)) return false;
	if (rule.fileRoles !== void 0 && !rule.fileRoles.includes(relevance.fileRole)) return false;
	if (rule.languages !== void 0 && !rule.languages.includes(relevance.language)) return false;
	return rule.skillIds === void 0 || rule.skillIds.some((skill) => relevance.skillIds.includes(skill));
}
function contextSelectionReason(rule) {
	return [
		"topic",
		"scope",
		...rule.fileRoles !== void 0 && rule.fileRoles.length > 0 ? ["file-role"] : [],
		...rule.languages !== void 0 && rule.languages.length > 0 ? ["language"] : [],
		...rule.skillIds !== void 0 && rule.skillIds.length > 0 ? ["skill"] : []
	].join("+");
}
function parseRelevance(value) {
	if (!isRecord$3(value) || !hasRecognizedKeys(value, RELEVANCE_KEYS)) return void 0;
	if (!isStringArray(value.topics) || value.topics.length === 0 || value.topics.some((topic) => !isSafeIdentifier$3(topic)) || !isSafeIdentifier$3(value.fileRole) || !isSafeIdentifier$3(value.language) || !isStringArray(value.skillIds) || value.skillIds.some((skill) => !isSafeIdentifier$3(skill))) return void 0;
	if (!isOptionalIdentifier(value.projectKey) || !isOptionalIdentifier(value.taskKey) || !isOptionalIdentifier(value.teamKey)) return void 0;
	return {
		fileRole: value.fileRole,
		language: value.language,
		projectKey: value.projectKey,
		skillIds: value.skillIds,
		taskKey: value.taskKey,
		teamKey: value.teamKey,
		topics: value.topics
	};
}
function isRuleArray(value) {
	return Array.isArray(value) && value.every((entry) => parseRule$2(entry) !== void 0);
}
function parseRule$2(value) {
	if (!isRecord$3(value) || !hasRecognizedKeys(value, RULE_KEYS$2)) return void 0;
	if (!isSafeIdentifier$3(value.id) || !isSafeIdentifier$3(value.topic) || !isSafeRuleText$1(value.rule)) return void 0;
	if (!isSafeIdentifierArray(value.fileRoles) || !isSafeIdentifierArray(value.languages) || !isSafeIdentifierArray(value.skillIds)) return void 0;
	if (value.status !== void 0 && value.status !== "active" && value.status !== "pending" && value.status !== "superseded") return void 0;
	const scope = parseScope$1(value.scope);
	if (value.scope !== void 0 && scope === void 0) return void 0;
	return {
		fileRoles: value.fileRoles,
		id: value.id,
		languages: value.languages,
		rule: value.rule,
		scope,
		skillIds: value.skillIds,
		status: value.status,
		topic: value.topic
	};
}
function parseScope$1(value) {
	if (value === void 0 || value === null) return value;
	if (!isRecord$3(value) || !hasRecognizedKeys(value, SCOPE_KEYS) || value.kind !== "project" && value.kind !== "task" && value.kind !== "team" || !isSafeIdentifier$3(value.key)) return void 0;
	return {
		key: value.key,
		kind: value.kind
	};
}
function matchesScope(scope, relevance) {
	if (scope === void 0 || scope === null) return true;
	if (scope.kind === "project") return relevance.projectKey === scope.key;
	if (scope.kind === "task") return relevance.taskKey === scope.key;
	return relevance.teamKey === scope.key;
}
function isValidMaxCapsules(value) {
	return value === void 0 || typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 16;
}
function isValidAvailability(value) {
	return value === void 0 || typeof value === "boolean";
}
function isRecord$3(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function hasRecognizedKeys(value, keys) {
	const expected = new Set(keys);
	return Object.keys(value).every((key) => expected.has(key));
}
function isStringArray(value) {
	return Array.isArray(value) && value.every((item) => typeof item === "string" && item.length <= 120 && !/[\u0000-\u001f\u007f]/u.test(item));
}
function isSafeIdentifierArray(value) {
	return value === void 0 || isStringArray(value) && value.every((item) => isSafeIdentifier$3(item));
}
function isOptionalIdentifier(value) {
	return value === void 0 || isSafeIdentifier$3(value);
}
function isSafeIdentifier$3(value) {
	return typeof value === "string" && value.length > 0 && value.length <= 120 && !/[\u0000-\u001f\u007f]/u.test(value) && !/^(?:[A-Za-z]:[\\/]|[\\/]{1,2}|https?:\/\/)/u.test(value);
}
function isSafeRuleText$1(value) {
	return typeof value === "string" && value.length > 0 && value.length <= 1e3 && !/[\u0000-\u001f\u007f]/u.test(value) && !/(?:https?:\/\/|(?:api[_-]?key|access[_-]?token|password|secret|authorization)\s*[:=])/iu.test(value) && !/(?:^|\s)(?:[A-Za-z]:[\\/]|[\\/]{1,2})[^\s]*/u.test(value);
}
//#endregion
//#region dist/context-core/effective-context-v2.js
const LAYER_DEFINITIONS = [
	{
		key: "productInvariants",
		layer: "invariant",
		priority: 6
	},
	{
		key: "taskDecisions",
		layer: "task",
		priority: 5
	},
	{
		key: "projectContracts",
		layer: "project",
		priority: 4
	},
	{
		key: "teamContracts",
		layer: "team",
		priority: 3
	},
	{
		key: "personalRules",
		layer: "personal",
		priority: 2
	},
	{
		key: "languageDefaults",
		layer: "language",
		priority: 1
	},
	{
		key: "commonDefaults",
		layer: "common",
		priority: 0
	}
];
function resolveEffectiveContext(value) {
	const parsed = parseEffectiveContextInput(value);
	if (parsed === void 0) return blocked$1("malformed-input");
	if (parsed.personalProfileAvailable === false) return blocked$1("profile-unavailable");
	const selection = selectHighestPrecedence(collectCandidates(parsed));
	if (selection.conflicts.length > 0) return blocked$1("ambiguous-conflict", selection.conflicts);
	const selected = selection.winners.sort(compareCandidates);
	if (selected.length > (parsed.maxCapsules ?? 8)) return blocked$1("selection-overflow");
	return {
		conflicts: [],
		selected: selected.map(({ layer, reason, rule }) => ({
			id: rule.id,
			layer,
			reason,
			rule: rule.rule,
			topic: rule.topic
		})),
		shadowed: selection.shadowed.sort(compareShadowed).map(({ shadow }) => shadow),
		status: "resolved"
	};
}
function collectCandidates(input) {
	const candidates = [];
	for (const definition of LAYER_DEFINITIONS) for (const rule of input[definition.key]) {
		if (rule.status !== void 0 && rule.status !== "active") continue;
		if (!matchesContextRelevance(rule, input.relevance)) continue;
		candidates.push({
			layer: definition.layer,
			priority: definition.priority,
			reason: contextSelectionReason(rule),
			rule
		});
	}
	return candidates;
}
function selectHighestPrecedence(candidates) {
	const byTopic = /* @__PURE__ */ new Map();
	for (const candidate of candidates) {
		const topicCandidates = byTopic.get(candidate.rule.topic) ?? [];
		topicCandidates.push(candidate);
		byTopic.set(candidate.rule.topic, topicCandidates);
	}
	const winners = [];
	const shadowed = [];
	const conflicts = [];
	for (const topic of [...byTopic.keys()].sort()) {
		const topicCandidates = byTopic.get(topic);
		if (topicCandidates === void 0) continue;
		const highestPriority = Math.max(...topicCandidates.map((candidate) => candidate.priority));
		const highest = topicCandidates.filter((candidate) => candidate.priority === highestPriority).sort(compareCandidates);
		if (highest.length !== 1) {
			conflicts.push({
				reason: "same-layer-conflict",
				ruleIds: highest.map((candidate) => candidate.rule.id).sort(),
				topic
			});
			continue;
		}
		const winner = highest[0];
		if (winner === void 0) continue;
		winners.push(winner);
		for (const candidate of topicCandidates) {
			if (candidate === winner) continue;
			shadowed.push({
				priority: winner.priority,
				shadow: {
					id: candidate.rule.id,
					reason: "higher-precedence",
					topic,
					winnerId: winner.rule.id
				}
			});
		}
	}
	return {
		conflicts,
		shadowed,
		winners
	};
}
function compareCandidates(left, right) {
	return right.priority - left.priority || left.rule.topic.localeCompare(right.rule.topic) || left.rule.id.localeCompare(right.rule.id);
}
function compareShadowed(left, right) {
	return right.priority - left.priority || left.shadow.topic.localeCompare(right.shadow.topic) || left.shadow.id.localeCompare(right.shadow.id);
}
function blocked$1(reason, conflicts = []) {
	return {
		conflicts,
		reason,
		selected: [],
		shadowed: [],
		status: "blocked"
	};
}
//#endregion
//#region dist/context-core/rule-types.js
const STARTER_PROFILE = Object.freeze([
	"Put responsibility with the object or data owner.",
	"Separate business judgment from execution flow.",
	"Prefer explicit intent over clever reuse.",
	"Add abstractions only after a demonstrated need.",
	"Require evidence before claiming completion."
]);
const PRODUCT_SAFETY_INVARIANTS = [{
	id: "invariant-no-inference",
	rule: "Do not infer unknown or conflicting decisions; stop for explicit input.",
	status: "active",
	topic: "safety-no-inference"
}, {
	id: "invariant-no-sensitive-persistence",
	rule: "Keep raw prompts, output, source, credentials, and absolute paths out of profile state.",
	status: "active",
	topic: "safety-no-sensitive-persistence"
}];
function createProductSafetyInvariants() {
	return PRODUCT_SAFETY_INVARIANTS.map((rule) => ({ ...rule }));
}
function createStarterProfileDefaults() {
	return STARTER_PROFILE.map((rule, index) => ({
		id: `starter-${index + 1}`,
		rule,
		status: "active",
		topic: `starter-${index + 1}`
	}));
}
//#endregion
//#region dist/io/bounded-path-walker.js
const MAX_DIAGNOSTIC_PATH_LENGTH = 240;
function normalizePath(value) {
	return value.replace(/\\/g, "/");
}
function boundedPath(value) {
	const normalized = normalizePath(value);
	return normalized.length <= MAX_DIAGNOSTIC_PATH_LENGTH ? normalized : `${normalized.slice(0, MAX_DIAGNOSTIC_PATH_LENGTH - 3)}...`;
}
function diagnostic(code, path, message) {
	return {
		code,
		message,
		path: boundedPath(path)
	};
}
function isInside(rootPath, candidatePath) {
	const relativePath = relative(rootPath, candidatePath);
	return relativePath === "" || relativePath !== ".." && !relativePath.startsWith(`..${sep}`) && !isAbsolute(relativePath);
}
function existingPathComponents(projectRoot, candidatePath) {
	const relativePath = relative(projectRoot, candidatePath);
	if (!isInside(projectRoot, candidatePath)) return diagnostic("config.path_escape", relativePath || candidatePath, "Configured path must remain inside the project root.");
	let currentPath = projectRoot;
	const segments = relativePath.split(sep).filter((segment) => segment.length > 0);
	for (const [index, segment] of segments.entries()) {
		currentPath = join(currentPath, segment);
		try {
			const stat = lstatSync(currentPath);
			if (stat.isSymbolicLink()) return diagnostic("config.path_symlink", segments.slice(0, index + 1).join("/"), "Configured path contains a symlink and is not followed.");
			if (index < segments.length - 1 && !stat.isDirectory()) return diagnostic("config.path_invalid", segments.slice(0, index + 1).join("/"), "Configured path contains a non-directory component.");
		} catch (error) {
			const code = error && typeof error === "object" && "code" in error ? error.code : void 0;
			if (code === "ENOENT" || code === "ENOTDIR") break;
			return diagnostic(code === "ELOOP" ? "config.path_symlink" : "config.path_invalid", segments.slice(0, index + 1).join("/"), "Configured path could not be inspected safely.");
		}
	}
}
function resolveContainedPath(projectDir, configuredPath) {
	if (configuredPath.trim().length === 0) return {
		diagnostic: diagnostic("config.path_invalid", configuredPath, "Configured path must not be empty."),
		ok: false
	};
	const projectRoot = resolve(projectDir);
	const candidatePath = isAbsolute(configuredPath) ? resolve(configuredPath) : resolve(projectRoot, configuredPath);
	const relativePath = relative(projectRoot, candidatePath);
	if (relativePath === "") return {
		diagnostic: diagnostic("config.path_invalid", configuredPath, "Configured path must not be the project root."),
		ok: false
	};
	const componentDiagnostic = existingPathComponents(projectRoot, candidatePath);
	if (componentDiagnostic !== void 0) return {
		diagnostic: componentDiagnostic,
		ok: false
	};
	return {
		ok: true,
		path: candidatePath,
		relativePath: normalizePath(relativePath)
	};
}
//#endregion
//#region dist/config/convention-registry.js
const CONTROLLER_REPOSITORY_CONVENTION = {
	actionableMessage: "route through a Service layer instead.",
	blockAllowed: true,
	blockerId: "architecture-controller-repository-direct-dependency",
	check: { kind: "observer" },
	defaultLevel: "block",
	fixPath: "route the Controller through a Service layer instead of depending on Repository directly.",
	highPrecision: true,
	id: "controller.repository-dependency",
	profileScope: "java-spring-service-architecture",
	scope: "single-file",
	stepId: "fix-controller-repository-dependency",
	writeGuard: true
};
const CONTROLLER_PERSISTENCE_IMPORT_CONVENTION = {
	actionableMessage: "keep persistence imports out of Controllers.",
	blockAllowed: true,
	blockerId: "architecture-controller-persistence-import",
	check: {
		kind: "ast-grep",
		rule: ".persona/conventions/controller-persistence-import.yml"
	},
	defaultLevel: "warn",
	fixPath: "move persistence/entity access behind a Service and expose DTOs at the Controller boundary.",
	highPrecision: true,
	id: "controller.persistence-import",
	profileScope: "java-spring-service-architecture",
	scope: "single-file",
	stepId: "fix-controller-persistence-import",
	targetFileSuffixes: ["Controller.java"],
	writeGuard: false
};
const SERVICE_STATE_OWNERSHIP_CONVENTION = {
	actionableMessage: "move in-memory state or id generation behind a Repository/persistence boundary.",
	blockAllowed: true,
	blockerId: "architecture-service-state-ownership",
	check: { kind: "observer" },
	defaultLevel: "block",
	fixPath: "move Service-owned Map/AtomicLong/id counters into a Repository or persistence-backed boundary.",
	highPrecision: true,
	id: "service.state-ownership",
	profileScope: "java-spring-service-architecture",
	scope: "single-file",
	stepId: "fix-service-state-ownership",
	targetFileSuffixes: ["Service.java"],
	writeGuard: false
};
const SPRING_BOOTJAR_ENABLED_CONVENTION = {
	actionableMessage: "keep bootJar enabled for executable Spring Boot applications.",
	blockAllowed: true,
	blockerId: "architecture-spring-bootjar-disabled",
	check: { kind: "observer" },
	defaultLevel: "block",
	fixPath: "remove the bootJar disabled override and fix Spring Boot plugin/JDK/Gradle compatibility instead.",
	highPrecision: true,
	id: "spring.bootjar-enabled",
	profileScope: "java-spring-service-architecture",
	scope: "tree",
	stepId: "fix-spring-bootjar-enabled",
	writeGuard: false
};
const DEFAULT_CONVENTION_LEVELS = {
	[CONTROLLER_REPOSITORY_CONVENTION.id]: CONTROLLER_REPOSITORY_CONVENTION.defaultLevel,
	[CONTROLLER_PERSISTENCE_IMPORT_CONVENTION.id]: CONTROLLER_PERSISTENCE_IMPORT_CONVENTION.defaultLevel,
	[SERVICE_STATE_OWNERSHIP_CONVENTION.id]: SERVICE_STATE_OWNERSHIP_CONVENTION.defaultLevel,
	[SPRING_BOOTJAR_ENABLED_CONVENTION.id]: SPRING_BOOTJAR_ENABLED_CONVENTION.defaultLevel
};
//#endregion
//#region dist/config/evidence-privacy.js
const EVIDENCE_MODE = {
	promptDiagnostics: "prompt_diagnostics",
	redactedDiagnostics: "redacted_diagnostics",
	safeMetadata: "safe_metadata"
};
const DEFAULT_EVIDENCE_MODE = EVIDENCE_MODE.safeMetadata;
function isEvidenceModeInput(value) {
	return value === EVIDENCE_MODE.safeMetadata || value === EVIDENCE_MODE.redactedDiagnostics || value === EVIDENCE_MODE.promptDiagnostics || value === "metadata_only";
}
function normalizeEvidenceMode(value) {
	if (value === EVIDENCE_MODE.redactedDiagnostics || value === EVIDENCE_MODE.promptDiagnostics) return value;
	return DEFAULT_EVIDENCE_MODE;
}
//#endregion
//#region dist/config/harness-config.js
const BACKEND_GUIDANCE_PACKS = [
	"domain-layout",
	"persistence-jdbc",
	"persistence-jpa",
	"migration-flyway",
	"error-contract-global",
	"testing-direct-class",
	"testing-gwt",
	"workflow-evidence"
];
const DEFAULT_MULTI_AGENT_ROLES = [
	"test-writer",
	"implementer",
	"reviewer"
];
const DEPRECATED_MULTI_AGENT_ROLE_ALIASES = {
	jaeki: "implementer",
	roach: "reviewer"
};
const DEFAULT_CONFIG = {
	conventions: DEFAULT_CONVENTION_LEVELS,
	context: DEFAULT_CONTEXT_CONFIG,
	enabled: true,
	rulesDir: ".persona/rules",
	evidenceDir: ".persona/evidence",
	features: {
		entrySteering: false,
		projectPhilosophyInjection: true,
		runtimeInjection: false,
		sharedSkillRouting: true,
		observerFindings: false
	},
	enforce: {
		compaction: {
			cooldownMs: 6e5,
			enabled: false,
			threshold: .78
		},
		executeVerification: false,
		idleContinuation: false,
		ralphLoop: {
			cooldownMs: 3e4,
			enabled: false,
			maxAttempts: 3,
			maxSessionAttempts: 9,
			toolOutputTrigger: false
		},
		systemConstitution: false,
		tdd: false,
		writeDeny: false
	},
	telemetry: { tokenUsage: true },
	multiAgent: {
		enabled: false,
		roles: DEFAULT_MULTI_AGENT_ROLES,
		models: {}
	},
	maxRulesPerInjection: 12,
	evidenceMode: DEFAULT_EVIDENCE_MODE,
	enabledDomains: [
		"backend",
		"programming",
		"workflow",
		"product"
	],
	scenario: "step1",
	backendPacks: []
};
const INVALID_CONFIG_PATH = ".persona/.invalid-config-path";
const FAIL_CLOSED_CONFIG = {
	...DEFAULT_CONFIG,
	context: DEFAULT_CONTEXT_CONFIG,
	enabled: false,
	rulesDir: INVALID_CONFIG_PATH,
	evidenceDir: INVALID_CONFIG_PATH,
	features: {
		entrySteering: false,
		projectPhilosophyInjection: false,
		runtimeInjection: false,
		sharedSkillRouting: false,
		observerFindings: false
	},
	enforce: {
		...DEFAULT_CONFIG.enforce,
		compaction: {
			...DEFAULT_CONFIG.enforce.compaction,
			enabled: false
		},
		executeVerification: false,
		idleContinuation: false,
		ralphLoop: {
			...DEFAULT_CONFIG.enforce.ralphLoop,
			enabled: false,
			toolOutputTrigger: false
		},
		systemConstitution: false,
		tdd: false,
		writeDeny: false
	},
	multiAgent: {
		enabled: false,
		roles: DEFAULT_MULTI_AGENT_ROLES,
		models: {}
	},
	telemetry: { tokenUsage: false }
};
function configDiagnostic(code, message) {
	return {
		code,
		message,
		path: ".persona/harness.jsonc"
	};
}
function isBooleanIfPresent(value, key) {
	return value[key] === void 0 || typeof value[key] === "boolean";
}
function isNumberIfPresent(value, key) {
	return value[key] === void 0 || typeof value[key] === "number" && Number.isFinite(value[key]);
}
function isStringIfPresent(value, key) {
	return value[key] === void 0 || typeof value[key] === "string" && value[key].trim() !== "";
}
function isRecordIfPresent(value, key) {
	return value[key] === void 0 || isRecord$6(value[key]);
}
function isBackendGuidancePack(value) {
	return typeof value === "string" && BACKEND_GUIDANCE_PACKS.some((pack) => pack === value);
}
function validConfigShape(value) {
	if (!isBooleanIfPresent(value, "enabled") || !isStringIfPresent(value, "rulesDir") || !isStringIfPresent(value, "evidenceDir") || !isRecordIfPresent(value, "features") || !isRecordIfPresent(value, "enforce") || !isRecordIfPresent(value, "telemetry") || !isRecordIfPresent(value, "multiAgent") || !isRecordIfPresent(value, "conventions") || value.enabledDomains !== void 0 && (!Array.isArray(value.enabledDomains) || value.enabledDomains.some((item) => typeof item !== "string" || item.trim() === "")) || !isNumberIfPresent(value, "maxRulesPerInjection") || typeof value.maxRulesPerInjection === "number" && (!Number.isInteger(value.maxRulesPerInjection) || value.maxRulesPerInjection <= 0) || value.evidenceMode !== void 0 && !isEvidenceModeInput(value.evidenceMode) || value.scenario !== void 0 && value.scenario !== "step1" && value.scenario !== "step2-3" || value.backendPacks !== void 0 && (!Array.isArray(value.backendPacks) || value.backendPacks.some((pack) => !isBackendGuidancePack(pack)))) return false;
	if (isRecord$6(value.conventions) && Object.values(value.conventions).some((level) => level !== "block" && level !== "report" && level !== "warn")) return false;
	if (isRecord$6(value.features)) {
		if (!isBooleanIfPresent(value.features, "entrySteering") || !isBooleanIfPresent(value.features, "projectPhilosophyInjection") || !isBooleanIfPresent(value.features, "runtimeInjection") || !isBooleanIfPresent(value.features, "sharedSkillRouting") || !isBooleanIfPresent(value.features, "observerFindings")) return false;
	}
	if (isRecord$6(value.telemetry) && !isBooleanIfPresent(value.telemetry, "tokenUsage")) return false;
	if (isRecord$6(value.multiAgent)) {
		if (!isBooleanIfPresent(value.multiAgent, "enabled") || value.multiAgent.roles !== void 0 && (!Array.isArray(value.multiAgent.roles) || value.multiAgent.roles.some((role) => typeof role !== "string")) || value.multiAgent.models !== void 0 && !isRecord$6(value.multiAgent.models) || isRecord$6(value.multiAgent.models) && Object.values(value.multiAgent.models).some((model) => typeof model !== "string" || model.trim() === "")) return false;
	}
	if (!isRecord$6(value.enforce)) return true;
	const enforce = value.enforce;
	if (!isBooleanIfPresent(enforce, "executeVerification") || !isBooleanIfPresent(enforce, "idleContinuation") || !isBooleanIfPresent(enforce, "systemConstitution") || !isBooleanIfPresent(enforce, "tdd") || !isBooleanIfPresent(enforce, "writeDeny") || !isRecordIfPresent(enforce, "compaction") || !isRecordIfPresent(enforce, "ralphLoop")) return false;
	if (isRecord$6(enforce.compaction) && (!isBooleanIfPresent(enforce.compaction, "enabled") || !isNumberIfPresent(enforce.compaction, "cooldownMs") || !isNumberIfPresent(enforce.compaction, "threshold"))) return false;
	if (isRecord$6(enforce.ralphLoop) && (!isBooleanIfPresent(enforce.ralphLoop, "enabled") || !isBooleanIfPresent(enforce.ralphLoop, "toolOutputTrigger") || !isNumberIfPresent(enforce.ralphLoop, "cooldownMs") || !isNumberIfPresent(enforce.ralphLoop, "maxAttempts") || !isNumberIfPresent(enforce.ralphLoop, "maxSessionAttempts"))) return false;
	return true;
}
function readBoolean(value, fallback) {
	return typeof value === "boolean" ? value : fallback;
}
function readString(value, fallback) {
	return typeof value === "string" && value.trim() !== "" ? value : fallback;
}
function readPositiveInteger(value, fallback) {
	return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : fallback;
}
function readNonNegativeInteger(value, fallback) {
	return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : fallback;
}
function readRatio(value, fallback) {
	return typeof value === "number" && value > 0 && value <= 1 ? value : fallback;
}
function readStringArray(value, fallback) {
	if (!Array.isArray(value)) return fallback;
	const strings = value.filter((item) => typeof item === "string" && item.trim() !== "");
	return strings.length > 0 ? strings : fallback;
}
function readScenario(value, fallback) {
	return value === "step2-3" ? "step2-3" : fallback;
}
function readBackendPacks(value) {
	if (!Array.isArray(value)) return DEFAULT_CONFIG.backendPacks;
	return value.filter(isBackendGuidancePack).filter((pack, index, packs) => packs.indexOf(pack) === index);
}
function readEvidenceMode(value) {
	return normalizeEvidenceMode(value);
}
function readEnforceConfig(value) {
	if (!isRecord$6(value)) return DEFAULT_CONFIG.enforce;
	return {
		compaction: readCompactionConfig(value.compaction),
		executeVerification: readBoolean(value.executeVerification, DEFAULT_CONFIG.enforce.executeVerification),
		idleContinuation: readBoolean(value.idleContinuation, DEFAULT_CONFIG.enforce.idleContinuation),
		ralphLoop: readRalphLoopConfig(value.ralphLoop),
		systemConstitution: readBoolean(value.systemConstitution, DEFAULT_CONFIG.enforce.systemConstitution),
		tdd: readBoolean(value.tdd, DEFAULT_CONFIG.enforce.tdd),
		writeDeny: readBoolean(value.writeDeny, DEFAULT_CONFIG.enforce.writeDeny)
	};
}
function readFeaturesConfig(value) {
	if (!isRecord$6(value)) return DEFAULT_CONFIG.features;
	return {
		entrySteering: readBoolean(value.entrySteering, DEFAULT_CONFIG.features.entrySteering),
		projectPhilosophyInjection: readBoolean(value.projectPhilosophyInjection, DEFAULT_CONFIG.features.projectPhilosophyInjection),
		runtimeInjection: readBoolean(value.runtimeInjection, DEFAULT_CONFIG.features.runtimeInjection),
		sharedSkillRouting: readBoolean(value.sharedSkillRouting, DEFAULT_CONFIG.features.sharedSkillRouting),
		observerFindings: readBoolean(value.observerFindings, DEFAULT_CONFIG.features.observerFindings)
	};
}
function readCompactionConfig(value) {
	if (!isRecord$6(value)) return DEFAULT_CONFIG.enforce.compaction;
	return {
		cooldownMs: readPositiveInteger(value.cooldownMs, DEFAULT_CONFIG.enforce.compaction.cooldownMs),
		enabled: readBoolean(value.enabled, DEFAULT_CONFIG.enforce.compaction.enabled),
		threshold: readRatio(value.threshold, DEFAULT_CONFIG.enforce.compaction.threshold)
	};
}
function readRalphLoopConfig(value) {
	if (!isRecord$6(value)) return DEFAULT_CONFIG.enforce.ralphLoop;
	const maxAttempts = readPositiveInteger(value.maxAttempts, DEFAULT_CONFIG.enforce.ralphLoop.maxAttempts);
	const maxSessionAttempts = readPositiveInteger(value.maxSessionAttempts, maxAttempts * 3);
	return {
		cooldownMs: readNonNegativeInteger(value.cooldownMs, DEFAULT_CONFIG.enforce.ralphLoop.cooldownMs),
		enabled: readBoolean(value.enabled, DEFAULT_CONFIG.enforce.ralphLoop.enabled),
		maxAttempts,
		maxSessionAttempts: Math.max(maxSessionAttempts, maxAttempts),
		toolOutputTrigger: readBoolean(value.toolOutputTrigger, DEFAULT_CONFIG.enforce.ralphLoop.toolOutputTrigger)
	};
}
function isMultiAgentRole(value) {
	return value === "test-writer" || value === "implementer" || value === "reviewer";
}
function isDeprecatedMultiAgentRole(value) {
	return value === "jaeki" || value === "roach";
}
function normalizeMultiAgentRole(value) {
	if (isMultiAgentRole(value)) return value;
	return isDeprecatedMultiAgentRole(value) ? DEPRECATED_MULTI_AGENT_ROLE_ALIASES[value] : void 0;
}
function deprecatedMultiAgentRoleFor(role) {
	for (const [deprecatedRole, normalizedRole] of Object.entries(DEPRECATED_MULTI_AGENT_ROLE_ALIASES)) if (normalizedRole === role) return isDeprecatedMultiAgentRole(deprecatedRole) ? deprecatedRole : void 0;
}
function readMultiAgentRoles(value) {
	if (!Array.isArray(value)) return DEFAULT_CONFIG.multiAgent.roles;
	const roles = [];
	for (const item of value) {
		const role = normalizeMultiAgentRole(item);
		if (role !== void 0 && !roles.includes(role)) roles.push(role);
	}
	return roles.length > 0 ? roles : DEFAULT_CONFIG.multiAgent.roles;
}
function readMultiAgentModels(value) {
	if (!isRecord$6(value)) return DEFAULT_CONFIG.multiAgent.models;
	const models = {};
	for (const role of DEFAULT_MULTI_AGENT_ROLES) {
		const legacyRole = deprecatedMultiAgentRoleFor(role);
		const model = typeof value[role] === "string" ? value[role] : legacyRole === void 0 ? void 0 : value[legacyRole];
		if (typeof model === "string" && model.trim() !== "") models[role] = model;
	}
	return models;
}
function readTelemetryConfig(value) {
	if (!isRecord$6(value)) return DEFAULT_CONFIG.telemetry;
	return { tokenUsage: readBoolean(value.tokenUsage, DEFAULT_CONFIG.telemetry.tokenUsage) };
}
function readMultiAgentConfig(value) {
	if (!isRecord$6(value)) return DEFAULT_CONFIG.multiAgent;
	return {
		enabled: readBoolean(value.enabled, DEFAULT_CONFIG.multiAgent.enabled),
		roles: readMultiAgentRoles(value.roles),
		models: readMultiAgentModels(value.models)
	};
}
function readConventionLevel(value) {
	return value === "block" || value === "report" || value === "warn" ? value : void 0;
}
function readConventionLevels(value) {
	if (!isRecord$6(value)) return DEFAULT_CONFIG.conventions;
	const levels = { ...DEFAULT_CONFIG.conventions };
	for (const [id, rawLevel] of Object.entries(value)) {
		const level = readConventionLevel(rawLevel);
		if (level !== void 0) levels[id] = level;
	}
	return levels;
}
function resolveConfiguredPathResult(projectDir, configuredPath) {
	return resolveContainedPath(projectDir, configuredPath);
}
function loadHarnessConfig(projectDir, projectReadBoundary) {
	return loadHarnessConfigResult(projectDir, projectReadBoundary).config;
}
function isContextPersonalizationEnabled(configResult) {
	return configResult.safe && configResult.contextDiagnostics.length === 0 && configResult.config.enabled && configResult.config.context.enabled;
}
function isProjectPhilosophyInjectionEnabled(config) {
	return config.enabled && config.features.projectPhilosophyInjection;
}
function loadHarnessConfigResult(projectDir, projectReadBoundary) {
	const file = projectReadBoundary === void 0 ? readNoFollowProjectFile(projectDir, ".persona/harness.jsonc", 8 * 1024 * 1024) : void 0;
	if (file?.kind === "blocked") return {
		config: FAIL_CLOSED_CONFIG,
		contextDiagnostics: [],
		safe: false,
		diagnostics: [configDiagnostic("config_read_failed", "Persona Harness configuration could not be read safely; read-only recovery is required.")]
	};
	const bytes = projectReadBoundary === void 0 ? file?.kind === "ready" ? file.value.bytes : void 0 : projectReadBoundary.readProjectFile(".persona/harness.jsonc");
	if (bytes === void 0) return {
		config: DEFAULT_CONFIG,
		contextDiagnostics: [],
		diagnostics: [],
		safe: true
	};
	let parsed;
	try {
		parsed = JSON.parse(stripJsonComments(bytes.toString("utf8")));
	} catch (error) {
		return {
			config: FAIL_CLOSED_CONFIG,
			contextDiagnostics: [],
			diagnostics: [configDiagnostic(error instanceof SyntaxError ? "malformed_config" : "config_read_failed", error instanceof SyntaxError ? "Failed to parse .persona/harness.jsonc; read-only recovery is required." : "Persona Harness configuration could not be read safely; read-only recovery is required.")],
			safe: false
		};
	}
	if (!isRecord$6(parsed)) return {
		config: FAIL_CLOSED_CONFIG,
		contextDiagnostics: [],
		diagnostics: [configDiagnostic("invalid_config", ".persona/harness.jsonc must contain a JSON object; read-only recovery is required.")],
		safe: false
	};
	if (!validConfigShape(parsed)) return {
		config: FAIL_CLOSED_CONFIG,
		contextDiagnostics: [],
		diagnostics: [configDiagnostic("invalid_config", ".persona/harness.jsonc has an invalid field shape; read-only recovery is required.")],
		safe: false
	};
	const contextResult = parseContextConfig(parsed.context);
	const config = {
		conventions: readConventionLevels(parsed.conventions),
		context: contextResult.config,
		enabled: readBoolean(parsed.enabled, DEFAULT_CONFIG.enabled),
		rulesDir: readString(parsed.rulesDir, DEFAULT_CONFIG.rulesDir),
		evidenceDir: readString(parsed.evidenceDir, DEFAULT_CONFIG.evidenceDir),
		features: readFeaturesConfig(parsed.features),
		enforce: readEnforceConfig(parsed.enforce),
		telemetry: readTelemetryConfig(parsed.telemetry),
		multiAgent: readMultiAgentConfig(parsed.multiAgent),
		maxRulesPerInjection: readPositiveInteger(parsed.maxRulesPerInjection, DEFAULT_CONFIG.maxRulesPerInjection),
		evidenceMode: readEvidenceMode(parsed.evidenceMode),
		enabledDomains: readStringArray(parsed.enabledDomains, DEFAULT_CONFIG.enabledDomains),
		scenario: readScenario(parsed.scenario, DEFAULT_CONFIG.scenario),
		backendPacks: readBackendPacks(parsed.backendPacks)
	};
	const pathDiagnostics = [["rulesDir", config.rulesDir], ["evidenceDir", config.evidenceDir]].flatMap(([name, configuredPath]) => {
		try {
			if (projectReadBoundary !== void 0) {
				projectReadBoundary.assertSafeProjectDirectoryPath(configuredPath);
				return [];
			}
			return resolveConfiguredPathResult(projectDir, configuredPath).ok ? [] : [configDiagnostic("unsafe_config_path", `${name} is outside the project root or traverses a symlink; read-only recovery is required.`)];
		} catch {
			return [configDiagnostic("unsafe_config_path", `${name} is outside the project root or traverses a symlink; read-only recovery is required.`)];
		}
	});
	if (pathDiagnostics.length > 0) return {
		config: FAIL_CLOSED_CONFIG,
		contextDiagnostics: contextResult.diagnostics,
		diagnostics: pathDiagnostics,
		safe: false
	};
	return {
		config,
		contextDiagnostics: contextResult.diagnostics,
		diagnostics: [],
		safe: true
	};
}
//#endregion
//#region dist/context-profile/team-profile-model.js
const TEAM_PROFILE_SCHEMA = "persona-team-profile.v1";
var TeamProfileValidationError = class extends Error {
	code;
	constructor(code) {
		super(code);
		this.name = "TeamProfileValidationError";
		this.code = code;
	}
};
const PROFILE_KEYS$1 = [
	"rules",
	"schemaVersion",
	"teamKey"
];
const RULE_KEYS$1 = [
	"fileRoles",
	"id",
	"languages",
	"rule",
	"skillIds",
	"status",
	"topic"
];
const MAX_RULES = 64;
const MAX_RULE_TEXT_CHARS = 600;
const MAX_SELECTOR_VALUES = 16;
function parseTeamProfile(value) {
	if (!isRecord$2(value) || !hasExactKeys$2(value, PROFILE_KEYS$1) || value.schemaVersion !== "persona-team-profile.v1" || !isSafeIdentifier$2(value.teamKey)) throw new TeamProfileValidationError("team-profile-invalid-schema");
	if (!Array.isArray(value.rules) || value.rules.length > MAX_RULES) throw new TeamProfileValidationError("team-profile-invalid-schema");
	const rules = value.rules.map(parseRule$1);
	if (hasDuplicate(rules.map((rule) => rule.id)) || hasActiveTopicConflict(rules)) throw new TeamProfileValidationError("team-profile-invalid-schema");
	return {
		rules,
		schemaVersion: TEAM_PROFILE_SCHEMA,
		teamKey: value.teamKey
	};
}
function toTeamContextRules(profile) {
	return profile.rules.map((rule) => ({
		fileRoles: rule.fileRoles,
		id: rule.id,
		languages: rule.languages,
		rule: rule.rule,
		scope: {
			key: profile.teamKey,
			kind: "team"
		},
		skillIds: rule.skillIds,
		status: rule.status,
		topic: rule.topic
	}));
}
function parseRule$1(value) {
	if (!isRecord$2(value) || !hasRequiredKnownKeys(value, RULE_KEYS$1, [
		"id",
		"rule",
		"status",
		"topic"
	])) throw new TeamProfileValidationError("team-profile-invalid-schema");
	if (!isSafeIdentifier$2(value.id) || !isSafeIdentifier$2(value.topic) || !isSafeRuleText(value.rule)) throw new TeamProfileValidationError("team-profile-unsafe-content");
	if (!isSafeSelector(value.fileRoles) || !isSafeSelector(value.languages) || !isSafeSelector(value.skillIds)) throw new TeamProfileValidationError("team-profile-invalid-schema");
	if (value.status !== "active" && value.status !== "pending" && value.status !== "superseded") throw new TeamProfileValidationError("team-profile-invalid-schema");
	return {
		fileRoles: value.fileRoles,
		id: value.id,
		languages: value.languages,
		rule: value.rule,
		skillIds: value.skillIds,
		status: value.status,
		topic: value.topic
	};
}
function hasActiveTopicConflict(rules) {
	const activeTopics = /* @__PURE__ */ new Set();
	for (const rule of rules) {
		if (rule.status !== "active") continue;
		if (activeTopics.has(rule.topic)) return true;
		activeTopics.add(rule.topic);
	}
	return false;
}
function hasDuplicate(values) {
	return new Set(values).size !== values.length;
}
function isRecord$2(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function hasExactKeys$2(value, keys) {
	return Object.keys(value).length === keys.length && hasKnownKeys(value, keys);
}
function hasRequiredKnownKeys(value, knownKeys, requiredKeys) {
	return hasKnownKeys(value, knownKeys) && requiredKeys.every((key) => Object.hasOwn(value, key));
}
function hasKnownKeys(value, keys) {
	const expected = new Set(keys);
	return Object.keys(value).every((key) => expected.has(key));
}
function isSafeSelector(value) {
	return value === void 0 || Array.isArray(value) && value.length <= MAX_SELECTOR_VALUES && value.every(isSafeIdentifier$2);
}
function isSafeIdentifier$2(value) {
	return typeof value === "string" && value.length > 0 && value.length <= 120 && !/[\u0000-\u001f\u007f]/u.test(value) && !/^(?:[A-Za-z]:[\\/]|[\\/]{1,2}|https?:\/\/)/u.test(value);
}
function isSafeRuleText(value) {
	return typeof value === "string" && value.length > 0 && value.length <= MAX_RULE_TEXT_CHARS && !/[\u0000-\u001f\u007f]/u.test(value) && !/(?:https?:\/\/|(?:api[_-]?key|access[_-]?token|token|credential|password|secret|authorization)\s*[:=])/iu.test(value) && !/(?:^|\s)(?:[A-Za-z]:[\\/]|[\\/]{1,2})[^\s]*/u.test(value) && !/(?:^|\n|\s)(?:bash|cmd|curl|fish|git|gradle|java|node|npm|npx|powershell|pwsh|python|rm|sh|wget|zsh)\b/iu.test(value) && !/(?:\b(?:send|post|transmit|upload|exfiltrat(?:e|ion)?)\b.*\b(?:credentials?|tokens?|secrets?|passwords?|data)\b|\b(?:credentials?|tokens?|secrets?|passwords?)\b.*\b(?:send|post|transmit|upload|exfiltrat(?:e|ion)?)\b)/iu.test(value) && !/\b(?:disable|bypass|override|weaken)\b.*\b(?:authority|authentication|evidence|guard|permission|policy|security|verification)\b/iu.test(value) && !/\b(?:my\s+(?:personal|private)|personal\s+preference)\b|(?:나의|개인)\s*(?:선호|취향|정보)/iu.test(value);
}
//#endregion
//#region dist/context-profile/team-profile-store.js
const TEAM_PROFILE_PATH = ".persona/team-profile.json";
const MAX_TEAM_PROFILE_BYTES = 64 * 1024;
function loadTeamProfile(projectDir) {
	const read = readNoFollowProjectFile(projectDir, TEAM_PROFILE_PATH, MAX_TEAM_PROFILE_BYTES);
	if (read.kind === "absent") return {
		diagnostics: [],
		status: "missing"
	};
	if (read.kind === "blocked") return {
		diagnostics: [read.code === "unsafe" || read.code === "replaced" ? "team-profile-unsafe-path" : "team-profile-unreadable"],
		status: "invalid"
	};
	let parsed;
	try {
		parsed = JSON.parse(read.value.bytes.toString("utf8"));
	} catch {
		return {
			diagnostics: ["team-profile-invalid-json"],
			status: "invalid"
		};
	}
	try {
		return {
			diagnostics: [],
			profile: parseTeamProfile(parsed),
			status: "available"
		};
	} catch (error) {
		return {
			diagnostics: [error instanceof TeamProfileValidationError ? error.code : "team-profile-invalid-schema"],
			status: "invalid"
		};
	}
}
//#endregion
//#region dist/cli/personalization-profile-model.js
const PERSONALIZATION_CANDIDATE_SCHEMA = "personalization-candidate.v1";
const PERSONALIZATION_RULE_SCHEMA = "personalization-rule.v1";
const PERSONALIZATION_DECISION_SCHEMA = "personalization-decision.v1";
const PERSONALIZATION_PROFILE_SCHEMA = "personalization-profile.v1";
const PERSONALIZATION_HISTORY_SCHEMA = "personalization-history.v1";
const PERSONALIZATION_STORE_SCHEMA = "personalization-store.v1";
var PersonalizationValidationError = class extends Error {
	code;
	constructor(code) {
		super(code);
		this.name = "PersonalizationValidationError";
		this.code = code;
	}
};
const CANDIDATE_KEYS = [
	"candidateId",
	"counterexample",
	"outcome",
	"provenance",
	"rationale",
	"rule",
	"schemaVersion",
	"scope",
	"topic",
	"tradeoffs"
];
const PROFILE_KEYS = [
	"activeRules",
	"decisions",
	"pendingCandidates",
	"schemaVersion"
];
const STORE_KEYS = [
	"history",
	"profile",
	"schemaVersion"
];
const DECISION_KEYS = [
	"action",
	"candidateId",
	"decidedAt",
	"decisionId",
	"ruleId",
	"schemaVersion",
	"scope"
];
const RULE_KEYS = [
	...CANDIDATE_KEYS.filter((key) => key !== "candidateId" && key !== "schemaVersion"),
	"activatedAt",
	"ruleId",
	"schemaVersion"
];
function emptyPersonalizationStore() {
	return {
		history: {
			events: [],
			schemaVersion: PERSONALIZATION_HISTORY_SCHEMA
		},
		profile: {
			activeRules: [],
			decisions: [],
			pendingCandidates: [],
			schemaVersion: PERSONALIZATION_PROFILE_SCHEMA
		},
		schemaVersion: PERSONALIZATION_STORE_SCHEMA
	};
}
function parsePersonalizationCandidate(value) {
	if (!isRecord$1(value) || !hasExactKeys$1(value, CANDIDATE_KEYS)) throw new PersonalizationValidationError("personalization-candidate-invalid");
	const candidate = parseCandidateFields(value);
	if (candidate === void 0) throw new PersonalizationValidationError("personalization-candidate-invalid");
	return candidate;
}
function parsePersonalizationStore(value) {
	if (!isRecord$1(value) || !hasExactKeys$1(value, STORE_KEYS) || value.schemaVersion !== "personalization-store.v1") throw new PersonalizationValidationError("personalization-store-corrupt");
	const profile = parseProfile(value.profile);
	const history = parseHistory(value.history);
	if (profile === void 0 || history === void 0) throw new PersonalizationValidationError("personalization-store-corrupt");
	const decisionIds = new Set(profile.decisions.map((decision) => decision.decisionId));
	if (history.events.some((event) => !decisionIds.has(event.decisionId))) throw new PersonalizationValidationError("personalization-store-corrupt");
	return {
		history,
		profile,
		schemaVersion: PERSONALIZATION_STORE_SCHEMA
	};
}
function scopesOverlap(left, right) {
	return left.kind === "personal" && right.kind === "personal" || left.kind !== "personal" && left.kind === right.kind && left.key === right.key;
}
function findConflictingRule(rules, candidate) {
	return rules.find((rule) => rule.topic === candidate.topic && scopesOverlap(rule.scope, candidate.scope));
}
function ruleFromCandidate(candidate, ruleId, activatedAt, scope = candidate.scope) {
	return {
		activatedAt,
		counterexample: candidate.counterexample,
		outcome: candidate.outcome,
		provenance: candidate.provenance,
		rationale: candidate.rationale,
		rule: candidate.rule,
		ruleId,
		schemaVersion: PERSONALIZATION_RULE_SCHEMA,
		scope,
		topic: candidate.topic,
		tradeoffs: candidate.tradeoffs
	};
}
function historyEvent(eventId, event, occurredAt, decisionId, candidateId, ruleId) {
	return {
		candidateId,
		decisionId,
		event,
		eventId,
		occurredAt,
		ruleId,
		schemaVersion: PERSONALIZATION_HISTORY_SCHEMA
	};
}
function parseCandidateFields(value) {
	const scope = parseScope(value.scope);
	const provenance = parseProvenance(value.provenance);
	if (value.schemaVersion !== "personalization-candidate.v1" || scope === void 0 || provenance === void 0) return void 0;
	const candidateId = value.candidateId;
	const topic = value.topic;
	const rule = value.rule;
	const rationale = value.rationale;
	const outcome = value.outcome;
	const counterexample = value.counterexample;
	const tradeoffs = value.tradeoffs;
	if (!isSafeText(candidateId, 80) || !isSafeText(topic, 80) || !isSafeText(rule, 600) || !isSafeText(rationale, 600) || !isSafeText(outcome, 600) || !isSafeText(counterexample, 600) || !isSafeText(tradeoffs, 600)) return void 0;
	if (!isSafeIdentifier$1(candidateId) || !isSafeTopic(topic)) return void 0;
	return {
		candidateId,
		counterexample,
		outcome,
		provenance,
		rationale,
		rule,
		schemaVersion: PERSONALIZATION_CANDIDATE_SCHEMA,
		scope,
		topic,
		tradeoffs
	};
}
function parseProfile(value) {
	if (!isRecord$1(value) || !hasExactKeys$1(value, PROFILE_KEYS) || value.schemaVersion !== "personalization-profile.v1") return void 0;
	if (!Array.isArray(value.activeRules) || !Array.isArray(value.pendingCandidates) || !Array.isArray(value.decisions)) return void 0;
	const activeRules = value.activeRules.map(parseRule);
	const pendingCandidates = value.pendingCandidates.map((candidate) => {
		try {
			return parsePersonalizationCandidate(candidate);
		} catch {
			return;
		}
	});
	const decisions = value.decisions.map(parseDecision);
	if (activeRules.some((rule) => rule === void 0) || pendingCandidates.some((candidate) => candidate === void 0) || decisions.some((decision) => decision === void 0)) return void 0;
	const rules = activeRules;
	const pending = pendingCandidates;
	const parsedDecisions = decisions;
	if (new Set(rules.map((rule) => rule.ruleId)).size !== rules.length || new Set(pending.map((candidate) => candidate.candidateId)).size !== pending.length || new Set(parsedDecisions.map((decision) => decision.decisionId)).size !== parsedDecisions.length) return void 0;
	if (rules.some((rule, index) => rules.slice(index + 1).some((other) => rule.topic === other.topic && scopesOverlap(rule.scope, other.scope)))) return void 0;
	return {
		activeRules: rules,
		decisions: parsedDecisions,
		pendingCandidates: pending,
		schemaVersion: PERSONALIZATION_PROFILE_SCHEMA
	};
}
function parseHistory(value) {
	if (!isRecord$1(value) || Object.keys(value).sort().join("|") !== "events|schemaVersion" || value.schemaVersion !== "personalization-history.v1" || !Array.isArray(value.events)) return void 0;
	const events = value.events.map((event) => parseHistoryEvent(event));
	if (events.some((event) => event === void 0)) return void 0;
	const parsedEvents = events;
	if (new Set(parsedEvents.map((event) => event.eventId)).size !== parsedEvents.length || new Set(parsedEvents.map((event) => event.decisionId)).size !== parsedEvents.length) return void 0;
	return {
		events: parsedEvents,
		schemaVersion: PERSONALIZATION_HISTORY_SCHEMA
	};
}
function parseRule(value) {
	if (!isRecord$1(value) || !hasExactKeys$1(value, RULE_KEYS)) return void 0;
	if (!isSafeIdentifier$1(value.ruleId) || !isSafeTimestamp(value.activatedAt)) return void 0;
	const candidate = parseCandidateFields({
		...value,
		candidateId: value.ruleId,
		schemaVersion: PERSONALIZATION_CANDIDATE_SCHEMA
	});
	return candidate !== void 0 ? ruleFromCandidate(candidate, value.ruleId, value.activatedAt) : void 0;
}
function parseDecision(value) {
	if (!isRecord$1(value) || !hasExactKeys$1(value, DECISION_KEYS) || !isSafeIdentifier$1(value.decisionId) || !isSafeTimestamp(value.decidedAt)) return void 0;
	if (![
		"activate",
		"retain",
		"exception",
		"supersede",
		"pending",
		"rollback"
	].includes(String(value.action))) return void 0;
	if (value.candidateId !== null && !isSafeIdentifier$1(value.candidateId)) return void 0;
	if (value.ruleId !== null && !isSafeIdentifier$1(value.ruleId)) return void 0;
	const scope = value.scope === null ? null : parseScope(value.scope);
	return scope === void 0 ? void 0 : {
		action: value.action,
		candidateId: value.candidateId,
		decidedAt: value.decidedAt,
		decisionId: value.decisionId,
		ruleId: value.ruleId,
		schemaVersion: PERSONALIZATION_DECISION_SCHEMA,
		scope
	};
}
function parseHistoryEvent(value) {
	if (!isRecord$1(value) || Object.keys(value).sort().join("|") !== "candidateId|decisionId|event|eventId|occurredAt|ruleId|schemaVersion") return void 0;
	if (value.schemaVersion !== "personalization-history.v1" || value.event === "" || !isSafeIdentifier$1(value.eventId) || !isSafeIdentifier$1(value.decisionId) || !isSafeTimestamp(value.occurredAt)) return void 0;
	if (value.candidateId !== null && !isSafeIdentifier$1(value.candidateId)) return void 0;
	if (value.ruleId !== null && !isSafeIdentifier$1(value.ruleId)) return void 0;
	if (![
		"activated",
		"conflict",
		"pending",
		"retained",
		"exception",
		"superseded",
		"rollback"
	].includes(value.event)) return void 0;
	return {
		candidateId: value.candidateId,
		decisionId: value.decisionId,
		event: value.event,
		eventId: value.eventId,
		occurredAt: value.occurredAt,
		ruleId: value.ruleId,
		schemaVersion: PERSONALIZATION_HISTORY_SCHEMA
	};
}
function parseScope(value) {
	if (!isRecord$1(value) || Object.keys(value).sort().join("|") !== "key|kind" || !isSafeIdentifier$1(value.key)) return void 0;
	if (value.kind === "personal" && value.key === "personal") return {
		key: value.key,
		kind: value.kind
	};
	return value.kind === "project" || value.kind === "task" ? {
		key: value.key,
		kind: value.kind
	} : void 0;
}
function parseProvenance(value) {
	if (!isRecord$1(value) || Object.keys(value).sort().join("|") !== "kind|reference" || !isSafeIdentifier$1(value.reference)) return void 0;
	return value.kind === "user" || value.kind === "review" || value.kind === "workflow" ? {
		kind: value.kind,
		reference: value.reference
	} : void 0;
}
function hasExactKeys$1(value, keys) {
	const actual = Object.keys(value).sort();
	return actual.length === keys.length && actual.every((key, index) => key === [...keys].sort()[index]);
}
function isSafeText(value, maxLength) {
	return typeof value === "string" && value.length > 0 && value.length <= maxLength && !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\r\n]/u.test(value) && !/```|(?:^|[\s("'])~[\\/]|(?:^|[\s("'])[A-Za-z]:[\\/]|(?:^|[\s("'])\/(?:[^/]|$)/u.test(value) && !/(?:^|[\s("'`])(?:sk-[A-Za-z0-9]|gh[pousr]_[A-Za-z0-9]|xox[baprs]-|AKIA[A-Z0-9]{12,})/u.test(value) && !/\b(?:password|passwd|api[ _-]?key|access[ _-]?token|token|secret)\s*[:=]/iu.test(value) && !/(?:https?|file):\/\//iu.test(value) && !/\b(?:function|class|interface|import|export|const|let|var)\s+[A-Za-z_$]/u.test(value) && !/[{};]|=>/u.test(value);
}
function isSafeIdentifier$1(value) {
	return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/u.test(value);
}
function isSafeTopic(value) {
	return typeof value === "string" && /^[a-z][a-z0-9._-]{1,63}$/u.test(value);
}
function isSafeTimestamp(value) {
	return typeof value === "string" && Number.isFinite(Date.parse(value)) && value.length <= 40;
}
function isRecord$1(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
//#endregion
//#region dist/io/no-follow-directory-chain.js
var NoFollowDirectoryChainError = class extends Error {
	constructor() {
		super("directory chain is unsafe");
		this.name = "NoFollowDirectoryChainError";
	}
};
function withNoFollowDirectoryChain(requestedPath, mode, operation) {
	let current;
	let previous;
	try {
		const absolutePath = absoluteDirectoryPath(requestedPath);
		previous = reserveCurrentDirectory();
		process$1.chdir(parse(absolutePath).root);
		current = reserveCurrentDirectory();
		const chain = [current];
		for (const segment of childSegments(absolutePath)) {
			const parent = current;
			current = reserveOrCreateCurrentChildDirectory(parent, segment, mode);
			chain.push(current);
			closeSync(parent.descriptor);
		}
		if (mode !== void 0 && process$1.platform !== "win32") {
			assertCurrentDirectory(current);
			assertDirectoryChainLocations(chain);
			fchmodSync(current.descriptor, mode);
			const identity = noFollowPathIdentityFromStat(fstatSync(current.descriptor, { bigint: true }));
			if (sameNoFollowPathLocation(previous.identity, current.identity)) previous = {
				...previous,
				identity
			};
			current = {
				...current,
				identity
			};
			chain[chain.length - 1] = current;
		}
		const reserved = current;
		const assertLocation = () => {
			assertCurrentDirectory(reserved);
			assertDirectoryChainLocations(chain);
		};
		assertLocation();
		const result = operation(assertLocation);
		assertLocation();
		return result;
	} catch {
		return;
	} finally {
		if (current !== void 0) closeReservedDirectory(current);
		if (previous !== void 0) {
			restoreCurrentDirectory(previous);
			closeReservedDirectory(previous);
		}
	}
}
function absoluteDirectoryPath(path) {
	if (!isAbsolute(path) || path.includes("\0")) throw new NoFollowDirectoryChainError();
	return resolve(path);
}
function childSegments(absolutePath) {
	const root = parse(absolutePath).root;
	const childPath = relative(root, absolutePath);
	if (childPath.length === 0) return [];
	const segments = childPath.split(sep);
	if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) throw new NoFollowDirectoryChainError();
	return segments;
}
function reserveCurrentDirectory() {
	const path = process$1.cwd();
	const current = captureNoFollowDirectory(path);
	if (current.kind !== "ready") throw new NoFollowDirectoryChainError();
	let descriptor;
	try {
		descriptor = openNoFollowDirectory(".");
		const identity = noFollowPathIdentityFromStat(fstatSync(descriptor, { bigint: true }));
		if (!sameNoFollowPathLocation(current.value, identity)) throw new NoFollowDirectoryChainError();
		const reservation = {
			descriptor,
			identity,
			path
		};
		descriptor = void 0;
		return reservation;
	} finally {
		if (descriptor !== void 0) closeReservedDescriptor(descriptor);
	}
}
function reserveOrCreateCurrentChildDirectory(parent, name, mode) {
	assertCurrentDirectory(parent);
	if (mode !== void 0) try {
		mkdirSync(name, { mode });
	} catch (error) {
		if (errorCode(error) !== "EEXIST") throw new NoFollowDirectoryChainError();
	}
	let descriptor;
	try {
		const beforeStat = lstatSync(name, { bigint: true });
		if (!beforeStat.isDirectory() || beforeStat.isSymbolicLink()) throw new NoFollowDirectoryChainError();
		const before = noFollowPathIdentityFromStat(beforeStat);
		descriptor = openNoFollowDirectory(name);
		const openedStat = fstatSync(descriptor, { bigint: true });
		const descriptorIdentity = noFollowPathIdentityFromStat(openedStat);
		const afterStat = lstatSync(name, { bigint: true });
		const after = noFollowPathIdentityFromStat(afterStat);
		if (!sameNoFollowPathLocation(before, after) || !sameNoFollowPathLocation(after, descriptorIdentity) || beforeStat.birthtimeNs !== openedStat.birthtimeNs || afterStat.birthtimeNs !== openedStat.birthtimeNs) throw new NoFollowDirectoryChainError();
		const reservation = {
			descriptor,
			identity: after,
			path: join(parent.path, name)
		};
		process$1.chdir(name);
		assertCurrentDirectory(reservation);
		descriptor = void 0;
		return reservation;
	} finally {
		if (descriptor !== void 0) closeReservedDescriptor(descriptor);
	}
}
function assertCurrentDirectory(reservation) {
	let descriptor;
	try {
		descriptor = openNoFollowDirectory(".");
		const current = noFollowPathIdentityFromStat(fstatSync(descriptor, { bigint: true }));
		if (!sameNoFollowPathLocation(reservation.identity, current)) throw new NoFollowDirectoryChainError();
	} finally {
		if (descriptor !== void 0) closeReservedDescriptor(descriptor);
	}
}
function assertDirectoryChainLocations(chain) {
	for (const reservation of chain) {
		const current = captureNoFollowDirectory(reservation.path);
		if (current.kind !== "ready" || !sameNoFollowPathLocation(reservation.identity, current.value)) throw new NoFollowDirectoryChainError();
	}
}
function openNoFollowDirectory(path) {
	const descriptor = openSync(path, process$1.platform === "win32" ? constants.O_RDONLY : constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
	try {
		if (!fstatSync(descriptor, { bigint: true }).isDirectory()) throw new NoFollowDirectoryChainError();
		return descriptor;
	} catch (error) {
		closeReservedDescriptor(descriptor);
		throw error;
	}
}
function restoreCurrentDirectory(previous) {
	try {
		const current = captureNoFollowDirectory(previous.path);
		if (current.kind === "ready" && sameNoFollowPathLocation(current.value, previous.identity)) {
			process$1.chdir(previous.path);
			assertCurrentDirectory(previous);
			return;
		}
	} catch {}
	try {
		process$1.chdir(parse(previous.path).root);
	} catch {}
}
function closeReservedDirectory(reservation) {
	closeReservedDescriptor(reservation.descriptor);
}
function closeReservedDescriptor(descriptor) {
	try {
		closeSync(descriptor);
	} catch {}
}
function errorCode(error) {
	return error !== null && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : void 0;
}
//#endregion
//#region dist/cli/personalization-file-boundary.js
const MAX_PERSONALIZATION_FILE_BYTES = 8 * 1024 * 1024;
var PersonalizationFileError = class extends Error {
	code;
	constructor(code) {
		super(code);
		this.code = code;
		this.name = "PersonalizationFileError";
	}
};
function readPersonalizationFile(root) {
	const directory = captureNoFollowDirectory(root);
	if (directory.kind === "absent") return { kind: "absent" };
	if (directory.kind === "blocked") throw new PersonalizationFileError("unsafe");
	return withStoreDirectory(root, void 0, readCurrentFile);
}
function withPersonalizationFileMutation(root, operation) {
	return withStoreDirectory(root, 448, (assertLocation) => {
		let lock;
		try {
			lock = openSync("profile.json.lock", constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 384);
		} catch (error) {
			throw new PersonalizationFileError(error !== null && typeof error === "object" && "code" in error && error.code === "EEXIST" ? "busy" : "unsafe");
		}
		try {
			const snapshot = readCurrentFile();
			return operation({
				snapshot,
				publish: (bytes) => publishCurrentFile(bytes, snapshot, assertLocation)
			});
		} finally {
			try {
				const opened = noFollowPathIdentityFromStat(fstatSync(lock, { bigint: true }));
				const current = lstatSync("profile.json.lock", { bigint: true });
				if (current.isSymbolicLink() || !sameNoFollowPathLocation(opened, noFollowPathIdentityFromStat(current))) throw new PersonalizationFileError("unsafe");
				unlinkSync("profile.json.lock");
			} finally {
				closeSync(lock);
			}
		}
	});
}
function withStoreDirectory(root, mode, operation) {
	const result = withNoFollowDirectoryChain(root, mode, (assertLocation) => {
		try {
			return {
				kind: "ready",
				value: operation(assertLocation)
			};
		} catch (error) {
			return {
				kind: "failed",
				error
			};
		}
	});
	if (result === void 0) throw new PersonalizationFileError("unsafe");
	if (result.kind === "failed") throw result.error;
	return result.value;
}
function readCurrentFile() {
	const file = readNoFollowRegularFile("profile.json", MAX_PERSONALIZATION_FILE_BYTES, ".");
	if (file.kind === "blocked") throw new PersonalizationFileError("unsafe");
	return file;
}
function sameSnapshot(left, right) {
	return left.kind === "absent" ? right.kind === "absent" : right.kind === "ready" && sameNoFollowPathIdentity(left.value.identity, right.value.identity);
}
function publishCurrentFile(bytes, expected, assertLocation) {
	assertLocation();
	if (bytes.byteLength > 8388608 || !sameSnapshot(expected, readCurrentFile())) throw new PersonalizationFileError("unsafe");
	const temporary = `.profile-${randomUUID()}.tmp`;
	const descriptor = openSync(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 384);
	let temporaryPresent = true;
	try {
		if (process.platform !== "win32") fchmodSync(descriptor, 384);
		writeFileSync(descriptor, bytes);
		fsyncSync(descriptor);
		assertLocation();
		if (!sameSnapshot(expected, readCurrentFile())) throw new PersonalizationFileError("unsafe");
		renameSync(temporary, "profile.json");
		temporaryPresent = false;
		const opened = noFollowPathIdentityFromStat(fstatSync(descriptor, { bigint: true }));
		const published = readCurrentFile();
		if (published.kind !== "ready" || !sameNoFollowPathIdentity(opened, published.value.identity)) throw new PersonalizationFileError("unsafe");
	} finally {
		closeSync(descriptor);
		if (temporaryPresent) unlinkSync(temporary);
	}
}
//#endregion
//#region dist/cli/personalization-store-io.js
var PersonalizationStoreError = class extends Error {
	code;
	constructor(code) {
		super(code);
		this.name = "PersonalizationStoreError";
		this.code = code;
	}
};
function resolvePersonalizationStoreRoot(options = {}) {
	const env = options.env ?? process.env;
	const platform = options.platform ?? process.platform;
	const path = platform === "win32" ? win32 : posix;
	const configured = firstNonEmpty(env.PH_HOME);
	if (configured !== void 0) return safeRoot(configured, path);
	if (platform === "win32") {
		const appData = firstNonEmpty(env.APPDATA);
		if (appData !== void 0) return safeRoot(path.join(appData, "persona-harness"), path);
	}
	const xdg = firstNonEmpty(env.XDG_CONFIG_HOME);
	if (xdg !== void 0) return safeRoot(path.join(xdg, "persona-harness"), path);
	const home = firstNonEmpty(options.homeDir) ?? firstNonEmpty(env.HOME) ?? firstNonEmpty(env.USERPROFILE) ?? homedir();
	return safeRoot(path.join(home, ".config", "persona-harness"), path);
}
function personalizationStorePath(options = {}) {
	const root = options.storeRoot ?? resolvePersonalizationStoreRoot(options);
	const path = options.platform === "win32" ? win32 : posix;
	return path.join(assertSafeStoreRoot(root, path), "profile.json");
}
function readPersonalizationStore(options = {}) {
	return readPersonalizationStoreSnapshot(options).document;
}
function readPersonalizationStoreSnapshot(options = {}) {
	return withStoreErrors(() => parseFileSnapshot(readPersonalizationFile(dirname(personalizationStorePath(options)))));
}
function parseFileSnapshot(file) {
	if (file.kind === "absent") return {
		status: "missing",
		document: emptyPersonalizationStore()
	};
	let parsed;
	try {
		parsed = JSON.parse(file.value.bytes.toString("utf8"));
	} catch (error) {
		if (error instanceof SyntaxError) throw new PersonalizationStoreError("personalization-store-corrupt");
		throw error;
	}
	try {
		return {
			status: "ready",
			document: parsePersonalizationStore(parsed)
		};
	} catch (error) {
		if (error instanceof PersonalizationValidationError && error.code === "personalization-store-corrupt") throw new PersonalizationStoreError("personalization-store-corrupt");
		throw error;
	}
}
function mutatePersonalizationStore(options, mutation) {
	return withStoreErrors(() => withPersonalizationFileMutation(dirname(personalizationStorePath(options)), (file) => {
		const result = mutation(parseFileSnapshot(file.snapshot).document);
		file.publish(serializedStore(result.document));
		return result;
	}));
}
function serializedStore(document) {
	let validated;
	try {
		validated = parsePersonalizationStore(document);
	} catch (error) {
		if (error instanceof PersonalizationValidationError) throw new PersonalizationStoreError("personalization-store-corrupt");
		throw error;
	}
	return Buffer.from(`${JSON.stringify(validated, null, 2)}\n`);
}
function withStoreErrors(operation) {
	try {
		return operation();
	} catch (error) {
		if (error instanceof PersonalizationFileError) throw new PersonalizationStoreError(error.code === "busy" ? "personalization-store-busy" : "personalization-store-unsafe");
		throw error;
	}
}
function assertSafeStoreRoot(root, path) {
	if (!path.isAbsolute(root) || root.includes("\0") || root.trim() === "") throw new PersonalizationStoreError("personalization-store-unsafe");
	const parsed = path.parse(root);
	let current = parsed.root;
	if (validateExistingDirectory(current) === "missing") throw new PersonalizationStoreError("personalization-store-unsafe");
	const relativeRoot = path.relative(parsed.root, root);
	for (const segment of relativeRoot.split(path.sep).filter((value) => value.length > 0)) {
		current = path.join(current, segment);
		if (validateExistingDirectory(current) === "missing") return root;
	}
	return root;
}
function validateExistingDirectory(candidate) {
	try {
		const stat = lstatSync(candidate);
		if (stat.isSymbolicLink() || !stat.isDirectory()) throw new PersonalizationStoreError("personalization-store-unsafe");
		const canonicalStat = lstatSync(realpathSync.native(candidate));
		if (canonicalStat.isSymbolicLink() || !canonicalStat.isDirectory()) throw new PersonalizationStoreError("personalization-store-unsafe");
		return "present";
	} catch (error) {
		if (error instanceof PersonalizationStoreError) throw error;
		if (isMissingPathError(error)) return "missing";
		throw new PersonalizationStoreError("personalization-store-unsafe");
	}
}
function isMissingPathError(error) {
	return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
function safeRoot(root, path) {
	if (!path.isAbsolute(root) || root.includes("\0") || root.trim() === "") throw new PersonalizationStoreError("personalization-store-unsafe");
	return root;
}
function firstNonEmpty(value) {
	return value === void 0 || value.trim() === "" ? void 0 : value;
}
//#endregion
//#region dist/cli/personalization-profile-store.js
function proposePersonalizationCandidate(value, options = {}, explicitPending = false) {
	let candidate;
	try {
		candidate = parsePersonalizationCandidate(value);
	} catch {
		throw new PersonalizationStoreError("personalization-candidate-invalid");
	}
	return mutatePersonalizationStore(options, (current) => {
		if (current.profile.activeRules.some((rule) => rule.ruleId === `rule-${candidate.candidateId}`) || current.profile.pendingCandidates.some((item) => item.candidateId === candidate.candidateId)) throw new PersonalizationStoreError("personalization-candidate-invalid");
		const now = timestamp(options);
		const decisionId = createId(options, "decision");
		const eventId = createId(options, "event");
		const conflict = findConflictingRule(current.profile.activeRules, candidate);
		if (explicitPending) {
			const event = historyEvent(eventId, "pending", now, decisionId, candidate.candidateId, null);
			return {
				document: withMutation(current, {
					action: "pending",
					candidate,
					decisionId,
					event,
					ruleId: null
				}),
				event,
				status: "pending"
			};
		}
		if (conflict !== void 0) {
			const event = historyEvent(eventId, "conflict", now, decisionId, candidate.candidateId, null);
			return {
				document: withMutation(current, {
					action: "pending",
					candidate,
					decisionId,
					event,
					ruleId: null
				}),
				event,
				status: "conflict"
			};
		}
		const ruleId = `rule-${candidate.candidateId}`;
		const rule = ruleFromCandidate(candidate, ruleId, now);
		const event = historyEvent(eventId, "activated", now, decisionId, candidate.candidateId, ruleId);
		return {
			document: withMutation(current, {
				action: "activate",
				candidate,
				decisionId,
				event,
				removeCandidate: true,
				rule,
				ruleId
			}),
			event,
			status: "activated"
		};
	});
}
function resolvePersonalizationCandidate(candidateId, action, options = {}, exceptionScope) {
	return mutatePersonalizationStore(options, (current) => {
		const candidate = current.profile.pendingCandidates.find((item) => item.candidateId === candidateId);
		if (candidate === void 0) throw new PersonalizationStoreError("personalization-candidate-missing");
		const now = timestamp(options);
		const decisionId = createId(options, "decision");
		const eventId = createId(options, "event");
		if (action === "exception" && (exceptionScope === void 0 || exceptionScope.kind === "personal")) throw new PersonalizationStoreError("personalization-resolution-invalid");
		const selectedScope = action === "exception" ? exceptionScope : candidate.scope;
		const conflict = current.profile.activeRules.find((rule) => rule.topic === candidate.topic && selectedScope !== void 0 && scopesOverlap(rule.scope, selectedScope));
		if (action === "exception" && conflict !== void 0) throw new PersonalizationStoreError("personalization-candidate-conflict");
		if (action === "supersede" && conflict === void 0) throw new PersonalizationStoreError("personalization-resolution-invalid");
		const ruleId = action === "exception" || action === "supersede" ? `rule-${candidate.candidateId}` : null;
		const rule = ruleId === null ? void 0 : ruleFromCandidate(candidate, ruleId, now, selectedScope);
		const eventName = action === "pending" ? "pending" : action === "retain" ? "retained" : action === "supersede" ? "superseded" : "exception";
		const event = historyEvent(eventId, eventName, now, decisionId, candidateId, ruleId);
		return {
			document: withMutation(current, {
				action,
				candidate,
				decisionId,
				event,
				replaceRule: action === "supersede" ? conflict : void 0,
				rule,
				ruleId,
				removeCandidate: action !== "pending"
			}),
			event,
			status: eventName
		};
	});
}
function rollbackPersonalizationRule(ruleId, options = {}) {
	return mutatePersonalizationStore(options, (current) => {
		if (current.profile.activeRules.find((item) => item.ruleId === ruleId) === void 0) throw new PersonalizationStoreError("personalization-rule-missing");
		const now = timestamp(options);
		const decisionId = createId(options, "decision");
		const event = historyEvent(createId(options, "event"), "rollback", now, decisionId, null, ruleId);
		return {
			document: withMutation(current, {
				action: "rollback",
				decisionId,
				event,
				removeRule: ruleId,
				ruleId
			}),
			event,
			status: "rollback"
		};
	});
}
function withMutation(current, mutation) {
	const activeRules = current.profile.activeRules.filter((rule) => rule.ruleId !== mutation.removeRule && rule.ruleId !== mutation.replaceRule?.ruleId);
	const nextRules = mutation.rule === void 0 ? activeRules : [...activeRules, mutation.rule];
	const removeCandidate = mutation.removeCandidate === true || mutation.action === "activate";
	const pendingCandidates = mutation.candidate === void 0 || removeCandidate ? current.profile.pendingCandidates.filter((candidate) => candidate.candidateId !== mutation.candidate?.candidateId) : [...current.profile.pendingCandidates, mutation.candidate];
	const scope = mutation.rule?.scope ?? null;
	const decision = {
		action: mutation.action,
		candidateId: mutation.candidate?.candidateId ?? null,
		decidedAt: mutation.event.occurredAt,
		decisionId: mutation.decisionId,
		ruleId: mutation.ruleId,
		schemaVersion: "personalization-decision.v1",
		scope
	};
	return {
		history: {
			events: [...current.history.events, mutation.event],
			schemaVersion: current.history.schemaVersion
		},
		profile: {
			activeRules: nextRules,
			decisions: [...current.profile.decisions, decision],
			pendingCandidates,
			schemaVersion: current.profile.schemaVersion
		},
		schemaVersion: current.schemaVersion
	};
}
function timestamp(options) {
	return (options.now ?? (() => /* @__PURE__ */ new Date()))().toISOString();
}
function createId(options, prefix) {
	return `${prefix}-${(options.idFactory ?? randomUUID)()}`;
}
//#endregion
//#region dist/cli/context-personalization.js
function readContextPersonalization(options, scopeKeys = {}) {
	const snapshot = readPersonalizationStoreSnapshot(options);
	const rules = snapshot.document.profile.activeRules;
	const warnings = snapshot.status === "missing" ? [{
		code: "personal-profile-missing",
		message: "No personal profile is initialized; defaults are not approved personal philosophy."
	}] : rules.length === 0 ? [{
		code: "personal-profile-empty",
		message: "The personal profile contains no active approved rules."
	}] : [];
	if (scopeKeys.projectKey === void 0 && rules.some((rule) => rule.scope.kind === "project")) warnings.push({
		code: "project-scope-unbound",
		message: "Project-scoped rules exist, but no project identity was supplied; those rules were not applied."
	});
	if (scopeKeys.taskKey === void 0 && rules.some((rule) => rule.scope.kind === "task")) warnings.push({
		code: "task-scope-unbound",
		message: "Task-scoped rules exist, but no task identity was supplied; those rules were not applied."
	});
	return {
		personalRules: rules.filter((rule) => rule.scope.kind === "personal").map(toContextRule$1),
		projectContracts: rules.filter((rule) => rule.scope.kind === "project").map(toContextRule$1),
		taskDecisions: rules.filter((rule) => rule.scope.kind === "task").map(toContextRule$1),
		warnings
	};
}
function withPersonalizationWarnings(envelope, profile, scopeKeys = {}) {
	const warnings = profile.warnings.filter((warning) => !(warning.code === "project-scope-unbound" && scopeKeys.projectKey !== void 0) && !(warning.code === "task-scope-unbound" && scopeKeys.taskKey !== void 0));
	if (warnings.length === 0) return envelope;
	const { digest: _digest, ...body } = envelope;
	const payload = {
		...body,
		warnings: [...body.warnings, ...warnings]
	};
	if (payload.status === "blocked") return {
		...payload,
		digest: canonicalContextDigest(payload)
	};
	const usedChars = renderContextEnvelope({
		...payload,
		digest: ""
	}).length;
	const budget = {
		...payload.budget,
		usedChars
	};
	if (usedChars > budget.maxChars) {
		const blocked = {
			...payload,
			budget,
			status: "blocked",
			blockReason: "budget-exceeded",
			selected: []
		};
		return {
			...blocked,
			digest: canonicalContextDigest(blocked)
		};
	}
	const resolved = {
		...payload,
		budget
	};
	return {
		...resolved,
		digest: canonicalContextDigest(resolved)
	};
}
function toContextRule$1(rule) {
	return {
		id: rule.ruleId,
		rule: rule.rule,
		scope: contextScope(rule.scope),
		status: "active",
		topic: rule.topic
	};
}
function contextScope(scope) {
	if (scope === void 0 || scope === null || scope.kind === "personal") return void 0;
	return {
		key: scope.key,
		kind: scope.kind
	};
}
//#endregion
//#region dist/cli/context-preview-request.js
function parseContextPreviewRequest(args) {
	if (args.length === 0) return {
		code: "context-target-required",
		status: "blocked"
	};
	const targetPath = parseTargetPath(args[0]);
	if (targetPath === void 0) return {
		code: "context-target-invalid",
		status: "blocked"
	};
	let format = "text";
	let projectKey;
	let taskKey;
	const topics = /* @__PURE__ */ new Set();
	for (let index = 1; index < args.length; index += 1) {
		const option = args[index];
		if (option === "--json") {
			if (format === "json") return invalidArguments();
			format = "json";
			continue;
		}
		if (option === "--project") {
			const value = optionValue(args, index);
			if (value === void 0 || projectKey !== void 0) return invalidArguments();
			projectKey = value;
			index += 1;
			continue;
		}
		if (option === "--task") {
			const value = optionValue(args, index);
			if (value === void 0 || taskKey !== void 0) return invalidArguments();
			taskKey = value;
			index += 1;
			continue;
		}
		if (option === "--topic") {
			const value = optionValue(args, index);
			if (value === void 0) return invalidArguments();
			topics.add(value);
			index += 1;
			continue;
		}
		return invalidArguments();
	}
	return {
		request: {
			format,
			projectKey,
			targetPath,
			taskKey,
			topics: [...topics].sort()
		},
		status: "ready"
	};
}
function invalidArguments() {
	return {
		code: "context-preview-arguments-invalid",
		status: "blocked"
	};
}
function optionValue(args, optionIndex) {
	const value = args[optionIndex + 1];
	return value !== void 0 && !value.startsWith("--") && isSafeIdentifier(value) ? value : void 0;
}
function parseTargetPath(value) {
	if (value === void 0 || value.length === 0 || value.length > 240 || /[\u0000-\u001f\u007f]/u.test(value)) return void 0;
	const normalized = value.replaceAll("\\\\", "/");
	if (normalized.startsWith("/") || /^(?:[A-Za-z]:\/|https?:\/\/)/u.test(normalized)) return void 0;
	if (normalized.split("/").some((segment) => segment.length === 0 || segment === "." || segment === "..")) return void 0;
	return normalized;
}
function isSafeIdentifier(value) {
	return /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/u.test(value);
}
//#endregion
//#region dist/cli/context-checkout-binding.js
const MAX_BYTES = 4096;
var ContextScopeError = class extends Error {
	code;
	constructor(code) {
		super(code);
		this.code = code;
		this.name = "ContextScopeError";
	}
};
function readCheckoutProjectBinding(projectDir, options = {}) {
	const result = readContextScopeBinding(projectDir, options);
	return result.status === "bound" ? {
		status: "bound",
		projectKey: result.scopeKey
	} : result;
}
function changeCheckoutProjectBinding(projectDir, change, options = {}) {
	const result = changeContextScopeBinding(projectDir, {
		action: change.action,
		scopeKey: change.projectKey
	}, options);
	return result.status === "bound" ? {
		status: "bound",
		projectKey: result.scopeKey
	} : result;
}
function readContextScopeBinding(projectDir, options) {
	const location = bindingLocation(projectDir, options);
	const file = readNoFollowProjectFile(location.root, location.relativePath, MAX_BYTES);
	switch (file.kind) {
		case "absent": return { status: "unbound" };
		case "blocked": throw new ContextScopeError("context-scope-unavailable");
		case "ready": return parseBinding(file.value.bytes, location);
		default: return assertNever(file);
	}
}
function changeContextScopeBinding(projectDir, change, options) {
	const checkoutPath = resolve(projectDir);
	const location = bindingLocation(checkoutPath, options);
	const root = captureNoFollowDirectory(location.root);
	if (root.kind !== "ready") throw new ContextScopeError("context-scope-unavailable");
	const existing = readContextScopeBinding(checkoutPath, options);
	if (existing.status === "bound" && existing.scopeKey !== change.scopeKey) throw new ContextScopeError(change.action === "bind" ? "context-scope-existing-binding" : "context-scope-key-mismatch");
	if (existing.status === "unbound" && change.action === "unbind") return existing;
	if (existing.status === "bound" && change.action === "bind") return existing;
	const result = withNoFollowDirectoryChain(join(location.root, location.directory), 448, () => {
		const parent = captureNoFollowDirectory("..");
		if (parent.kind !== "ready" || !sameNoFollowPathLocation(root.value, parent.value) || bindingLocation(checkoutPath, options).bindingDigest !== location.bindingDigest) throw new ContextScopeError("context-scope-unavailable");
		const leaf = basename(location.relativePath);
		const lock = `${leaf}.lock`;
		const lockDescriptor = openSync(lock, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 384);
		try {
			const latest = readContextScopeBinding(checkoutPath, options);
			if (latest.status === "bound" && latest.scopeKey !== change.scopeKey) throw new ContextScopeError(change.action === "bind" ? "context-scope-existing-binding" : "context-scope-key-mismatch");
			if (latest.status === "unbound" && change.action === "unbind") return latest;
			if (latest.status === "bound" && change.action === "bind") return latest;
			switch (change.action) {
				case "bind": {
					const temporary = `.binding-${randomUUID()}.tmp`;
					const descriptor = openSync(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 384);
					let temporaryPresent = true;
					try {
						writeFileSync(descriptor, `${JSON.stringify({
							schemaVersion: location.schema,
							[location.digestField]: location.bindingDigest,
							[location.keyField]: change.scopeKey
						})}\n`);
						fsyncSync(descriptor);
						linkSync(temporary, leaf);
						unlinkSync(temporary);
						temporaryPresent = false;
						const opened = fstatSync(descriptor, { bigint: true });
						const current = lstatSync(leaf, { bigint: true });
						if (!opened.isFile() || opened.nlink !== 1n || current.isSymbolicLink() || !sameNoFollowPathLocation(noFollowPathIdentityFromStat(opened), noFollowPathIdentityFromStat(current))) throw new ContextScopeError("context-scope-unavailable");
					} finally {
						closeSync(descriptor);
						if (temporaryPresent) unlinkSync(temporary);
					}
					return {
						status: "bound",
						scopeKey: change.scopeKey
					};
				}
				case "unbind": {
					const file = readNoFollowProjectFile(location.root, location.relativePath, MAX_BYTES);
					if (file.kind !== "ready" || parseBinding(file.value.bytes, location).scopeKey !== change.scopeKey) throw new ContextScopeError("context-scope-unavailable");
					unlinkSync(leaf);
					return { status: "unbound" };
				}
				default: return assertNever(change.action);
			}
		} finally {
			closeSync(lockDescriptor);
			unlinkSync(lock);
		}
	});
	if (result === void 0) throw new ContextScopeError("context-scope-unavailable");
	return result;
}
function bindingLocation(projectDir, options) {
	if (options.taskSession !== void 0 && !/^[a-f0-9]{64}$/u.test(options.taskSession)) throw new ContextScopeError("context-scope-invalid");
	const projectPath = resolve(projectDir);
	const captured = captureNoFollowDirectory(projectPath);
	if (captured.kind !== "ready") throw new ContextScopeError("context-scope-unavailable");
	let canonicalPath;
	let birthtime;
	try {
		canonicalPath = realpathSync.native(projectPath);
		const stat = lstatSync(canonicalPath, { bigint: true });
		if (!stat.isDirectory() || !sameNoFollowPathLocation(captured.value, noFollowPathIdentityFromStat(stat))) throw new ContextScopeError("context-scope-unavailable");
		birthtime = stat.birthtimeNs.toString();
	} catch (error) {
		if (error instanceof ContextScopeError) throw error;
		throw new ContextScopeError("context-scope-unavailable");
	}
	const checkoutDigest = canonicalContextDigest({
		path: canonicalPath,
		dev: captured.value.dev,
		ino: captured.value.ino,
		birthtime
	});
	const root = dirname(personalizationStorePath(options));
	const task = options.taskSession !== void 0;
	const bindingDigest = task ? canonicalContextDigest({
		checkoutDigest,
		sessionHandle: options.taskSession
	}) : checkoutDigest;
	const directory = task ? "task-bindings" : "project-bindings";
	return {
		root,
		bindingDigest,
		directory,
		relativePath: `${directory}/${bindingDigest}.json`,
		schema: task ? "persona-context-task-binding.1" : "persona-context-checkout-binding.1",
		digestField: task ? "bindingDigest" : "checkoutDigest",
		keyField: task ? "taskKey" : "projectKey"
	};
}
function parseBinding(bytes, location) {
	let value;
	try {
		value = JSON.parse(bytes.toString("utf8"));
	} catch (error) {
		if (error instanceof SyntaxError) throw new ContextScopeError("context-scope-invalid");
		throw error;
	}
	if (!isRecord$6(value) || Object.keys(value).length !== 3 || value.schemaVersion !== location.schema || value[location.digestField] !== location.bindingDigest) throw new ContextScopeError("context-scope-invalid");
	const scopeKey = value[location.keyField];
	if (typeof scopeKey !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/u.test(scopeKey)) throw new ContextScopeError("context-scope-invalid");
	return {
		status: "bound",
		scopeKey
	};
}
function assertNever(value) {
	throw new ContextScopeError("context-scope-invalid");
}
//#endregion
//#region dist/cli/context-preview.js
function runContextPreviewCommand(args, projectDir, options = {}) {
	const result = readContextPreview(args, projectDir, options);
	if (result.status === "blocked") return failure$3(result.code);
	const { contextEnabled, detected, envelope } = result.preview;
	const output = {
		contextEnabled,
		detected,
		envelope
	};
	return args.includes("--json") ? success$3(`${JSON.stringify(output)}\n`) : success$3(renderPreview(contextEnabled, detected, envelope));
}
function readContextPreview(args, projectDir, options = {}) {
	return createContextPreviewReader(projectDir, options)(args);
}
function createContextPreviewReader(projectDir, options = {}) {
	let sources;
	return (args) => {
		const parsed = parseContextPreviewRequest(args);
		if (parsed.status === "blocked") return blocked(parsed.code);
		sources ??= readContextPreviewSources(projectDir, options);
		return sources.status === "blocked" ? sources : previewFromSources(parsed.request, sources);
	};
}
function readContextPreviewSources(projectDir, options) {
	const configResult = loadHarnessConfigResult(projectDir);
	if (!configResult.safe) return blocked("context-config-unavailable");
	if (configResult.contextDiagnostics.length > 0) return blocked("context-config-invalid");
	const teamResult = loadTeamProfile(projectDir);
	if (teamResult.status === "invalid") return blocked("context-team-profile-invalid");
	let personalization;
	let binding;
	try {
		personalization = readContextPersonalization(options.personalization);
		binding = readCheckoutProjectBinding(projectDir, options.personalization);
	} catch (error) {
		if (error instanceof ContextScopeError) return blocked("context-scope-unavailable");
		if (error instanceof PersonalizationStoreError) return blocked("context-personal-profile-unavailable");
		throw error;
	}
	return {
		status: "ready",
		configResult,
		teamResult,
		personalization,
		binding
	};
}
function previewFromSources(request, sources) {
	const { configResult, teamResult, personalization } = sources;
	const projectKey = request.projectKey ?? (sources.binding.status === "bound" ? sources.binding.projectKey : void 0);
	const detected = detectTarget(request.targetPath);
	const teamRules = teamResult.status === "available" ? toTeamContextRules(teamResult.profile) : [];
	const productInvariants = invariantRules();
	const commonDefaults = starterRules();
	const topics = selectedTopics(request, [
		...productInvariants,
		...commonDefaults,
		...teamRules,
		...personalization.personalRules,
		...personalization.projectContracts,
		...personalization.taskDecisions
	]);
	if (topics === void 0) return blocked("context-topic-unavailable");
	const resolution = resolveEffectiveContext({
		commonDefaults,
		languageDefaults: [],
		maxCapsules: configResult.config.context.maxCapsules,
		personalRules: personalization.personalRules,
		productInvariants,
		projectContracts: personalization.projectContracts,
		relevance: {
			fileRole: detected.fileRole,
			language: detected.language,
			projectKey,
			skillIds: [],
			taskKey: request.taskKey,
			teamKey: teamResult.status === "available" ? teamResult.profile.teamKey : void 0,
			topics
		},
		taskDecisions: personalization.taskDecisions,
		teamContracts: teamRules
	});
	const envelope = buildContextEnvelope({
		budget: {
			maxCapsules: configResult.config.context.maxCapsules,
			maxChars: configResult.config.context.maxChars
		},
		resolution,
		target: {
			fileRole: detected.fileRole,
			language: detected.language,
			path: request.targetPath
		}
	});
	return {
		preview: {
			contextEnabled: isContextPersonalizationEnabled(configResult),
			detected,
			envelope: withPersonalizationWarnings(envelope, personalization, {
				...request,
				projectKey
			}),
			resolution
		},
		status: "ready"
	};
}
function invariantRules() {
	return createProductSafetyInvariants().map(toContextRule);
}
function starterRules() {
	return createStarterProfileDefaults().map(toContextRule);
}
function toContextRule(rule) {
	return {
		fileRoles: rule.fileRoles,
		id: rule.id,
		rule: rule.rule,
		scope: contextScope(rule.scope),
		skillIds: rule.skillIds,
		status: rule.status,
		topic: rule.topic
	};
}
function selectedTopics(request, rules) {
	const available = new Set(rules.map((rule) => rule.topic));
	if (request.topics.length === 0) return [...available].sort();
	return request.topics.every((topic) => available.has(topic)) ? request.topics : void 0;
}
function detectTarget(targetPath) {
	const lowerPath = targetPath.toLowerCase();
	return {
		fileRole: fileRoleFor(lowerPath),
		language: languageFor(lowerPath)
	};
}
function fileRoleFor(lowerPath) {
	if (lowerPath.includes("/test/") || /(?:^|\/)test[^/]*\.[a-z0-9]+$/u.test(lowerPath)) return "test";
	if (lowerPath.includes("controller")) return "controller";
	if (lowerPath.includes("service")) return "service";
	if (lowerPath.includes("repository")) return "repository";
	if (lowerPath.endsWith(".md") || lowerPath.endsWith(".mdx")) return "docs";
	return "source";
}
function languageFor(lowerPath) {
	if (lowerPath.endsWith(".java")) return "java";
	if (lowerPath.endsWith(".kt") || lowerPath.endsWith(".kts")) return "kotlin";
	if (lowerPath.endsWith(".ts") || lowerPath.endsWith(".tsx")) return "typescript";
	if (lowerPath.endsWith(".js") || lowerPath.endsWith(".jsx") || lowerPath.endsWith(".mjs") || lowerPath.endsWith(".cjs")) return "javascript";
	if (lowerPath.endsWith(".md") || lowerPath.endsWith(".mdx")) return "markdown";
	if (lowerPath.endsWith(".json") || lowerPath.endsWith(".jsonc")) return "json";
	return "common";
}
function renderPreview(contextEnabled, detected, envelope) {
	const lines = [
		"Context Preview (Experimental)",
		`Target: ${envelope.target.path}`,
		`Detected language: ${detected.language}`,
		`Detected file role: ${detected.fileRole}`,
		`Context enabled: ${contextEnabled}`,
		`Envelope status: ${envelope.status}`,
		`Selected capsules: ${envelope.selected.length}`,
		`Budget: selected=${envelope.budget.usedCapsules} chars=${envelope.budget.usedChars} / capsules=${envelope.budget.maxCapsules} chars=${envelope.budget.maxChars}`,
		`Digest: ${envelope.digest}`
	];
	if (envelope.status === "blocked") lines.push(`Block reason: ${envelope.blockReason}`);
	return `${lines.join("\n")}\n`;
}
function success$3(stdout) {
	return {
		status: 0,
		stderr: "",
		stdout
	};
}
function blocked(code) {
	return {
		code,
		status: "blocked"
	};
}
function failure$3(code) {
	return {
		status: 1,
		stderr: `${code}\n`,
		stdout: ""
	};
}
//#endregion
//#region dist/cli/context-scope-command.js
function runContextScopeCommand(args, projectDir, options = {}) {
	const action = args[0];
	const projectKey = args[2];
	if (args.length !== 0 && (args.length !== 3 || action !== "bind" && action !== "unbind" || args[1] !== "--project" || projectKey === void 0 || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/u.test(projectKey))) return failure$2("context-scope-arguments-invalid");
	try {
		if (action === void 0) return success$2(readCheckoutProjectBinding(projectDir, options));
		if (projectKey === void 0 || action !== "bind" && action !== "unbind") return failure$2("context-scope-arguments-invalid");
		if (action === "bind") {
			if (!readPersonalizationStore(options).profile.activeRules.some((rule) => rule.scope.kind === "project" && rule.scope.key === projectKey)) return failure$2("context-scope-rule-missing");
		}
		return success$2(changeCheckoutProjectBinding(projectDir, {
			action,
			projectKey
		}, options));
	} catch (error) {
		if (error instanceof ContextScopeError) return failure$2(error.code);
		if (error instanceof PersonalizationStoreError) return failure$2("context-scope-unavailable");
		throw error;
	}
}
function success$2(value) {
	return {
		status: 0,
		stdout: `${JSON.stringify(value)}\n`,
		stderr: ""
	};
}
function failure$2(code) {
	return {
		status: 1,
		stdout: "",
		stderr: `${code}\n`
	};
}
//#endregion
//#region dist/cli/context-task-command.js
function runContextTaskCommand(args, projectDir, options = {}) {
	const [sessionOption, taskSession, action, ...rest] = args;
	if (sessionOption !== "--session" || taskSession === void 0 || !/^[a-f0-9]{64}$/u.test(taskSession)) return failure$1("context-task-arguments-invalid");
	const bindingOptions = {
		...options,
		taskSession
	};
	try {
		if (action === void 0) return success$1(readContextScopeBinding(projectDir, bindingOptions));
		if (action === "preview") {
			if (rest.includes("--task")) return failure$1("context-task-arguments-invalid");
			const binding = readContextScopeBinding(projectDir, bindingOptions);
			return runContextPreviewCommand([...rest, ...binding.status === "bound" ? ["--task", binding.scopeKey] : []], projectDir, { personalization: options });
		}
		const [taskOption, taskKey] = rest;
		if (action !== "resume" && action !== "end" || rest.length !== 2 || taskOption !== "--task" || taskKey === void 0 || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/u.test(taskKey)) return failure$1("context-task-arguments-invalid");
		if (action === "resume") {
			if (!readPersonalizationStore(options).profile.activeRules.some((rule) => rule.scope.kind === "task" && rule.scope.key === taskKey)) return failure$1("context-task-rule-missing");
		}
		return success$1(changeContextScopeBinding(projectDir, {
			action: action === "resume" ? "bind" : "unbind",
			scopeKey: taskKey
		}, bindingOptions));
	} catch (error) {
		if (error instanceof ContextScopeError) return failure$1(error.code);
		if (error instanceof PersonalizationStoreError) return failure$1("context-scope-unavailable");
		throw error;
	}
}
function success$1(value) {
	const result = value.status === "bound" ? {
		status: value.status,
		taskKey: value.scopeKey
	} : value;
	return {
		status: 0,
		stdout: `${JSON.stringify(result)}\n`,
		stderr: ""
	};
}
function failure$1(code) {
	return {
		status: 1,
		stdout: "",
		stderr: `${code}\n`
	};
}
//#endregion
//#region dist/config/project-profile.js
const PROFILE_PATH = ".persona/project-profile.jsonc";
const SUPPORTED_SCHEMA = "persona.project-profile.v1";
const SUPPORTED_ROLE = "backend";
const SUPPORTED_MVP = "java-spring-clean-code";
const SUMMARY_ORDER = [
	"user-language",
	"project-context",
	"project-goal",
	"project-scale",
	"application-type",
	"storage",
	"persistence-technology",
	"migration-style",
	"package-style",
	"architecture-style",
	"boundary-strictness"
];
function readQuestion(value) {
	if (!isRecord$6(value) || typeof value.id !== "string") return;
	if (typeof value.answer === "string" && value.answer.trim() !== "") return {
		id: value.id,
		answer: value.answer.trim()
	};
	if (value.answer === null) return {
		id: value.id,
		answer: null
	};
}
function readQuestions(value) {
	if (!Array.isArray(value)) return [];
	return value.flatMap((item) => {
		const question = readQuestion(item);
		return question === void 0 ? [] : [question];
	});
}
function isSupportedBackendProfile(value) {
	if (!isRecord$6(value) || value.schema !== SUPPORTED_SCHEMA || !isRecord$6(value.scope)) return false;
	return value.scope.role === SUPPORTED_ROLE && value.scope.mvp === SUPPORTED_MVP;
}
function answeredQuestionMap(questions) {
	const answers = /* @__PURE__ */ new Map();
	for (const question of questions) if (question.answer !== null) answers.set(question.id, question.answer);
	return answers;
}
const UNSAFE_PROJECT_PHILOSOPHY_PATTERN = /(?:https?:\/\/|(?:api[_-]?key|access[_-]?token|password|secret|authorization)\s*[:=]|(?:ignore|disregard|override)\s+(?:(?:all|any)\s+)?(?:(?:previous|prior|earlier)\s+)?(?:instructions?|rules?|system\s+(?:prompt|message))|(?:이전|앞선|모든)\s*(?:지시|명령|규칙)\s*(?:을|를)?\s*무시|시스템\s*(?:프롬프트|메시지)\s*(?:을|를)?\s*(?:무시|덮어))/iu;
function inspectProjectPhilosophy(value) {
	if (!isRecord$6(value) || !isRecord$6(value.philosophy) || typeof value.philosophy.project !== "string") return { state: "missing" };
	const rawPhilosophy = value.philosophy.project;
	if (/[\u0000-\u001f\u007f]/u.test(rawPhilosophy)) return { state: "unsafe" };
	const philosophy = rawPhilosophy.trim().replace(/\s+/gu, " ");
	if (philosophy.length === 0 || philosophy.length > 1e3) return { state: "unsafe" };
	if (UNSAFE_PROJECT_PHILOSOPHY_PATTERN.test(philosophy)) return { state: "unsafe" };
	if (/(?:^|\s)(?:[A-Za-z]:[\\/]|[\\/]{1,2})[^\s]*/u.test(philosophy)) return { state: "unsafe" };
	return {
		state: "configured",
		philosophy
	};
}
function hasReadyBackendAnswers(value) {
	const answers = answeredQuestionMap(readQuestions(value.questions));
	return value.status === "ready" && SUMMARY_ORDER.every((id) => answers.has(id));
}
function readProfileText(projectDir, projectBoundary) {
	if (projectBoundary !== void 0) return projectBoundary.readProjectFile(PROFILE_PATH)?.toString("utf8");
	const profilePath = join(projectDir, PROFILE_PATH);
	if (!existsSync(profilePath)) return;
	return readFileSync(profilePath, "utf8");
}
/**
* Classifies local project convention readiness without reflecting convention
* text or inferring that any host session received it.
*/
function readBackendProjectPhilosophyStatus(projectDir, projectBoundary) {
	const profile = readBackendProjectProfileState(projectDir, projectBoundary);
	if (profile.status !== "ready") return {
		conventionState: "not-ready",
		profileState: profile.status
	};
	let text;
	try {
		text = readProfileText(projectDir, projectBoundary);
	} catch {
		return {
			conventionState: "not-ready",
			profileState: "invalid"
		};
	}
	if (text === void 0) return {
		conventionState: "not-ready",
		profileState: "missing"
	};
	let parsed;
	try {
		parsed = JSON.parse(stripJsonComments(text));
	} catch {
		return {
			conventionState: "not-ready",
			profileState: "invalid"
		};
	}
	if (!isSupportedBackendProfile(parsed) || !hasReadyBackendAnswers(parsed)) return {
		conventionState: "not-ready",
		profileState: "invalid"
	};
	return {
		conventionState: inspectProjectPhilosophy(parsed).state,
		profileState: "ready"
	};
}
function readBackendProjectProfileState(projectDir, projectBoundary) {
	let text;
	try {
		text = readProfileText(projectDir, projectBoundary);
	} catch {
		return {
			status: "invalid",
			missingAnswers: [...SUMMARY_ORDER],
			message: `${PROFILE_PATH} could not be read safely. Fix it before planning.`
		};
	}
	if (text === void 0) return {
		status: "missing",
		missingAnswers: [...SUMMARY_ORDER],
		message: `${PROFILE_PATH} is missing. Run npx ph intake --default backend or npx ph intake --interactive.`
	};
	let parsed;
	try {
		parsed = JSON.parse(stripJsonComments(text));
	} catch (error) {
		if (error instanceof SyntaxError) return {
			status: "invalid",
			missingAnswers: [...SUMMARY_ORDER],
			message: `${PROFILE_PATH} is malformed. Fix it or run npx ph intake --default backend --force.`
		};
		throw error;
	}
	if (!isSupportedBackendProfile(parsed)) return {
		status: "invalid",
		missingAnswers: [...SUMMARY_ORDER],
		message: `${PROFILE_PATH} is not a supported backend Java/Spring profile.`
	};
	if ((typeof parsed.status === "string" ? parsed.status : "draft") === "draft") return {
		status: "draft",
		missingAnswers: [...SUMMARY_ORDER],
		message: `${PROFILE_PATH} is still draft. Run npx ph intake --default backend --force or npx ph intake --interactive --force before planning.`
	};
	const answers = answeredQuestionMap(readQuestions(parsed.questions));
	const missingAnswers = SUMMARY_ORDER.filter((id) => !answers.has(id));
	if (missingAnswers.length > 0) return {
		status: "incomplete",
		missingAnswers,
		message: `${PROFILE_PATH} is missing required answers: ${missingAnswers.join(", ")}.`
	};
	return {
		status: "ready",
		missingAnswers: [],
		message: `${PROFILE_PATH} is ready.`
	};
}
//#endregion
//#region dist/cli/philosophy-refinement.js
const PERSONALIZATION_REFINEMENT_SCHEMA = "personalization-refinement.v1";
const REFINEMENT_KEYS = [
	"candidate",
	"classification",
	"currentRationale",
	"preferredAlternative",
	"schemaVersion",
	"trigger"
];
function parsePhilosophyRefinement(value) {
	if (!isRecord(value) || !hasExactKeys(value, REFINEMENT_KEYS)) return {
		ok: false,
		reason: "incomplete"
	};
	if (value.schemaVersion !== "personalization-refinement.v1") return {
		ok: false,
		reason: "unsafe"
	};
	if (!isTrigger(value.trigger)) return {
		ok: false,
		reason: "explicit-trigger-required"
	};
	if (!isClassification(value.classification)) return {
		ok: false,
		reason: "ambiguous"
	};
	if (!isPresentText(value.currentRationale) || !isPresentText(value.preferredAlternative)) return {
		ok: false,
		reason: "incomplete"
	};
	if (!isSafeRefinementText(value.currentRationale) || !isSafeRefinementText(value.preferredAlternative)) return {
		ok: false,
		reason: "unsafe"
	};
	let candidate;
	try {
		candidate = parsePersonalizationCandidate(value.candidate);
	} catch {
		return {
			ok: false,
			reason: "incomplete"
		};
	}
	return {
		ok: true,
		value: {
			candidate,
			classification: value.classification,
			currentRationale: value.currentRationale,
			preferredAlternative: value.preferredAlternative,
			schemaVersion: PERSONALIZATION_REFINEMENT_SCHEMA,
			trigger: value.trigger
		}
	};
}
function refinePersonalization(value, options = {}) {
	const parsed = parsePhilosophyRefinement(value);
	if (!parsed.ok) return {
		reason: parsed.reason,
		status: "blocked"
	};
	const { candidate, classification } = parsed.value;
	if (classification === "implementation-mistake") return {
		classification,
		status: "no-profile-change"
	};
	if (classification === "personal-philosophy" && candidate.scope.kind !== "personal") return {
		reason: "scope-mismatch",
		status: "blocked"
	};
	if (classification === "project-decision" && candidate.scope.kind === "personal") return {
		reason: "scope-mismatch",
		status: "blocked"
	};
	const result = proposePersonalizationCandidate(candidate, options);
	if (result.status === "activated" || result.status === "pending" || result.status === "conflict") return {
		candidateId: candidate.candidateId,
		classification,
		status: result.status
	};
	return {
		reason: "ambiguous",
		status: "blocked"
	};
}
function hasExactKeys(value, keys) {
	const actual = Object.keys(value).sort();
	const expected = [...keys].sort();
	return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}
function isTrigger(value) {
	return value === "design-critique" || value === "implementation-critique" || value === "explicit-refinement";
}
function isClassification(value) {
	return value === "implementation-mistake" || value === "project-decision" || value === "personal-philosophy";
}
function isSafeRefinementText(value) {
	return typeof value === "string" && value.length > 0 && value.length <= 600 && !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\r\n]/u.test(value) && !/```|(?:^|[\s("'])~[\\/]|(?:^|[\s("'])[A-Za-z]:[\\/]|(?:^|[\s("'])\/(?:[^/]|$)/u.test(value) && !/(?:^|[\s("'`])(?:sk-[A-Za-z0-9]|gh[pousr]_[A-Za-z0-9]|xox[baprs]-|AKIA[A-Z0-9]{12,})/u.test(value) && !/\b(?:password|passwd|api[ _-]?key|access[ _-]?token|token|secret)\s*[:=]/iu.test(value) && !/(?:https?|file):\/\//iu.test(value) && !/\b(?:function|class|interface|import|export|const|let|var)\s+[A-Za-z_$]/u.test(value) && !/[{};]|=>/u.test(value);
}
function isPresentText(value) {
	return typeof value === "string" && value.trim() !== "";
}
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
//#endregion
//#region dist/cli/philosophy-command.js
function philosophyUsage(invocationName = "ph") {
	return [
		`Usage: ${invocationName} philosophy <status|init|propose|refine|resolve|history|rollback>`,
		"",
		"Commands:",
		"  status                         Inspect personal and project philosophy state without creating files.",
		"  init                           Inspect the same starter/profile state.",
		"  propose --stdin [--pending]   Validate one structured candidate from stdin.",
		"  refine --stdin                Record only an explicit, complete Socratic refinement.",
		"  resolve <id> <action>          Resolve pending candidate: retain, exception, supersede, or pending.",
		"  history                        Print bounded append-only decision history.",
		"  rollback <rule-id>             Append a rollback decision for one active rule."
	].join("\n");
}
function runPhilosophyCommand(args, options = {}, invocationName = "ph") {
	const command = args[0];
	if (command === void 0 || command === "help" || command === "--help" || command === "-h") return success(`${philosophyUsage(invocationName)}\n`);
	try {
		if (command === "status" || command === "init") return runStatus(args.slice(1), options, command);
		if (command === "propose") return runPropose(args.slice(1), options);
		if (command === "refine") return runRefine(args.slice(1), options);
		if (command === "resolve") return runResolve(args.slice(1), options);
		if (command === "history") return runHistory(args.slice(1), options);
		if (command === "rollback") return runRollback(args.slice(1), options);
		return failure("personalization-command-invalid");
	} catch (error) {
		if (error instanceof PersonalizationStoreError) return failure(error.code);
		return failure("personalization-store-internal");
	}
}
function runRefine(args, options) {
	if (args.length !== 1 || args[0] !== "--stdin" || options.stdin === void 0 || options.stdin.trim() === "") return failure("personalization-refinement-invalid");
	let input;
	try {
		input = JSON.parse(options.stdin);
	} catch {
		return failure("personalization-refinement-invalid");
	}
	const result = refinePersonalization(input, options);
	if (result.status === "blocked") return failure(result.reason);
	if (result.status === "conflict") return {
		status: 1,
		stdout: `${JSON.stringify(result)}\n`,
		stderr: "personalization-candidate-conflict\n"
	};
	return success(`${JSON.stringify(result)}\n`);
}
function runStatus(args, options, command) {
	if (args.length !== 0) return failure("personalization-command-invalid");
	const document = readPersonalizationStore(options);
	const projectDir = options.projectDir ?? process$1.cwd();
	const projectPhilosophy = readBackendProjectPhilosophyStatus(projectDir);
	const projectInjection = isProjectPhilosophyInjectionEnabled(loadHarnessConfig(projectDir));
	return success(`${JSON.stringify({
		activeRules: document.profile.activeRules.length,
		command,
		pendingCandidates: document.profile.pendingCandidates.length,
		project: {
			conventionState: projectPhilosophy.conventionState,
			hostDelivery: "unobserved",
			injection: projectInjection ? "enabled" : "disabled",
			profileState: projectPhilosophy.profileState
		},
		starter: true,
		store: document.profile.activeRules.length === 0 && document.profile.pendingCandidates.length === 0 ? "uninitialized" : "active"
	})}\n`);
}
function runPropose(args, options) {
	if (args[0] !== "--stdin" && !args.includes("--stdin")) return failure("personalization-candidate-invalid");
	const extra = args.filter((arg) => arg !== "--stdin");
	if (extra.length > 1 || extra.length === 1 && extra[0] !== "--pending") return failure("personalization-command-invalid");
	if (options.stdin === void 0 || options.stdin.trim() === "") return failure("personalization-candidate-invalid");
	let candidate;
	try {
		candidate = JSON.parse(options.stdin);
	} catch {
		return failure("personalization-candidate-invalid");
	}
	const result = proposePersonalizationCandidate(candidate, options, extra[0] === "--pending");
	if (result.status === "conflict") return {
		status: 1,
		stdout: `${JSON.stringify({ status: result.status })}\n`,
		stderr: "personalization-candidate-conflict\n"
	};
	return success(`${JSON.stringify({ status: result.status })}\n`);
}
function runResolve(args, options) {
	const candidateId = args[0];
	const action = args[1];
	if (candidateId === void 0 || action === void 0 || ![
		"retain",
		"exception",
		"supersede",
		"pending"
	].includes(action)) return failure("personalization-resolution-invalid");
	const scopeArgs = args.slice(2);
	const parsed = parseScopeArgs(scopeArgs);
	if (scopeArgs.length > 0 && parsed === void 0) return failure("personalization-resolution-invalid");
	const result = resolvePersonalizationCandidate(candidateId, action, options, parsed);
	return success(`${JSON.stringify({ status: result.status })}\n`);
}
function runHistory(args, options) {
	if (args.length !== 0) return failure("personalization-command-invalid");
	const document = readPersonalizationStore(options);
	return success(`${JSON.stringify({ events: document.history.events })}\n`);
}
function runRollback(args, options) {
	if (args.length !== 1) return failure("personalization-rule-missing");
	const result = rollbackPersonalizationRule(args[0], options);
	return success(`${JSON.stringify({ status: result.status })}\n`);
}
function parseScopeArgs(args) {
	if (args.length === 0) return void 0;
	if (args.length !== 4 || args[0] !== "--scope" || args[2] !== "--scope-key") return void 0;
	if (args[1] !== "project" && args[1] !== "task") return void 0;
	if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/u.test(args[3])) return void 0;
	return {
		kind: args[1],
		key: args[3]
	};
}
function success(stdout) {
	return {
		status: 0,
		stdout,
		stderr: ""
	};
}
function failure(code) {
	return {
		status: 1,
		stdout: "",
		stderr: `${code}\n`
	};
}
//#endregion
//#region dist/context-delivery/portable-context-setup.js
async function main() {
	const [group, command, ...args] = process$1.argv.slice(2);
	if (command === void 0 && (group === void 0 || group === "--help" || group === "-h" || group === "help")) {
		process$1.stdout.write([
			"Persona Harness local plugin setup",
			"Invoke this script with:",
			"  context init --enable",
			"  context preview <relative-target> --json",
			"  context scope [bind|unbind --project <key>]",
			"  context task --session <handle> [resume|end --task <key>]",
			"  context task --session <handle> preview <relative-target> --json",
			"  philosophy status",
			"  philosophy propose --stdin",
			"  philosophy --help (all existing philosophy commands)",
			`Decision format: ${fileURLToPath(new URL("../skills/philosophy-refinement/references/persistence.md", import.meta.url))}`,
			"Setup and persistence require explicit consent. Help changes no files.",
			""
		].join("\n"));
		return;
	}
	let stdin;
	if (args.includes("--stdin")) {
		const chunks = [];
		let size = 0;
		for await (const chunk of process$1.stdin) {
			const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
			size += bytes.length;
			if (size > 1048576) throw new Error("setup-input-limit");
			chunks.push(bytes);
		}
		stdin = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
	}
	const projectDir = process$1.cwd();
	const result = group === "context" && command === "init" ? runContextInitCommand(args, projectDir) : group === "context" && command === "preview" ? runContextPreviewCommand(args, projectDir) : group === "context" && command === "scope" ? runContextScopeCommand(args, projectDir) : group === "context" && command === "task" ? runContextTaskCommand(args, projectDir) : group === "philosophy" ? runPhilosophyCommand(command === void 0 ? [] : [command, ...args], {
		projectDir,
		stdin
	}) : {
		status: 1,
		stdout: "",
		stderr: "setup-command-invalid\n"
	};
	process$1.stdout.write(result.stdout);
	process$1.stderr.write(result.stderr);
	process$1.exitCode = result.status;
}
try {
	await main();
} catch {
	process$1.stderr.write("setup-unavailable\n");
	process$1.exitCode = 1;
}
//#endregion
export {};
