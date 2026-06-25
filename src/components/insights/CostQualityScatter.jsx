import React, { useState } from "react";
import { orgColor } from "../../lib/constants";
import { perMillionOut, valueFrontier } from "../../lib/compute";

const fmtPerM = (v) => (v == null ? "—" : v < 10 ? `$${v.toFixed(1)}` : `$${Math.round(v)}`);
const W = 560, H = 400, pL = 46, pR = 14, pT = 16, pB = 46, pw = W - pL - pR, ph = H - pT - pB;

export default function CostQualityScatter({ models }) {
  const [tip, setTip] = useState(null);
  const [frontierOnly, setFrontierOnly] = useState(false);

  const pts = models.filter((m) => m.cost && m.cost.cost_per_question > 0 && !m.cost.est);
  if (pts.length < 2) return null;
  const front = valueFrontier(pts);

  const costs = pts.map((p) => p.cost.cost_per_question);
  const overs = pts.map((p) => p.overall);
  const xMin = Math.min(...costs) * 0.85, xMax = Math.max(...costs) * 1.15;
  const yMin = Math.floor(Math.min(...overs) - 2), yMax = Math.ceil(Math.max(...overs) + 2);
  const lx = (v) => Math.log10(v);
  const X = (v) => pL + ((lx(v) - lx(xMin)) / (lx(xMax) - lx(xMin))) * pw;
  const Y = (v) => pT + (1 - (v - yMin) / (yMax - yMin)) * ph;

  const xTicks = [0.005, 0.01, 0.02, 0.03, 0.05, 0.07, 0.1, 0.15, 0.2, 0.3, 0.5, 0.7, 1].filter((t) => t >= xMin && t <= xMax);
  const yStep = Math.max(1, Math.round((yMax - yMin) / 5));
  const yTicks = []; for (let y = yMin; y <= yMax; y += yStep) yTicks.push(y);

  const frontPts = pts.filter((p) => front.has(p.model)).sort((a, b) => a.cost.cost_per_question - b.cost.cost_per_question);
  const frontPath = frontPts.map((p, i) => `${i ? "L" : "M"}${X(p.cost.cost_per_question)} ${Y(p.overall)}`).join(" ");

  const orgs = [...new Set(pts.map((p) => p.org))];

  const enter = (m) => () => setTip({
    xPct: (X(m.cost.cost_per_question) / W) * 100,
    yPct: (Y(m.overall) / H) * 100,
    m,
  });

  return (
    <>
      <div className="lb-card-tools">
        <button className="lb-chip" style={{ fontSize: 11, padding: "5px 10px" }}
          aria-pressed={frontierOnly} onClick={() => setFrontierOnly((v) => !v)}>Frontier only</button>
      </div>
      <h3>Quality vs. cost</h3>
      <p className="ch-sub">LiveBench overall vs. cost per task (log). The <b style={{ color: "var(--accent)" }}>value frontier</b> is the best score at each price.</p>
      <div style={{ position: "relative" }}>
        <svg className="lb-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Quality versus cost scatter plot">
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
          <text x={pL + pw / 2} y={H - 6} textAnchor="middle" fontFamily="var(--mono)" fontSize="10.5" fill="#5A6B85">cost / task (log) →</text>
          <text x={13} y={pT + ph / 2} textAnchor="middle" fontFamily="var(--mono)" fontSize="10.5" fill="#5A6B85"
            transform={`rotate(-90 13 ${pT + ph / 2})`}>LiveBench overall ↑</text>
          {frontPath && <path d={frontPath} fill="none" stroke="#2F54EB" strokeWidth="2" strokeDasharray="5 3" />}
          {pts.map((m) => {
            const col = orgColor(m.org);
            const dim = frontierOnly && !front.has(m.model);
            const cx = X(m.cost.cost_per_question), cy = Y(m.overall);
            return (
              <circle key={m.model} cx={cx} cy={cy} r={5.5}
                fill={m.reasoner ? "#fff" : col} stroke={col} strokeWidth="2"
                opacity={dim ? 0.16 : 1} style={{ cursor: "pointer" }}
                onMouseEnter={enter(m)} onMouseLeave={() => setTip(null)} />
            );
          })}
        </svg>
        {tip && (
          <div className="lb-tip" style={{ left: `${tip.xPct}%`, top: `${tip.yPct}%`, transform: "translate(10px,-50%)" }}>
            <div className="tn">{tip.m.name}</div>
            <div className="tg">
              <span>overall</span><span>{tip.m.overall.toFixed(1)}</span>
              <span>$/task</span><span>${tip.m.cost.cost_per_question.toFixed(3)}</span>
              <span>$/1M out</span><span>{fmtPerM(perMillionOut(tip.m.cost))}</span>
              <span>out tokens</span><span>{Number(tip.m.cost.avg_output_tokens).toLocaleString()}</span>
            </div>
            {front.has(tip.m.model) && <div style={{ marginTop: 6, color: "#7Cf0c0" }}>● value frontier</div>}
          </div>
        )}
      </div>
      <div className="lb-legend">
        {orgs.map((o) => <span className="li" key={o}><span className="sw" style={{ background: orgColor(o) }} />{o}</span>)}
        <span className="li"><span className="sw" style={{ border: "1.5px solid #888", background: "#fff" }} />reasoning</span>
      </div>
    </>
  );
}
