import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";

const files = [...new Set(execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean))];
const rules = [
  ["private-key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["supabase-secret", /\bsb_secret_[A-Za-z0-9_-]{16,}/],
  ["provider-secret", /\b(?:sk-proj-|sk_live_|ghp_|github_pat_)[A-Za-z0-9_-]{20,}/],
  ["jwt", /\beyJ[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/],
  ["secret-assignment", /(?:service_role_key|SUPABASE_SERVICE_ROLE_KEY|DATABASE_URL|API_SECRET)\s*[:=]\s*["']?[^\s"'<>]{12,}/i],
];
const findings = [];
for (const path of files) {
  if (/\.(png|jpeg|jpg|webp|ico)$/.test(path) || !statSync(path).isFile()) continue;
  if (/(^|\/)\.env(?:\.|$)/.test(path)) findings.push({ path, rule: "env-file" });
  const text = readFileSync(path, "utf8");
  for (const [rule, pattern] of rules) if (pattern.test(text)) findings.push({ path, rule });
}
console.log(JSON.stringify({ result: findings.length ? "FAIL" : "PASS", scannedFiles: files.length, findings, limitation: "Pattern scan plus manual diff review; does not prove absence of every possible secret." }, null, 2));
if (findings.length) process.exitCode = 1;
