import React from "react";
import { orgColor } from "../../lib/constants";
import { perMillionOut, valueFrontier } from "../../lib/compute";

const fmtPerM = (v) => (v == null ? "—" : v < 10 ? `$${v.toFixed(1)}` : `$${Math.round(v)}`);

export default function CostBars({ models }) {
  const pts = models
    .filter((m) => m.costOverall > 0)
    .slice()
    .sort((a, b) => a.costOverall - b.costOverall);
  if (!pts.length) return null;
  const front = valueFrontier(pts);
  const max = Math.max(...pts.map((p) => p.costOverall));

  return (
    <div>
      {pts.map((m) => {
        const col = orgColor(m.org);
        const c = m.cost;
        const out = Number(c.avg_output_tokens) || 0;
        return (
          <div className="lb-bar" key={m.model}
            title={`$/1M out ${fmtPerM(perMillionOut(c))} · ${out.toLocaleString()} output tokens`}>
            <span className="name"><span className="lb-mdot" style={{ background: col }} />{m.name}</span>
            <div className="track"><div className="fill" style={{ width: `${(m.costOverall / max) * 100}%`, background: col }} /></div>
            <span className="val">
              ${m.costOverall.toFixed(3)}
              {front.has(m.model) && <span style={{ color: "var(--live)" }}> ●</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}
