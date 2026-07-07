import React from "react";

// KPI cards above the table.
export default function MetricsStrip({ models, categories, hasCost, dateStr }) {
  if (!models.length) return null;

  const top = models.reduce((a, b) => (b.overall > a.overall ? b : a));
  const tasks = Object.values(categories).reduce((s, arr) => s + (arr ? arr.length : 0), 0);
  const ncats = Object.keys(categories).length;

  const cards = [
    { l: "Models evaluated", v: models.length, s: "this release" },
    { l: "Tasks / categories", v: `${tasks} / ${ncats}`, s: "objective, auto-graded" },
    { l: "Top overall", v: top.overall.toFixed(1), s: top.name },
    { l: "Release", v: dateStr, s: hasCost ? "cost available" : "capability only" },
  ];

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
