#!/usr/bin/env node
/* Data-integrity check: for every release, ensure model keys line up across
 * table_<date>.csv, cost_<date>.csv, and modelLinks.js — the silent "—"/orphan
 * footgun. Exits non-zero on a hard mismatch (cost row with no score row). */
const fs = require("fs");
const path = require("path");

const PUB = path.join(__dirname, "..", "public");
const LINKS = path.join(__dirname, "..", "src", "Table", "modelLinks.js");

const modelsOf = (csvPath) => {
  if (!fs.existsSync(csvPath)) return null;
  const lines = fs.readFileSync(csvPath, "utf8").trim().split("\n");
  return new Set(lines.slice(1).map((l) => l.split(",")[0]).filter(Boolean));
};

// Extract known model keys (top-level + variant rawNames) from modelLinks.js.
const linkText = fs.readFileSync(LINKS, "utf8");
const known = new Set();
for (const m of linkText.matchAll(/"([^"]+)":\s*{/g)) known.add(m[1]);
for (const m of linkText.matchAll(/rawName:\s*"([^"]+)"/g)) known.add(m[1]);

const releases = fs.readdirSync(PUB)
  .filter((f) => /^table_\d{4}_\d{2}_\d{2}\.csv$/.test(f))
  .map((f) => f.slice("table_".length, -".csv".length));

let hardErrors = 0;
console.log(`Checking ${releases.length} releases…\n`);
for (const d of releases) {
  const table = modelsOf(path.join(PUB, `table_${d}.csv`));
  const cost = modelsOf(path.join(PUB, `cost_${d}.csv`));
  const missingMeta = [...table].filter((m) => !known.has(m));
  let line = `${d}: ${table.size} models`;
  if (cost) {
    const orphanCost = [...cost].filter((m) => !table.has(m));
    line += `, ${cost.size} with cost`;
    if (orphanCost.length) { line += ` — ❌ ${orphanCost.length} cost rows with NO score row: ${orphanCost.join(", ")}`; hardErrors++; }
  }
  if (missingMeta.length) line += ` — ⚠ ${missingMeta.length} models without modelLinks metadata (hidden in UI)`;
  console.log(line);
}
console.log(hardErrors ? `\n❌ ${hardErrors} release(s) have orphan cost rows.` : "\n✓ No orphan cost rows.");
process.exit(hardErrors ? 1 : 0);
