import React, { useState } from "react";
import { orgColor } from "../../lib/constants";
import { perMillionOut, valueFrontier } from "../../lib/compute";

const fmtPerM = (v) => (v == null ? "—" : v < 10 ? `$${v.toFixed(1)}` : `$${Math.round(v)}`);

export default function CostBars({ models }) {
  const [tip, setTip] = useState(null);
  const pts = models
    .filter((m) => m.costOverall > 0)
    .slice()
    .sort((a, b) => a.costOverall - b.costOverall);
  if (!pts.length) return null;
  const front = valueFrontier(pts);
  const max = Math.max(...pts.map((p) => p.costOverall));

  const show = (m) => (e) => setTip({ x: e.clientX, y: e.clientY, m });

  return (
    <div style={{ position: "relative" }} onMouseLeave={() => setTip(null)}>
      {pts.map((m) => {
        const col = orgColor(m.org);
        return (
          <div className="lb-bar" key={m.model}
            onMouseEnter={show(m)} onMouseMove={show(m)}>
            <span className="name"><span className="lb-mdot" style={{ background: col }} />{m.name}</span>
            <div className="track"><div className="fill" style={{ width: `${(m.costOverall / max) * 100}%`, background: col }} /></div>
            <span className="val">
              <span className="cur">$</span>{m.costOverall.toFixed(3)}
              {front.has(m.model) && <span style={{ color: "var(--live)" }}> ●</span>}
            </span>
          </div>
        );
      })}
      {tip && (
        <div className="lb-tip" style={{ position: "fixed", left: tip.x + 14, top: tip.y - 8, transform: "none" }}>
          <div className="tn">{tip.m.name}</div>
          <div className="tg">
            <span>$/Q</span><span>${tip.m.costOverall.toFixed(3)}</span>
            <span>$/1M out</span><span>{fmtPerM(perMillionOut(tip.m.cost))}</span>
            <span>avg output tokens</span><span>{(Number(tip.m.cost.avg_output_tokens) || 0).toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}
