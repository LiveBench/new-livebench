import React from "react";
import { pointsPerDollar } from "../lib/compute";

// KPI cards above the table. Cost-dependent "Best value" card only when hasCost.
export default function MetricsStrip({ models, categories, hasCost, dateStr }) {
  if (!models.length) return null;

  const top = models.reduce((a, b) => (b.overall > a.overall ? b : a));
  const tasks = Object.values(categories).reduce((s, arr) => s + (arr ? arr.length : 0), 0);
  const ncats = Object.keys(categories).length;

  let bv = null, bvr = -Infinity;
  if (hasCost) {
    for (const m of models) {
      const r = pointsPerDollar(m.overall, m.cost);
      if (r != null && r > bvr) { bvr = r; bv = m; }
    }
  }

  const cards = [
    { l: "Models evaluated", v: models.length, s: "this release" },
    { l: "Tasks / categories", v: `${tasks} / ${ncats}`, s: "objective, auto-graded" },
    { l: "Top overall", v: top.overall.toFixed(1), s: top.name },
  ];
  if (hasCost && bv) {
    cards.push({ l: "Best value", v: `$${bv.cost.cost_per_question.toFixed(3)}`, s: `${bv.name} · score/$`, hl: true });
  }
  cards.push({ l: "Release", v: dateStr, s: hasCost ? "cost available" : "capability only" });

  return (
    <div className="lb-kpis">
      {cards.map((c, i) => (
        <div key={i} className={"lb-kpi" + (c.hl ? " hl" : "")}>
          <div className="k-lab">{c.l}</div>
          <div className="k-val">{c.v}</div>
          <div className="k-sub">{c.s}</div>
        </div>
      ))}
    </div>
  );
}
