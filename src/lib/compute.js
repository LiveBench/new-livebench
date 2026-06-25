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

// Official $/1M output list price from the provider config (preferred).
// Falls back to the derived implied rate only if no official price is published.
export const perMillionOut = (cost) => {
  if (!cost) return null;
  if (cost.output_price_per_million != null) return Number(cost.output_price_per_million);
  return cost.avg_output_tokens ? (cost.cost_per_question / cost.avg_output_tokens) * 1e6 : null;
};

export const pointsPerDollar = (overall, cost) =>
  cost && cost.cost_per_question ? overall / cost.cost_per_question : null;

// $/quality — cost per LiveBench point (cost_per_question / overall). Lower = better value.
export const costPerQuality = (overall, cost) =>
  cost && cost.cost_per_question != null && overall ? cost.cost_per_question / overall : null;

// Pareto "value frontier": walking cheapest→priciest, a model is on the frontier
// if it beats every cheaper model's score. Drives the table's "Best value" badge
// and the scatter's frontier line. Estimated costs (cost.est) are excluded.
export function valueFrontier(models) {
  const withCost = models
    .filter((m) => m.cost && m.cost.cost_per_question != null && !m.cost.est)
    .slice()
    .sort((a, b) => a.cost.cost_per_question - b.cost.cost_per_question);
  const front = new Set();
  let mx = -Infinity;
  for (const m of withCost) {
    if (m.overall > mx) { front.add(m.model); mx = m.overall; }
  }
  return front;
}

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
