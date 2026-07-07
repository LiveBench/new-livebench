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

// ---- Cost: $/question, aggregated QUESTION-WEIGHTED (not category-weighted) ----
// cost_<date>.csv stores, per (model, subtask): the TOTAL cost (the subtask
// column) and the question count (nq_<subtask>). $/question at any scope is
// (Σ total cost) / (Σ nq) over the subtasks in that scope — so overall = total
// run cost ÷ total questions, and a category = its total ÷ its question count.
// (This is NOT the mean of the per-category $/Q values; expensive but small
// suites like Agentic Coding are weighted by their question count, not 1/7.)

// Subtask columns covered by a scope: overall = all, a category = its subtasks, else the subtask.
function scopeSubtasks(categories, scope) {
  if (scope === "overall") return Object.values(categories || {}).flat();
  if (categories && scope in categories) return categories[scope];
  return [scope];
}

export function costForScope(costRow, categories, scope) {
  if (!costRow) return null;
  let cost = 0, n = 0;
  for (const t of scopeSubtasks(categories, scope)) {
    const c = Number(costRow[t]);
    const q = Number(costRow["nq_" + t]);
    if (!isNaN(c) && !isNaN(q) && q > 0) { cost += c; n += q; }
  }
  return n > 0 ? cost / n : null;
}

// Per-category and overall $/Q are just costForScope at those scopes.
export const catCost = (costRow, categories, cat) => costForScope(costRow, categories, cat);
export const overallCost = (costRow, categories) => costForScope(costRow, categories, "overall");

// Avg output tokens/question at a scope. Overall uses the precomputed
// avg_output_tokens; a category/subtask is the question-weighted mean of its
// subtasks' out_<subtask> columns (Σ out*nq / Σ nq) — so charts show the
// per-category output, not the overall number, when a scope is selected.
export function outputTokensForScope(costRow, categories, scope) {
  if (!costRow) return null;
  if (scope === "overall") {
    const v = Number(costRow.avg_output_tokens);
    return isNaN(v) ? null : v;
  }
  let out = 0, n = 0;
  for (const t of scopeSubtasks(categories, scope)) {
    const o = Number(costRow["out_" + t]);
    const q = Number(costRow["nq_" + t]);
    if (!isNaN(o) && !isNaN(q) && q > 0) { out += o * q; n += q; }
  }
  return n > 0 ? out / n : null;
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
