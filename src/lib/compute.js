// Canonical derived metrics — every surface (table, KPIs, charts) uses these so
// numbers never disagree. Score math reuses the site's own Averaging.js.
import { getGlobalAverage, calculateAverage } from "../Table/Averaging";
import { getModelInfo } from "../Table/modelLinks";

// "All categories averaged" map so overall == the site's Global Average.
export function allCatsChecked(categories) {
  const m = {};
  Object.keys(categories || {}).forEach((c) => { m[c] = { average: true, allSubcategories: false }; });
  return m;
}

export function overallOf(row, categories) {
  const v = parseFloat(getGlobalAverage(row, allCatsChecked(categories), categories));
  return isNaN(v) ? null : v;
}

export function catAvg(row, categories, cat) {
  const v = calculateAverage(row, categories[cat]);
  return v === "-" || v == null ? null : Number(v);
}

// ---- Cost: mirrors scores (per-subtask cost → category → overall) ----
// The cost row has the same subtask columns as the score row, so the same
// Averaging.js functions aggregate it. cost_<date>.csv stores one $/question
// per (model, subtask) plus trailing model-level columns (avg_*_tokens, prices).

// Category cost = mean of its subtask $/question (like catAvg for scores).
export function catCost(costRow, categories, cat) {
  if (!costRow) return null;
  const v = calculateAverage(costRow, categories[cat]);
  return v === "-" || v == null ? null : Number(v);
}

// Overall cost = mean of category costs — same weighting as the overall score.
export function overallCost(costRow, categories) {
  if (!costRow) return null;
  const cs = Object.keys(categories || {})
    .map((c) => catCost(costRow, categories, c))
    .filter((v) => v != null);
  return cs.length ? cs.reduce((a, b) => a + b, 0) / cs.length : null;
}

// Cost at any scope: "overall" | a category name | a subtask column.
export function costForScope(costRow, categories, scope) {
  if (!costRow) return null;
  if (scope === "overall") return overallCost(costRow, categories);
  if (categories && scope in categories) return catCost(costRow, categories, scope);
  const v = costRow[scope]; // raw subtask cost
  return v == null || v === "" || isNaN(Number(v)) ? null : Number(v);
}

// $/quality at a scope = scoped cost ÷ scoped score (cost per LiveBench point). Lower = better.
export const costPerQuality = (costVal, scoreVal) =>
  costVal != null && scoreVal ? costVal / scoreVal : null;

// Score per dollar (for the "best value" KPI).
export const pointsPerDollar = (scoreVal, costVal) => (costVal ? scoreVal / costVal : null);

// Official $/1M output list price from the provider config (tooltips only).
export const perMillionOut = (costRow) =>
  costRow && costRow.output_price_per_million != null ? Number(costRow.output_price_per_million) : null;

// Generic Pareto frontier for the given cost/score accessors: cheapest model
// achieving each new score ceiling. Used scope-aware in the table, overall elsewhere.
export function frontierBy(models, getCost, getScore) {
  const withCost = models
    .filter((m) => { const c = getCost(m); return c != null && c > 0; })
    .slice()
    .sort((a, b) => getCost(a) - getCost(b));
  const front = new Set();
  let mx = -Infinity;
  for (const m of withCost) {
    const s = getScore(m);
    if (s != null && s > mx) { front.add(m.model); mx = s; }
  }
  return front;
}

// Overall value frontier (scatter / KPI) — uses each model's precomputed costOverall.
export const valueFrontier = (models) => frontierBy(models, (m) => m.costOverall, (m) => m.overall);

// Cell background tint scaled by score strength (40→100 maps to 0→0.20 alpha).
export const heat = (v) => {
  if (v == null) return "transparent";
  const a = Math.max(0, Math.min(0.2, ((v - 40) / 60) * 0.2));
  return `rgba(47,84,235,${a.toFixed(3)})`;
};

// Family key for collapsing effort variants to one row (best overall wins).
export const familyKey = (model) => getModelInfo(model)?.baseName ?? model;

export function collapseVariants(models) {
  const best = {};
  for (const m of models) {
    const k = familyKey(m.model);
    if (!best[k] || m.overall > best[k].overall) best[k] = m;
  }
  return Object.values(best);
}
