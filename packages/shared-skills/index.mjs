import { fileURLToPath } from "node:url";

export function sharedSkillsRootPath() {
	return fileURLToPath(new URL("./skills/", import.meta.url));
}

export function sharedSkillsCatalogPath() {
	return fileURLToPath(new URL("./catalog.json", import.meta.url));
}
