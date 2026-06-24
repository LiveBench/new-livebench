import React, { useState } from "react";
import { catShort } from "../../lib/constants";

const PAL = ["#2F54EB", "#CC785C", "#12B886"];
const W = 380, H = 360, cx = 190, cy = 180, R = 115;

export default function CategoryRadar({ models, categories }) {
  const cats = Object.keys(categories);
  const byName = (name) => models.find((m) => m.model === name);
  const top2 = models.slice().sort((a, b) => b.overall - a.overall).slice(0, 2).map((m) => m.model);
  const [sel, setSel] = useState(top2);

  const n = cats.length;
  const ang = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (i, r) => [cx + Math.cos(ang(i)) * r, cy + Math.sin(ang(i)) * r];
  const colorFor = (name) => PAL[sel.indexOf(name)] || "#888";
  const short = (name) => {
    const m = byName(name);
    return m ? m.name : name;
  };

  const add = (e) => { const v = e.target.value; if (v && sel.length < 3 && !sel.includes(v)) setSel([...sel, v]); };
  const remove = (name) => setSel(sel.filter((x) => x !== name));

  const rings = [0.25, 0.5, 0.75, 1];
  const options = models.filter((m) => !sel.includes(m.model)).sort((a, b) => b.overall - a.overall);

  return (
    <div className="lb-radar-wrap">
      <svg className="lb-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Category comparison radar">
        {rings.map((f, k) => (
          <polygon key={k} fill="none" stroke="#E4E9F2" strokeWidth="1"
            points={cats.map((_, i) => pt(i, R * f).join(",")).join(" ")} />
        ))}
        {cats.map((c, i) => {
          const [x, y] = pt(i, R);
          const [lx, ly] = pt(i, R + 18);
          return (
            <g key={c}>
              <line x1={cx} y1={cy} x2={x} y2={y} stroke="#E4E9F2" />
              <text x={lx} y={ly + 3} textAnchor="middle" fontFamily="var(--mono)" fontSize="10" fill="#5A6B85">
                {catShort(c)}
              </text>
            </g>
          );
        })}
        {sel.map((name) => {
          const m = byName(name);
          if (!m) return null;
          const col = colorFor(name);
          return (
            <g key={name}>
              <polygon fill={col} fillOpacity="0.13" stroke={col} strokeWidth="2"
                points={cats.map((c, i) => pt(i, R * ((m.cats[c] || 0) / 100)).join(",")).join(" ")} />
              {cats.map((c, i) => {
                const [x, y] = pt(i, R * ((m.cats[c] || 0) / 100));
                return <circle key={c} cx={x} cy={y} r="2.5" fill={col} />;
              })}
            </g>
          );
        })}
      </svg>
      <div>
        <div className="lb-radar-chips">
          {sel.map((name) => (
            <button key={name} className="lb-rchip" aria-pressed="true" title="Remove" onClick={() => remove(name)}>
              <span className="sw" style={{ background: colorFor(name) }} />{short(name)} <span style={{ color: "var(--faint)", fontWeight: 700 }}>×</span>
            </button>
          ))}
          {sel.length < 3 ? (
            <select className="lb-radar-add" aria-label="Add a model to compare" value="" onChange={add}>
              <option value="">+ Add model…</option>
              {options.map((m) => <option key={m.model} value={m.model}>{m.name} · {m.overall.toFixed(1)}</option>)}
            </select>
          ) : (
            <span style={{ fontSize: 11.5, color: "var(--faint)", alignSelf: "center" }}>Max 3 — remove one to add another</span>
          )}
        </div>
        <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 8 }}>Compare any 2–3 models · category averages · ranked by overall</div>
      </div>
    </div>
  );
}
