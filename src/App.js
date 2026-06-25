import React, { useState, useMemo } from "react";
import "./App.css";
import { bibtexEntry } from "./constants";
import { RELEASES } from "./lib/constants";
import useLeaderboardData from "./lib/useLeaderboardData";
import { overallOf, catAvg, valueFrontier } from "./lib/compute";
import { getModelInfo } from "./Table/modelLinks";
import Navbar from "./components/Navbar";
import ReleaseTimeline from "./components/ReleaseTimeline";
import MetricsStrip from "./components/MetricsStrip";
import Leaderboard from "./components/Leaderboard";
import Insights from "./components/insights/Insights";

const LATEST = RELEASES[RELEASES.length - 1];

export default function App() {
  const [date, setDate] = useState(LATEST);
  const { rawData, categories, costMap, hasCost, loading, error } = useLeaderboardData(date);

  // Enrich each model row with metadata + computed scores once per load.
  const models = useMemo(() => {
    const cats = categories || {};
    return rawData
      .map((row) => {
        const info = getModelInfo(row.model);
        if (!info) return null; // mirror the site: only models with metadata are shown
        const overall = overallOf(row, cats);
        if (overall == null) return null;
        const c = {};
        Object.keys(cats).forEach((k) => { c[k] = catAvg(row, cats, k); });
        const cost = hasCost && costMap[row.model] ? costMap[row.model] : null;
        return {
          model: row.model, row, info,
          name: info.displayName || row.model,
          org: info.organization || "Other",
          reasoner: !!info.reasoner, open: !!info.openweight,
          overall, cats: c, cost,
        };
      })
      .filter(Boolean);
  }, [rawData, categories, costMap, hasCost]);

  const frontier = useMemo(() => valueFrontier(models), [models]);
  const taskCount = Object.values(categories).reduce((s, a) => s + (a ? a.length : 0), 0);
  const catCount = Object.keys(categories).length;

  return (
    <div>
      <Navbar variant="home" />

      <header className="lb-hero">
        <div className="lb-wrap">
          <p className="lb-eyebrow">Contamination-free LLM benchmark</p>
          <h1>A challenging, contamination-free LLM benchmark.</h1>
          <p className="sub">
            {taskCount || 23} objective tasks across {catCount || 7} categories, refreshed every six months.{" "}
            <b>Pick a release, compare scores down to the subtask, and see what each model costs to run.</b>
          </p>
          <ReleaseTimeline releases={RELEASES} value={date} onChange={setDate} />
          <p className="lb-tl-note" style={{ maxWidth: "62ch" }}>
            {date === LATEST ? (
              <>Showing <b>LiveBench-{date}</b> — the latest release. <span style={{ color: "var(--live)" }}>● live</span></>
            ) : (
              <>Showing <b>LiveBench-{date}</b>.{!hasCost && " Cost data is published for the latest release only."}</>
            )}
          </p>
        </div>
      </header>

      <section className="lb-section" id="lb-leaderboard">
        <div className="lb-wrap">
          {loading && <div className="lb-state">Loading {date}…</div>}
          {error && <div className="lb-state err">Couldn't load this release ({error}).</div>}
          {!loading && !error && (
            <>
              <MetricsStrip models={models} categories={categories} hasCost={hasCost} dateStr={date} />
              <div className="lb-sec-head" style={{ marginTop: 34 }}>
                <span className="lb-sec-no">01</span><h2>Leaderboard</h2>
              </div>
              <p className="lb-sec-sub">
                Overall + every category, sortable. Click a row for its subtask scores.
                {hasCost ? " Cost sits right beside the scores." : ""}
              </p>
              <Leaderboard key={date} models={models} categories={categories} hasCost={hasCost} frontier={frontier} />
            </>
          )}
        </div>
      </section>

      {!loading && !error && models.length > 0 && (
        <Insights key={date} models={models} categories={categories} hasCost={hasCost} />
      )}

      <section className="lb-section" id="BibTeX">
        <div className="lb-wrap">
          <div className="lb-sec-head"><span className="lb-sec-no">03</span><h2>BibTeX</h2></div>
          <pre className="lb-bibtex"><code>{bibtexEntry}</code></pre>
        </div>
      </section>

      <footer className="lb-footer">
        <div className="lb-wrap">
          <span>LiveBench · sponsored by Abacus.AI · a contamination-free LLM benchmark.</span>
          <span className="mono" style={{ color: "var(--faint)" }}>Overall = mean of category averages · cost = $/task</span>
        </div>
      </footer>
    </div>
  );
}
