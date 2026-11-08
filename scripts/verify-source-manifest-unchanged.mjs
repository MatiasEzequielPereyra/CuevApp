import { spawnSync } from "node:child_process";

const manifestPath = "docs/engineering/source-manifest.json";
const baseRef = process.env.SOURCE_MANIFEST_BASE?.trim() || "origin/main";

const diff = spawnSync(
  "git",
  ["diff", "--quiet", `${baseRef}...HEAD`, "--", manifestPath],
  { encoding: "utf8" },
);

if (diff.error) throw diff.error;
if (diff.status === 1) {
  console.error(
    `Protected source manifest changed relative to ${baseRef}. Do not update it in a feature branch; source changes require a separately reviewed and explicitly authorized manifest update.`,
  );
  process.exit(1);
}
if (diff.status !== 0) {
  console.error(diff.stderr || `Could not compare ${manifestPath} with ${baseRef}.`);
  process.exit(diff.status ?? 1);
}

console.log(`PASS: ${manifestPath} is unchanged relative to ${baseRef}.`);
