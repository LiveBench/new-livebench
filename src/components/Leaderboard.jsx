import React, { useState, useEffect, useMemo } from "react";
import { catFull, subtaskLabel } from "../lib/constants";
import { collapseVariants, costForCategories } from "../lib/compute";

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
function computeShades(rows, cols, valFn) {
  const map = {};
  for (const c of cols) {
    const vals = rows.map((m) => ({ model: m.model, v: valFn(m, c) }))
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
  const initCats = (init.get("cats") || "").split(",").map((s) => s.trim()).filter((c) => c && categories[c]);
  const [selectedCats, setSelectedCats] = useState(initCats);
  const [sortKey, setSortKey] = useState(init.get("sort") || (initCats.length === 1 ? initCats[0] : "overall"));
  const [sortDir, setSortDir] = useState(init.get("dir") === "asc" ? 1 : -1);
  const [expanded, setExpanded] = useState(() => new Set());
  const [showVariants, setShowVariants] = useState(false);
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [q, setQ] = useState("");
  const [showOrg, setShowOrg] = useState(init.get("showorg") === "1");
  const [orgFilter, setOrgFilter] = useState(init.get("org") || "");

  const orgs = [...new Set(models.map((m) => m.org).filter(Boolean))].sort();

  const nSel = selectedCats.length;
  const single = nSel === 1 ? selectedCats[0] : null;   // the one category, when exactly one is selected
  const scopeCats = nSel === 0 ? cats : selectedCats;   // categories the cost/score scope covers

  // 1 category → its average + subtasks; 2+ → Overall(selected) + the selected categories; 0 → Overall + all.
  const scoreCols = single
    ? [single, ...categories[single]]
    : ["overall", ...(nSel >= 2 ? selectedCats : cats)];

  // score of the current scope = mean of its category averages (equal weight per category).
  const scopeScore = (m) => {
    const vs = scopeCats.map((c) => m.cats?.[c]).filter((v) => v != null);
    return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null;
  };
  // Overall column value: true overall when nothing is selected, else mean of the selected categories.
  const val = (m, k) => (k === "overall" ? (nSel === 0 ? m.overall : scopeScore(m)) : numVal(m, k));

  // Cost per successful task = (Σ cost ÷ Σ questions over the scope's subtasks) ÷ scope score × 100.
  const costScope = (m) => (m.cost ? costForCategories(m.cost, categories, scopeCats) : null);
  const costPerSuccess = (m) => {
    const c = costScope(m), s = nSel === 0 ? m.overall : scopeScore(m);
    return c != null && s ? (c / s) * 100 : null;
  };

  // reflect focus + sort in the URL (shareable, no history spam)
  useEffect(() => {
    const p = new URLSearchParams();
    if (selectedCats.length) p.set("cats", selectedCats.join(","));
    const isDefault = sortKey === (single || "overall") && sortDir === -1;
    if (!isDefault) { p.set("sort", sortKey); p.set("dir", sortDir < 0 ? "desc" : "asc"); }
    if (showOrg) p.set("showorg", "1");
    if (orgFilter) p.set("org", orgFilter);
    writeHash(p);
  }, [selectedCats, single, sortKey, sortDir, showOrg, orgFilter]);

  const sortVal = (m, k) => {
    if (k === "cpst") return costPerSuccess(m);
    if (k === "model") return m.name.toLowerCase();
    if (k === "org") return (m.org || "").toLowerCase();
    return val(m, k);
  };

  const rows = useMemo(() => {
    let r = models.filter((m) => {
      if (onlyOpen && !m.open) return false;
      if (orgFilter && m.org !== orgFilter) return false;
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
  }, [models, onlyOpen, orgFilter, q, showVariants, sortKey, sortDir, selectedCats]);

  const shades = computeShades(rows, scoreCols, val);

  const clearCats = () => { setSelectedCats([]); setSortKey("overall"); setSortDir(-1); };
  const toggleCat = (c) => {
    const next = selectedCats.includes(c)
      ? selectedCats.filter((x) => x !== c)
      : cats.filter((x) => x === c || selectedCats.includes(x)); // keep canonical category order
    setSelectedCats(next);
    setSortKey(next.length === 1 ? next[0] : "overall");
    setSortDir(-1);
  };
  const clickSort = (k) => {
    if (sortKey === k) setSortDir((d) => -d);
    // cost columns + model name sort ascending first; score columns sort descending first.
    else { setSortKey(k); setSortDir((k === "model" || k === "cpst" || k === "org") ? 1 : -1); }
  };
  const arrow = (k) => (k === sortKey ? <span className="arr">{sortDir < 0 ? "▼" : "▲"}</span> : null);
  const toggleRow = (model) =>
    setExpanded((s) => { const n = new Set(s); n.has(model) ? n.delete(model) : n.add(model); return n; });

  const headLabel = (k) => (k === "overall" ? "Overall" : k in categories ? catFull(k) : subtaskLabel(k));
  const headTitle = (k) => (k === "overall"
    ? (nSel >= 2 ? "Overall — mean of the selected category averages" : "Overall — mean of category averages")
    : k in categories ? catFull(k) : subtaskLabel(k));
  const colCount = 2 + scoreCols.length + (hasCost ? 1 : 0) + (showOrg ? 1 : 0);

  return (
    <>
      <div className="lb-controls">
        <div className="lb-search">
          <input type="text" value={q} placeholder="Search models…" aria-label="Search models"
            onChange={(e) => setQ(e.target.value.toLowerCase())} />
        </div>
        <button className="lb-chip" aria-pressed={onlyOpen} onClick={() => setOnlyOpen((v) => !v)}>Open weights</button>
        <button className="lb-chip" aria-pressed={showVariants} data-tip="Off = best variant per model · On = every effort variant"
          onClick={() => setShowVariants((v) => !v)}>Model variants</button>
        <button className="lb-chip" aria-pressed={showOrg} data-tip="Show the organization column"
          onClick={() => setShowOrg((v) => !v)}>Show org</button>
        <select className="lb-org-select" value={orgFilter} onChange={(e) => setOrgFilter(e.target.value)} aria-label="Filter by organization">
          <option value="">All organizations</option>
          {orgs.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      <div className="lb-cats">
        <span className="lb-cats-label">Category</span>
        <button className="lb-chip" aria-pressed={nSel === 0} onClick={clearCats}>All</button>
        {cats.map((c) => (
          <button key={c} className="lb-chip" data-tip={catFull(c)} aria-pressed={selectedCats.includes(c)} onClick={() => toggleCat(c)}>{catFull(c)}</button>
        ))}
      </div>

      <div className="lb-tbl-scroll">
        <table className="lb-tbl">
          <thead>
            <tr>
              <th className="l" style={{ width: 30 }} aria-hidden="true" />
              <th className="l mdl-col" onClick={() => clickSort("model")}><span className="th-h"><span className="th-t">Model</span>{arrow("model")}</span></th>
              {showOrg && <th className="l org-col" data-tip="Organization" onClick={() => clickSort("org")}><span className="th-h"><span className="th-t">Org</span>{arrow("org")}</span></th>}
              {scoreCols.map((k, i) => (
                <th key={k} className={i > 0 ? "sub" : undefined} data-tip={headTitle(k)} onClick={() => clickSort(k)}>
                  <span className="th-h"><span className="th-t">{headLabel(k)}</span>{arrow(k)}</span>
                </th>
              ))}
              {hasCost && <th className="grp wrap2" data-tip="Cost per successful task = (cost per task ÷ score) × 100 for the selected scope — penalizes failures / partial credit" onClick={() => clickSort("cpst")}><span className="th-h"><span className="th-t">Cost per<br />successful&nbsp;task</span>{arrow("cpst")}</span></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const open = expanded.has(m.model);
              const cpst = costPerSuccess(m);     // scope-aware cost per successful task
              return (
                <React.Fragment key={m.model}>
                  <tr className={"row" + (open ? " open" : "")} onClick={() => toggleRow(m.model)}>
                    <td className="l lb-rank"><span className="lb-exp">▸</span></td>
                    <td className="l mdl-col">
                      <div className="lb-mdl">
                        <span className="nm" title={m.name}>{m.name}</span>
                        {m.open && <span className="opn">open</span>}
                      </div>
                    </td>
                    {showOrg && <td className="l org-col">{m.org}</td>}
                    {scoreCols.map((k, i) => {
                      const v = val(m, k);
                      return (
                        <td key={k} className={i === 0 ? "lb-ovr" : "lb-cat"} style={{ background: shades[k] && shades[k][m.model] }}>
                          {v == null ? "—" : v.toFixed(1)}
                        </td>
                      );
                    })}
                    {hasCost && <td className={"lb-cost-col" + (cpst != null ? "" : " na")}><Money v={cpst} dp={3} /></td>}
                  </tr>
                  {open && (
                    <tr className="lb-detail">
                      <td colSpan={colCount}>
                        <div className="lb-detail-in">
                          <div className="lb-det-grid">
                            {(selectedCats.length ? selectedCats : cats).map((c) => (
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
        {nSel === 1
          ? `// ${catFull(single)} — its average + subtasks · click "All" to reset`
          : nSel >= 2
          ? `// comparing ${nSel} categories — Overall = mean of the selected · click "All" to reset`
          : "// select 1 category for its subtasks, or several to compare category averages · shading = top 5 per column · click a row for subtasks"}
        {hasCost ? " · Cost per successful task = (Σ cost ÷ Σ questions ÷ score) × 100 over the selected scope" : ""}
      </p>
    </>
  );
}
