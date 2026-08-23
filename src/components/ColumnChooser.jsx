import React, { useEffect, useRef, useState } from "react";

// "Choose columns" chip + dropdown for toggling table column visibility.
// Presentational only — the hidden set lives in Leaderboard, which filters its columns.
export default function ColumnChooser({ groups, hidden, onToggle, onReset }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const nShown = groups.filter((g) => !hidden.has(g.key)).length;
  const partial = nShown < groups.length;
  return (
    <div className="lb-colpick" ref={ref}>
      <button className="lb-chip" aria-pressed={open} aria-haspopup="true" aria-expanded={open}
        data-tip="Show or hide table columns" onClick={() => setOpen((v) => !v)}>
        Choose columns{partial ? ` (${nShown}/${groups.length})` : ""} <span className="lb-caret">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div className="lb-colpick-panel" role="group" aria-label="Table columns">
          <div className="lb-colpick-head">
            <span className="lb-colpick-title">Columns</span>
            <button className="lb-colpick-all" onClick={onReset} disabled={!partial}>Show all</button>
          </div>
          {groups.map((g) => (
            <label className="lb-colpick-item" key={g.key}>
              <input type="checkbox" checked={!hidden.has(g.key)} onChange={() => onToggle(g.key)} />
              <span>{g.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
