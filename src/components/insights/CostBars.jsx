import React, { useState } from "react";
import { orgColor } from "../../lib/constants";
import { perMillionOut, frontierBy, costForScope } from "../../lib/compute";

const fmtPerM = (v) => (v == null ? "—" : v < 10 ? `$${v.toFixed(1)}` : `$${Math.round(v)}`);

export default function CostBars({ models, categories, scope = "overall" }) {
  const [tip, setTip] = useState(null);
  const costOf = (m) => costForScope(m.cost, categories, scope);
  const scoreOf = (m) => (scope === "overall" ? m.overall : m.cats?.[scope]);

  const pts = models
    .filter((m) => costOf(m) > 0)
    .slice()
    .sort((a, b) => costOf(a) - costOf(b));
  if (!pts.length) return null;
  const front = frontierBy(pts, costOf, scoreOf);
  const max = Math.max(...pts.map(costOf));

  const show = (m) => (e) => setTip({ x: e.clientX, y: e.clientY, m });

  return (
    <div style={{ position: "relative" }} onMouseLeave={() => setTip(null)}>
      {pts.map((m) => {
        const col = orgColor(m.org);
        return (
          <div className="lb-bar" key={m.model}
            onMouseEnter={show(m)} onMouseMove={show(m)}>
            <span className="name"><span className="lb-mdot" style={{ background: col }} />{m.name}</span>
            <div className="track"><div className="fill" style={{ width: `${(costOf(m) / max) * 100}%`, background: col }} /></div>
            <span className="val">
              <span className="cur">$</span>{costOf(m).toFixed(3)}
              {front.has(m.model) && <span style={{ color: "var(--live)" }}> ●</span>}
            </span>
          </div>
        );
      })}
      {tip && (
        <div className="lb-tip" style={{ position: "fixed", left: tip.x + 14, top: tip.y - 8, transform: "none" }}>
          <div className="tn">{tip.m.name}</div>
          <div className="tg">
            <span>$/Q</span><span><span className="cur">$</span>{costOf(tip.m).toFixed(3)}</span>
            <span>$/1M out</span><span>{fmtPerM(perMillionOut(tip.m.cost))}</span>
            <span>avg output tokens</span><span>{(Number(tip.m.cost.avg_output_tokens) || 0).toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}
