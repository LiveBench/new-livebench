import React, { useState } from "react";
import { orgColor } from "../../lib/constants";
import { perMillionOut, costForScope, outputTokensForScope, costPerSuccess } from "../../lib/compute";

const fmtPerM = (v) => (v == null ? "—" : v < 10 ? `$${v.toFixed(1)}` : `$${Math.round(v)}`);
const TOP = 20;

export default function CostBars({ models, categories, scope = "overall" }) {
  const [tip, setTip] = useState(null);
  const [extra, setExtra] = useState(() => new Set()); // extra models added via the dropdown
  const scoreOf = (m) => (scope === "overall" ? m.overall : m.cats?.[scope]);
  // bar metric = cost per successful task = ($/task ÷ score) × 100
  const costOf = (m) => costPerSuccess(costForScope(m.cost, categories, scope), scoreOf(m));

  const pts = models
    .filter((m) => costOf(m) > 0)
    .slice()
    .sort((a, b) => costOf(a) - costOf(b)); // cheapest first
  if (!pts.length) return null;

  // Default to the top-scoring models (for the current scope); add others via the dropdown.
  const topIds = new Set(
    pts.slice().sort((a, b) => (scoreOf(b) ?? -1) - (scoreOf(a) ?? -1)).slice(0, TOP).map((m) => m.model)
  );
  const shown = pts.filter((m) => topIds.has(m.model) || extra.has(m.model)); // keeps cheapest-first order
  const addable = pts.filter((m) => !topIds.has(m.model) && !extra.has(m.model));
  const max = Math.max(...shown.map(costOf));

  const show = (m) => (e) => setTip({ x: e.clientX, y: e.clientY, m });

  return (
    <div style={{ position: "relative" }} onMouseLeave={() => setTip(null)}>
      {(addable.length > 0 || extra.size > 0) && (
        <div className="lb-bar-add">
          <select className="lb-org-select" value="" aria-label="Add a model to the cost chart"
            onChange={(e) => { const v = e.target.value; if (v) setExtra((s) => new Set([...s, v])); }}>
            <option value="">Add a model…</option>
            {addable.map((m) => <option key={m.model} value={m.model}>{m.name}</option>)}
          </select>
          {extra.size > 0 && (
            <button className="lb-chip" onClick={() => setExtra(new Set())}>Clear added ({extra.size})</button>
          )}
        </div>
      )}
      {shown.map((m) => {
        const col = orgColor(m.org);
        return (
          <div className="lb-bar" key={m.model}
            onMouseEnter={show(m)} onMouseMove={show(m)}>
            <span className="name"><span className="lb-mdot" style={{ background: col }} />{m.name}</span>
            <div className="track"><div className="fill" style={{ width: `${(costOf(m) / max) * 100}%`, background: col }} /></div>
            <span className="val"><span className="cur">$</span>{costOf(m).toFixed(3)}</span>
          </div>
        );
      })}
      {tip && (
        <div className="lb-tip" style={{ position: "fixed", left: tip.x + 14, top: tip.y - 8, transform: "none" }}>
          <div className="tn">{tip.m.name}</div>
          <div className="tg">
            <span>Cost per successful task</span><span><span className="cur">$</span>{costOf(tip.m).toFixed(3)}</span>
            <span>$/1M out</span><span>{fmtPerM(perMillionOut(tip.m.cost))}</span>
            <span>avg output tokens{scope === "overall" ? "" : ` (${scope})`}</span><span>{Math.round(outputTokensForScope(tip.m.cost, categories, scope) || 0).toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}
