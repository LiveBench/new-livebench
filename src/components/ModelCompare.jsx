import React, { useEffect, useMemo, useRef, useState } from "react";

// "Compare" chip + dropdown for filtering the table to a chosen set of models.
// Presentational only — the active set lives in Leaderboard; "Apply" commits the
// draft selection, outside-click / Escape close without applying.
export default function ModelCompare({ options, active, onApply }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => new Set());
  const [q, setQ] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  // (re)seed the draft from the committed set every time the panel opens
  const toggleOpen = () => {
    if (!open) { setDraft(new Set(active)); setQ(""); }
    setOpen((v) => !v);
  };
  const toggleModel = (id) =>
    setDraft((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const shown = useMemo(
    () => (q ? options.filter((o) => o.name.toLowerCase().includes(q) || o.model.toLowerCase().includes(q)) : options),
    [options, q]
  );
  const selectAll = () => setDraft((s) => { const n = new Set(s); shown.forEach((o) => n.add(o.model)); return n; });
  const clearAll = () => setDraft(new Set());
  const apply = () => { onApply(draft); setOpen(false); };

  return (
    <div className="lb-colpick" ref={ref}>
      <button className="lb-chip" aria-pressed={active.size > 0} aria-haspopup="true" aria-expanded={open}
        data-tip="Filter the table to a chosen set of models" onClick={toggleOpen}>
        Compare{active.size ? ` (${active.size})` : ""} <span className="lb-caret">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div className="lb-colpick-panel lb-cmp-panel" role="group" aria-label="Compare models">
          <div className="lb-colpick-head">
            <span className="lb-colpick-title">Compare models</span>
            <span className="lb-cmp-acts">
              <button className="lb-colpick-all" onClick={selectAll}>Select all</button>
              <button className="lb-colpick-all" onClick={clearAll} disabled={!draft.size}>Clear</button>
            </span>
          </div>
          <input className="lb-cmp-search" type="text" value={q} placeholder="Find a model…"
            aria-label="Find a model" onChange={(e) => setQ(e.target.value.toLowerCase())} />
          <div className="lb-cmp-list">
            {shown.map((o) => (
              <label className="lb-colpick-item" key={o.model}>
                <input type="checkbox" checked={draft.has(o.model)} onChange={() => toggleModel(o.model)} />
                <span>{o.name}</span>
              </label>
            ))}
            {!shown.length && <div className="lb-cmp-empty">No models match</div>}
          </div>
          <div className="lb-cmp-foot">
            <span className="lb-cmp-n">{draft.size ? `${draft.size} selected` : "All models shown"}</span>
            <button className="lb-cmp-apply" onClick={apply}>Apply</button>
          </div>
        </div>
      )}
    </div>
  );
}
