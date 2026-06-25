import React from "react";
import { costPerQuality } from "../lib/compute";

// KPI cards above the table. Cost-dependent "Best value" card only when hasCost.
export default function MetricsStrip({ models, categories, hasCost, dateStr }) {
  if (!models.length) return null;

  const top = models.reduce((a, b) => (b.overall > a.overall ? b : a));
  const tasks = Object.values(categories).reduce((s, arr) => s + (arr ? arr.length : 0), 0);
  const ncats = Object.keys(categories).length;

  // Best value = lowest $/quality = $/Q ÷ score (= cost per quality point). Lower is better.
  let bv = null, bvq = Infinity;
  if (hasCost) {
    for (const m of models) {
      const q = costPerQuality(m.costOverall, m.overall);
      if (q != null && q < bvq) { bvq = q; bv = m; }
    }
  }

  const cards = [
    { l: "Models evaluated", v: models.length, s: "this release" },
    { l: "Tasks / categories", v: `${tasks} / ${ncats}`, s: "objective, auto-graded" },
    { l: "Top overall", v: top.overall.toFixed(1), s: top.name },
  ];
  if (hasCost && bv) {
    cards.push({
      l: "Best value", v: `$${bvq.toFixed(4)}`, s: `${bv.name} · lowest $/quality`, hl: true,
      tip: "$/quality = $/Q ÷ score (cost per quality point) — lowest is best value",
    });
  }
  cards.push({ l: "Release", v: dateStr, s: hasCost ? "cost available" : "capability only" });

  return (
    <div className="lb-kpis">
      {cards.map((c, i) => (
        <div key={i} className={"lb-kpi" + (c.hl ? " hl" : "")} data-tip={c.tip}>
          <div className="k-lab">{c.l}</div>
          <div className="k-val">{c.v}</div>
          <div className="k-sub">{c.s}</div>
        </div>
      ))}
    </div>
  );
}
