import React, { useState } from "react";
import { orgColor } from "../../lib/constants";
import { perMillionOut, frontierBy, costForScope, outputTokensForScope, costPerSuccess } from "../../lib/compute";

const fmtPerM = (v) => (v == null ? "—" : v < 10 ? `$${v.toFixed(1)}` : `$${Math.round(v)}`);
const W = 560, H = 400, pL = 46, pR = 14, pT = 16, pB = 46, pw = W - pL - pR, ph = H - pT - pB;
const X_TICKS = [0.002, 0.005, 0.01, 0.02, 0.03, 0.05, 0.07, 0.1, 0.15, 0.2, 0.3, 0.5, 0.7, 1, 1.5, 2, 3, 5, 7, 10, 15, 20, 30, 50];

export default function CostQualityScatter({ models, categories, scope = "overall" }) {
  const [tip, setTip] = useState(null);
  const [anchor, setAnchor] = useState(null); // model id clicked to anchor the kill zone

  const scoreOf = (m) => (scope === "overall" ? m.overall : m.cats?.[scope]);
  // x-axis metric = cost per successful task = ($/task ÷ score) × 100
  const costOf = (m) => costPerSuccess(costForScope(m.cost, categories, scope), scoreOf(m));

  const pts = models.filter((m) => costOf(m) > 0 && scoreOf(m) != null);
  if (pts.length < 2) return null;
  const front = frontierBy(pts, costOf, scoreOf);

  const costs = pts.map(costOf);
  const overs = pts.map(scoreOf);
  const xMin = Math.min(...costs) * 0.85, xMax = Math.max(...costs) * 1.15;
  const yMin = Math.floor(Math.min(...overs) - 2), yMax = Math.ceil(Math.max(...overs) + 2);
  const lx = (v) => Math.log10(v);
  const X = (v) => pL + ((lx(v) - lx(xMin)) / (lx(xMax) - lx(xMin))) * pw;
  const Y = (v) => pT + (1 - (v - yMin) / (yMax - yMin)) * ph;

  const xTicks = X_TICKS.filter((t) => t >= xMin && t <= xMax);
  const yStep = Math.max(1, Math.round((yMax - yMin) / 5));
  const yTicks = []; for (let y = yMin; y <= yMax; y += yStep) yTicks.push(y);

  const frontPts = pts.filter((p) => front.has(p.model)).sort((a, b) => costOf(a) - costOf(b));
  const frontPath = frontPts.map((p, i) => `${i ? "L" : "M"}${X(costOf(p))} ${Y(scoreOf(p))}`).join(" ");

  const orgs = [...new Set(pts.map((p) => p.org))];
  const scopeName = scope === "overall" ? "overall" : scope;

  // Kill zone: click a model (the frontier is the interesting case) and everything that scores
  // no higher for no less money is dominated — down-and-right of it on these axes. Looked up by
  // id so a stale pick from another scope or a filtered-out model just clears itself.
  const sel = anchor ? pts.find((p) => p.model === anchor) : null;
  const dominated = sel
    ? pts.filter((m) => m.model !== sel.model && scoreOf(m) <= scoreOf(sel) && costOf(m) >= costOf(sel))
    : [];
  const kz = sel && { x: X(costOf(sel)), y: Y(scoreOf(sel)) };
  const nDom = dominated.length;
  const domSet = new Set(dominated.map((m) => m.model));

  const enter = (m) => () => setTip({ xPct: (X(costOf(m)) / W) * 100, yPct: (Y(scoreOf(m)) / H) * 100, m });

  // Effort suffix ("High", "xHigh Effort", …) moves to a small bracketed second line to keep
  // labels narrow. Bare "Max" stays put — that's a model tier (Qwen 3.8 Max), not an effort.
  const EFFORT_RE = /\s*\(?(Max Effort|Max Thinking|xHigh Effort|High Effort|Medium Effort|Low Effort|xHigh|High|Medium|Low)\)?$/;
  const splitEffort = (name) => {
    const m = name.match(EFFORT_RE);
    return m ? { base: name.slice(0, m.index), effort: `(${m[1].replace(/ Effort$/, "").toLowerCase()})` }
      : { base: name, effort: null };
  };

  // Point labels: anchored model when one is clicked, otherwise frontier models — placed so
  // labels never crowd: best score picks first; a collision tries below the point, then skips.
  // Up-and-left of a point is open space on these axes; flip to the right near the left edge.
  const labelFor = (m, below = false) => {
    const { base, effort } = splitEffort(m.name);
    const x = X(costOf(m)), y = Y(scoreOf(m));
    const flip = x - 10 - base.length * 5.6 < pL - 12;
    const ly = below
      ? Math.min(y + 17, H - pB - (effort ? 16 : 5))
      : Math.max(y - (effort ? 19 : 9), pT + 9);
    return { base, effort, x: flip ? x + 10 : x - 10, y: ly, ta: flip ? "start" : "end" };
  };
  let labeled;
  if (sel) labeled = [{ m: sel, below: false }];
  else {
    labeled = [];
    const boxes = [];
    [...frontPts].sort((a, b) => scoreOf(b) - scoreOf(a)).forEach((m) => {
      for (const below of [false, true]) {
        const l = labelFor(m, below);
        const w = Math.max(l.base.length * 5.6, (l.effort || "").length * 4.4);
        const b = { x1: l.ta === "end" ? l.x - w : l.x, x2: l.ta === "end" ? l.x : l.x + w, y1: l.y - 8, y2: l.y + (l.effort ? 18 : 2) };
        if (boxes.some((o) => b.x1 < o.x2 + 8 && o.x1 < b.x2 + 8 && b.y1 < o.y2 + 2 && o.y1 < b.y2 + 2)) continue;
        // The below slot is a fallback — only take it in genuinely clear space (no dots under the text).
        if (below && pts.some((p) => p.model !== m.model &&
          X(costOf(p)) > b.x1 - 7 && X(costOf(p)) < b.x2 + 7 && Y(scoreOf(p)) > b.y1 - 7 && Y(scoreOf(p)) < b.y2 + 7)) continue;
        boxes.push(b); labeled.push({ m, below });
        return;
      }
    });
  }

  return (
    <>
      <h3>Quality vs. cost{scope === "overall" ? "" : ` · ${scope}`}</h3>
      <p className="ch-sub">{scope === "overall" ? "LiveBench overall" : `${scope} score`} vs. Cost per successful task (log). The <b style={{ color: "var(--accent)" }}>value frontier</b> is the best score at each cost. Click a model to grey out its <b>kill zone</b> — everything that scores lower and costs more; click it again to clear.</p>
      <div style={{ position: "relative" }}>
        <svg className="lb-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Quality versus cost scatter plot">
          <defs>
            <pattern id="lb-kz-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="7" stroke="rgba(20,33,61,0.14)" strokeWidth="2" />
            </pattern>
          </defs>
          {sel && <rect x={pL} y={pT} width={pw} height={ph} fill="transparent" onClick={() => setAnchor(null)} />}
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={pL} y1={Y(t)} x2={W - pR} y2={Y(t)} stroke="#E4E9F2" />
              <text x={pL - 8} y={Y(t) + 3} textAnchor="end" fontFamily="var(--mono)" fontSize="10" fill="#8A99B5">{t}</text>
            </g>
          ))}
          {xTicks.map((t) => (
            <g key={t}>
              <line x1={X(t)} y1={pT} x2={X(t)} y2={H - pB} stroke="#EEF1F7" />
              <text x={X(t)} y={H - pB + 18} textAnchor="middle" fontFamily="var(--mono)" fontSize="10" fill="#8A99B5">{`$${t}`}</text>
            </g>
          ))}
          <text x={pL + pw / 2} y={H - 6} textAnchor="middle" fontFamily="var(--mono)" fontSize="10.5" fill="#5A6B85">Cost per successful task (log) →</text>
          <text x={13} y={pT + ph / 2} textAnchor="middle" fontFamily="var(--mono)" fontSize="10.5" fill="#5A6B85"
            transform={`rotate(-90 13 ${pT + ph / 2})`}>{scope === "overall" ? "LiveBench overall ↑" : `${scope} score ↑`}</text>
          {kz && kz.x < W - pR - 1 && kz.y < H - pB - 1 && (
            <g pointerEvents="none">
              <rect x={kz.x} y={kz.y} width={W - pR - kz.x} height={H - pB - kz.y} fill="rgba(20,33,61,0.08)" />
              <rect x={kz.x} y={kz.y} width={W - pR - kz.x} height={H - pB - kz.y} fill="url(#lb-kz-hatch)" />
              <line x1={kz.x} y1={kz.y} x2={W - pR} y2={kz.y} stroke="#5A6B85" strokeWidth="1.2" strokeDasharray="4 3" />
              <line x1={kz.x} y1={kz.y} x2={kz.x} y2={H - pB} stroke="#5A6B85" strokeWidth="1.2" strokeDasharray="4 3" />
              {W - pR - kz.x > 150 && H - pB - kz.y > 34 && (
                <text x={W - pR - 8} y={kz.y + 16} textAnchor="end" fontFamily="var(--mono)" fontSize="10.5" fontWeight="700" fill="#14213D"
                  stroke="#FFFFFF" strokeWidth="3" paintOrder="stroke">
                  {`KILL ZONE · ${nDom} ${nDom === 1 ? "model" : "models"} worse & pricier`}
                </text>
              )}
            </g>
          )}
          {frontPath && <path d={frontPath} fill="none" stroke="#2F54EB" strokeWidth="2" strokeDasharray="5 3" />}
          {pts.map((m) => {
            const col = orgColor(m.org);
            const cx = X(costOf(m)), cy = Y(scoreOf(m));
            const isAnchor = sel && m.model === sel.model;
            const isDom = domSet.has(m.model);
            return (
              <circle key={m.model} cx={cx} cy={cy} r={isAnchor ? 7 : 5.5}
                fill={isDom ? "#C3CBDC" : col} stroke={isAnchor ? "#14213D" : isDom ? "#C3CBDC" : col} strokeWidth={isAnchor ? 2.5 : 2}
                opacity={isDom ? 0.55 : 1} style={{ cursor: "pointer" }}
                onMouseEnter={enter(m)} onMouseLeave={() => setTip(null)}
                onClick={() => setAnchor((a) => (a === m.model ? null : m.model))} />
            );
          })}
          {labeled.map(({ m, below }) => {
            const l = labelFor(m, below);
            const isAnchor = sel && m.model === sel.model;
            return (
              <text key={`lbl-${m.model}`} x={l.x} y={l.y} textAnchor={l.ta} pointerEvents="none"
                fontSize={isAnchor ? "11.5" : "10"} fontWeight={isAnchor ? "800" : "600"}
                fill={isAnchor ? "#14213D" : "#3D4E6B"} stroke="#FFFFFF" strokeWidth="3" paintOrder="stroke">
                {l.base}
                {l.effort && (
                  <tspan x={l.x} dy="11" fontSize={isAnchor ? "9.5" : "8.5"} fontWeight="500"
                    fill={isAnchor ? "#5A6B85" : "#8A99B5"}>{l.effort}</tspan>
                )}
              </text>
            );
          })}
        </svg>
        {tip && (
          <div className="lb-tip" style={{ left: `${tip.xPct}%`, top: `${tip.yPct}%`, transform: "translate(10px,-50%)" }}>
            <div className="tn">{tip.m.name}</div>
            <div className="tg">
              <span>{scopeName}</span><span>{scoreOf(tip.m).toFixed(1)}</span>
              <span>Cost per successful task</span><span><span className="cur">$</span>{costOf(tip.m).toFixed(3)}</span>
              <span>$/1M out</span><span>{fmtPerM(perMillionOut(tip.m.cost))}</span>
              <span>avg output tokens{scope === "overall" ? "" : ` (${scope})`}</span><span>{Math.round(outputTokensForScope(tip.m.cost, categories, scope) || 0).toLocaleString()}</span>
            </div>
            {front.has(tip.m.model) && <div style={{ marginTop: 6, color: "#7Cf0c0" }}>● value frontier</div>}
            {sel && tip.m.model === sel.model && <div style={{ marginTop: 6, color: "#A9B4CA" }}>{`◻ kill-zone anchor · ${nDom} dominated`}</div>}
            {dominated.some((m) => m.model === tip.m.model) && <div style={{ marginTop: 6, color: "#A9B4CA" }}>{`◻ in ${sel.name}'s kill zone`}</div>}
          </div>
        )}
      </div>
      <div className="lb-legend">
        {orgs.map((o) => <span className="li" key={o}><span className="sw" style={{ background: orgColor(o) }} />{o}</span>)}
      </div>
      <div className="lb-attrib">
        <span className="lb-pulse" />
        <span>Source: <b>LiveBench.AI</b> — contamination-free LLM benchmark</span>
        <span className="mono lb-attrib-url">livebench.ai/#/insights</span>
      </div>
    </>
  );
}
