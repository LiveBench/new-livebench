import React, { useState, useEffect, useMemo } from "react";
import { orgColor, catShort, catFull, subtaskLabel } from "../lib/constants";
import { costForScope, costPerQuality, frontierBy, collapseVariants } from "../lib/compute";

// Render $X with the "$" in a .cur span (size-only nudge — see index.css).
const Money = ({ v, dp }) => (v == null ? "—" : <><span className="cur">$</span>{v.toFixed(dp)}</>);

// Numeric value of a score column key: "overall", a category name (average), or a subtask column (raw score).
const numVal = (m, k) => {
  if (k === "overall") return m.overall;
  if (m.cats[k] !== undefined) return m.cats[k];      // category average
  const v = m.row[k];                                  // subtask raw score
  return v == null || v === "" ? null : Number(v);
};

// Relative shading: the top 5 in each score column get an accent tint, darkest (rank 1) → lightest (rank 5).
const SHADES = ["rgba(47,84,235,0.24)", "rgba(47,84,235,0.17)", "rgba(47,84,235,0.115)", "rgba(47,84,235,0.07)", "rgba(47,84,235,0.035)"];
function computeShades(rows, cols) {
  const map = {};
  for (const c of cols) {
    const vals = rows.map((m) => ({ model: m.model, v: numVal(m, c) }))
      .filter((x) => x.v != null).sort((a, b) => b.v - a.v);
    const cm = {};
    vals.slice(0, 5).forEach((x, i) => { cm[x.model] = SHADES[i]; });
    map[c] = cm;
  }
  return map;
}

// ---- URL state lives in the hash query (e.g. #/?cat=Agentic+Coding&sort=python&dir=desc) ----
const readHash = () => {
  const h = window.location.hash || "";
  const qi = h.indexOf("?");
  return new URLSearchParams(qi >= 0 ? h.slice(qi + 1) : "");
};
const writeHash = (params) => {
  const h = window.location.hash || "#/";
  const base = h.indexOf("?") >= 0 ? h.slice(0, h.indexOf("?")) : h || "#/";
  const qs = params.toString();
  window.history.replaceState(null, "", qs ? `${base}?${qs}` : base);
};

