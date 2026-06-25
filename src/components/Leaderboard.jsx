import React, { useState, useMemo } from "react";
import { orgColor, catShort } from "../lib/constants";
import { costPerQuality, collapseVariants } from "../lib/compute";

const fmtQuality = (v) => (v == null ? "—" : `$${v.toFixed(4)}`);

// Relative shading: the top 5 in each score column get an accent tint,
// darkest (rank 1) → lightest (rank 5). Everything else is unshaded.
const SHADES = ["rgba(47,84,235,0.24)", "rgba(47,84,235,0.17)", "rgba(47,84,235,0.115)", "rgba(47,84,235,0.07)", "rgba(47,84,235,0.035)"];
function computeShades(rows, cats) {
  const map = {};
  for (const c of ["overall", ...cats]) {
    const vals = rows
      .map((m) => ({ model: m.model, v: c === "overall" ? m.overall : m.cats[c] }))
      .filter((x) => x.v != null)
      .sort((a, b) => b.v - a.v);
    const cm = {};
    vals.slice(0, 5).forEach((x, i) => { cm[x.model] = SHADES[i]; });
    map[c] = cm;
  }
  return map;
}

export default function Leaderboard({ models, categories, hasCost, frontier }) {
  const cats = Object.keys(categories);
  const [sortKey, setSortKey] = useState("overall");
  const [sortDir, setSortDir] = useState(-1);
  const [expanded, setExpanded] = useState(() => new Set());
  const [showVariants, setShowVariants] = useState(false);
  const [onlyReason, setOnlyReason] = useState(false);
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [q, setQ] = useState("");

  const sortVal = (m, k) => {
    if (k === "overall") return m.overall;
    if (k === "cpq") return m.cost ? m.cost.cost_per_question : null;
    if (k === "perq") return costPerQuality(m.overall, m.cost);
    if (k === "model") return m.name.toLowerCase();
    return m.cats[k];
  };

  const rows = useMemo(() => {
    let r = models.filter((m) => {
      if (onlyReason && !m.reasoner) return false;
      if (onlyOpen && !m.open) return false;
      if (q && !m.name.toLowerCase().includes(q) && !m.model.toLowerCase().includes(q)) return false;
      return true;
    });
    if (!showVariants) r = collapseVariants(r);
    return r.slice().sort((a, b) => {
      const va = sortVal(a, sortKey), vb = sortVal(b, sortKey);
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "string") return va < vb ? -sortDir : va > vb ? sortDir : 0;
      return (va - vb) * sortDir;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [models, onlyReason, onlyOpen, q, showVariants, sortKey, sortDir]);

  const shades = computeShades(rows, cats);

  const clickSort = (k) => {
    if (sortKey === k) setSortDir((d) => -d);
    // cost columns ($/task, $/quality) and the model name sort ascending first;
    // score columns sort descending first (best on top). Missing values always sink.
    else { setSortKey(k); setSortDir((k === "model" || k === "cpq" || k === "perq") ? 1 : -1); }
  };
  const arrow = (k) => (k === sortKey ? <span className="arr">{sortDir < 0 ? "▼" : "▲"}</span> : null);
  const toggleRow = (model) =>
    setExpanded((s) => { const n = new Set(s); n.has(model) ? n.delete(model) : n.add(model); return n; });

  const colCount = 3 + cats.length + (hasCost ? 3 : 0);

  return (
    <>
      <div className="lb-controls">
        <div className="lb-search">
          <input type="text" value={q} placeholder="Search models…" aria-label="Search models"
            onChange={(e) => setQ(e.target.value.toLowerCase())} />
        </div>
        <button className="lb-chip" aria-pressed={onlyReason} onClick={() => setOnlyReason((v) => !v)}>Reasoning</button>
        <button className="lb-chip" aria-pressed={onlyOpen} onClick={() => setOnlyOpen((v) => !v)}>Open weights</button>
        <button className="lb-chip" aria-pressed={showVariants} title="Off = best variant per model · On = every effort variant"
          onClick={() => setShowVariants((v) => !v)}>Model variants</button>
      </div>

      <div className="lb-tbl-scroll">
        <table className="lb-tbl">
          <thead>
            <tr>
              <th className="l" style={{ width: 30 }} aria-hidden="true" />
              <th className="l" onClick={() => clickSort("model")}>Model {arrow("model")}</th>
              <th onClick={() => clickSort("overall")}>Overall {arrow("overall")}</th>
              {cats.map((c) => <th key={c} title={c} onClick={() => clickSort(c)}>{catShort(c)} {arrow(c)}</th>)}
              {hasCost && <th className="grp" title="Measured cost to run the model on one task" onClick={() => clickSort("cpq")}>$/task {arrow("cpq")}</th>}
              {hasCost && <th title="Cost per LiveBench point — $/task ÷ overall (lower = better value)" onClick={() => clickSort("perq")}>$/quality {arrow("perq")}</th>}
              {hasCost && <th>Value</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const open = expanded.has(m.model);
              return (
                <React.Fragment key={m.model}>
                  <tr className={"row" + (open ? " open" : "")} onClick={() => toggleRow(m.model)}>
                    <td className="l lb-rank"><span className="lb-exp">▸</span></td>
                    <td className="l">
                      <div className="lb-mdl">
                        <span className="lb-mdot" style={{ background: orgColor(m.org) }} />
                        <span className="nm">{m.name}</span>
                        {showVariants && m.info?.version && <span className="ef">{m.info.version}</span>}
                        {m.reasoner && <span className="rz" title="reasoning model">⚡</span>}
                        {m.open && <span className="opn">open</span>}
                      </div>
                    </td>
                    <td className="lb-ovr" style={{ background: shades.overall[m.model] }}>{m.overall.toFixed(1)}</td>
                    {cats.map((c) => (
                      <td key={c} className="lb-cat" style={{ background: shades[c][m.model] }}>
                        {m.cats[c] == null ? "—" : m.cats[c].toFixed(1)}
                      </td>
                    ))}
                    {hasCost && <td className={"lb-cost-col" + (m.cost ? "" : " na")}>{m.cost ? `$${m.cost.cost_per_question.toFixed(3)}` : "—"}</td>}
                    {hasCost && <td className={m.cost ? "" : "na"}>{m.cost ? fmtQuality(costPerQuality(m.overall, m.cost)) : "—"}</td>}
                    {hasCost && <td>{m.cost && !m.cost.est && frontier.has(m.model) ? <span className="lb-bv">Best value</span> : ""}</td>}
                  </tr>
                  {open && (
                    <tr className="lb-detail">
                      <td colSpan={colCount}>
                        <div className="lb-detail-in">
                          <div className="lb-det-grid">
                            {cats.map((c) => (
                              <div className="lb-det-cat" key={c}>
                                <div className="h">{c}</div>
                                {categories[c].map((t) => {
                                  const v = m.row[t];
                                  const val = v == null || v === "" ? "—" : Number(v).toFixed(1);
                                  return (
                                    <div className="lb-subt" key={t}>
                                      <span className="n">{t.replace(/_/g, " ")}</span>
                                      <span className="v">{val}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="lb-foot-note">
        {"// shading = top 5 in each column · click a row for subtask scores"}
        {hasCost ? " · green pill = cost/quality value frontier · “—” = no published cost" : ""}
      </p>
    </>
  );
}
