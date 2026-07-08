import { useEffect, useState } from "react";
import Papa from "papaparse";

const fileDate = (dateStr) => dateStr.replaceAll("-", "_");
const parseCsv = (text) =>
  Papa.parse(text, { header: true, dynamicTyping: true, skipEmptyLines: true }).data.filter((r) => r.model);

// Loads the three per-release files for one date. Cost is optional: if
// cost_<date>.csv is missing (older releases), hasCost is false and the UI
// hides all cost columns/graphs.
export default function useLeaderboardData(dateStr) {
  const [state, setState] = useState({
    rawData: [], costMap: {}, categories: {}, hasCost: false, loading: true, error: null,
  });

  useEffect(() => {
    let cancelled = false;
    const d = fileDate(dateStr);
    const base = process.env.PUBLIC_URL || "";
    // Cache-bust: the CSV/JSON filenames are fixed across deploys, so a browser/CDN
    // will serve a stale copy after we update the data. REACT_APP_BUILD changes every
    // build (see package.json), forcing a fresh fetch after each deploy.
    const v = process.env.REACT_APP_BUILD ? `?v=${process.env.REACT_APP_BUILD}` : "";
    setState((s) => ({ ...s, loading: true, error: null }));

    Promise.all([
      fetch(`${base}/table_${d}.csv${v}`).then((r) => {
        if (!r.ok) throw new Error(`table_${d}.csv → ${r.status}`);
        return r.text();
      }),
      fetch(`${base}/categories_${d}.json${v}`).then((r) => {
        if (!r.ok) throw new Error(`categories_${d}.json → ${r.status}`);
        return r.json();
      }),
      fetch(`${base}/cost_${d}.csv${v}`).then((r) => (r.ok ? r.text() : null)).catch(() => null),
    ])
      .then(([tableText, categories, costText]) => {
        if (cancelled) return;
        const rawData = parseCsv(tableText);
        const costMap = {};
        if (costText) parseCsv(costText).forEach((r) => { costMap[r.model] = r; });
        setState({
          rawData, categories, costMap,
          hasCost: Object.keys(costMap).length > 0,
          loading: false, error: null,
        });
      })
      .catch((err) => {
        if (!cancelled)
          setState({ rawData: [], costMap: {}, categories: {}, hasCost: false, loading: false, error: String(err) });
      });

    return () => { cancelled = true; };
  }, [dateStr]);

  return state;
}