export default function Leaderboard({ models, categories, hasCost }) {
  const cats = Object.keys(categories);

  // initialize view state from the URL so links are shareable
  const init = readHash();
  const initCat = init.get("cat") && categories[init.get("cat")] ? init.get("cat") : null;
  const [focusedCat, setFocusedCat] = useState(initCat);
  const [sortKey, setSortKey] = useState(init.get("sort") || initCat || "overall");
  const [sortDir, setSortDir] = useState(init.get("dir") === "asc" ? 1 : -1);
  const [expanded, setExpanded] = useState(() => new Set());
  const [showVariants, setShowVariants] = useState(false);
  const [onlyReason, setOnlyReason] = useState(false);
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [q, setQ] = useState("");

  const scoreCols = focusedCat ? [focusedCat, ...categories[focusedCat]] : ["overall", ...cats];

  // The cost columns ($/Q, $/quality, Value) follow the selected score scope:
  // a focused category or a sorted subtask, else overall. So selecting "Coding"
  // (or sorting by the python column) makes cost reflect exactly that scope.
  const costScope = (sortKey === "cpq" || sortKey === "perq" || sortKey === "model")
    ? (focusedCat || "overall")
    : sortKey;
  const scopeCost = (m) => costForScope(m.cost, categories, costScope);
  const scopeLabel = costScope === "overall"
    ? null
    : (costScope in categories ? catShort(costScope) : subtaskLabel(costScope));

  // reflect focus + sort in the URL (shareable, no history spam)
  useEffect(() => {
    const p = new URLSearchParams();
    if (focusedCat) p.set("cat", focusedCat);
    const isDefault = sortKey === (focusedCat || "overall") && sortDir === -1;
    if (!isDefault) { p.set("sort", sortKey); p.set("dir", sortDir < 0 ? "desc" : "asc"); }
    writeHash(p);
  }, [focusedCat, sortKey, sortDir]);

  const sortVal = (m, k) => {
    if (k === "cpq") return scopeCost(m);
    if (k === "perq") return costPerQuality(scopeCost(m), numVal(m, costScope));
    if (k === "model") return m.name.toLowerCase();
    return numVal(m, k);
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

  const shades = computeShades(rows, scoreCols);

  // value frontier at the current cost scope: cheapest model topping each score ceiling.
  const frontier = useMemo(
    () => frontierBy(models, (m) => costForScope(m.cost, categories, costScope), (m) => numVal(m, costScope)),
    [models, costScope, categories]
  );

  const focusCat = (c) => { setFocusedCat(c); setSortKey(c || "overall"); setSortDir(-1); };
  const clickSort = (k) => {
    if (sortKey === k) setSortDir((d) => -d);
    // cost columns + model name sort ascending first; score columns sort descending first.
    else { setSortKey(k); setSortDir((k === "model" || k === "cpq" || k === "perq") ? 1 : -1); }
  };
  const arrow = (k) => (k === sortKey ? <span className="arr">{sortDir < 0 ? "▼" : "▲"}</span> : null);
  const toggleRow = (model) =>
    setExpanded((s) => { const n = new Set(s); n.has(model) ? n.delete(model) : n.add(model); return n; });

  const headLabel = (k) => (k === "overall" ? "Overall" : k === focusedCat ? catFull(k) : k in categories ? catShort(k) : subtaskLabel(k));
  const headTitle = (k) => (k === "overall" ? "Overall — mean of category averages" : k in categories ? catFull(k) : subtaskLabel(k));
  const colCount = 2 + scoreCols.length + (hasCost ? 3 : 0);

  return (
    <>
      <div className="lb-controls">
        <div className="lb-search">
          <input type="text" value={q} placeholder="Search models…" aria-label="Search models"
            onChange={(e) => setQ(e.target.value.toLowerCase())} />
        </div>
        <button className="lb-chip" aria-pressed={onlyReason} onClick={() => setOnlyReason((v) => !v)}>Reasoning</button>
        <button className="lb-chip" aria-pressed={onlyOpen} onClick={() => setOnlyOpen((v) => !v)}>Open weights</button>
        <button className="lb-chip" aria-pressed={showVariants} data-tip="Off = best variant per model · On = every effort variant"
          onClick={() => setShowVariants((v) => !v)}>Model variants</button>
      </div>

      <div className="lb-cats">
        <span className="lb-cats-label">Category</span>
        <button className="lb-chip" aria-pressed={!focusedCat} onClick={() => focusCat(null)}>All</button>
        {cats.map((c) => (
          <button key={c} className="lb-chip" data-tip={catFull(c)} aria-pressed={focusedCat === c} onClick={() => focusCat(focusedCat === c ? null : c)}>{c}</button>
        ))}
      </div>

      <div className="lb-tbl-scroll">
        <table className="lb-tbl">
          <thead>
            <tr>
              <th className="l" style={{ width: 30 }} aria-hidden="true" />
              <th className="l" onClick={() => clickSort("model")}>Model {arrow("model")}</th>
              {scoreCols.map((k) => (
                <th key={k} className={focusedCat ? "sub" : undefined} data-tip={headTitle(k)} onClick={() => clickSort(k)}>{headLabel(k)} {arrow(k)}</th>
              ))}
              {hasCost && <th className="grp" data-tip={`Measured cost per question — ${costScope === "overall" ? "overall (mean of category costs)" : "for " + (scopeLabel || costScope)}`} onClick={() => clickSort("cpq")}>{scopeLabel ? `$/Q·${scopeLabel}` : "$/Q"} {arrow("cpq")}</th>}
              {hasCost && <th data-tip="Cost per LiveBench point — scoped $/Q ÷ scoped score (lower = better value)" onClick={() => clickSort("perq")}>{scopeLabel ? `$/qual·${scopeLabel}` : "$/quality"} {arrow("perq")}</th>}
              {hasCost && <th data-tip={`Value frontier at the ${scopeLabel || "overall"} scope`}>Value</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const open = expanded.has(m.model);
              const cScope = scopeCost(m);                                   // $/Q at current scope
              const qScope = costPerQuality(cScope, numVal(m, costScope));   // $/quality at current scope
              return (
                <React.Fragment key={m.model}>
                  <tr className={"row" + (open ? " open" : "")} onClick={() => toggleRow(m.model)}>
                    <td className="l lb-rank"><span className="lb-exp">▸</span></td>
                    <td className="l">
                      <div className="lb-mdl">
                        <span className="lb-mdot" style={{ background: orgColor(m.org) }} />
                        <span className="nm">{m.name}</span>
                        {showVariants && m.info?.version && <span className="ef">{m.info.version}</span>}
                        {m.reasoner && <span className="rz" data-tip="reasoning model">⚡</span>}
                        {m.open && <span className="opn">open</span>}
                      </div>
                    </td>
                    {scoreCols.map((k, i) => {
                      const v = numVal(m, k);
                      return (
                        <td key={k} className={i === 0 ? "lb-ovr" : "lb-cat"} style={{ background: shades[k] && shades[k][m.model] }}>
                          {v == null ? "—" : v.toFixed(1)}
                        </td>
                      );
                    })}
                    {hasCost && <td className={"lb-cost-col" + (cScope != null ? "" : " na")}><Money v={cScope} dp={3} /></td>}
                    {hasCost && <td className={qScope != null ? "" : "na"}><Money v={qScope} dp={4} /></td>}
                    {hasCost && <td>{frontier.has(m.model) ? <span className="lb-bv">Best value</span> : ""}</td>}
                  </tr>
                  {open && (
                    <tr className="lb-detail">
                      <td colSpan={colCount}>
                        <div className="lb-detail-in">
                          <div className="lb-det-grid">
                            {(focusedCat ? [focusedCat] : cats).map((c) => (
                              <div className="lb-det-cat" key={c}>
                                <div className="h">{catFull(c)}</div>
                                {categories[c].map((t) => {
                                  const v = m.row[t];
                                  const val = v == null || v === "" ? "—" : Number(v).toFixed(1);
                                  return (
                                    <div className="lb-subt" key={t}>
                                      <span className="n">{subtaskLabel(t)}</span>
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
        {focusedCat
          ? `// focused on ${focusedCat} — showing its average + subtasks · click "All" to reset`
          : "// click a Category to focus its subtasks · shading = top 5 per column · click a row for subtask scores"}
        {hasCost ? ` · $/Q & $/quality reflect the ${scopeLabel || "overall"} scope · pill = value frontier` : ""}
      </p>
    </>
  );
}
