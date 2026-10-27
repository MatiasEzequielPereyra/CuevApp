import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const projectRoot = fileURLToPath(new URL("../", import.meta.url));
export const manifest = JSON.parse(readFileSync(new URL("../docs/engineering/source-manifest.json", import.meta.url), "utf8").replace(/^\uFEFF/, ""));

export function verifySources() {
  return manifest.map(({ path, sha256, bytes }) => {
    const content = readFileSync(new URL(`../${path}`, import.meta.url));
    const actual = createHash("sha256").update(content).digest("hex");
    if (content.length !== bytes || actual !== sha256) throw new Error(`Source changed: ${path}`);
    return { path, sha256: actual, bytes, result: "PASS" };
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(JSON.stringify(verifySources(), null, 2));
