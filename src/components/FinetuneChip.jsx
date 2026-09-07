import React from "react";

// Finetunes are hidden everywhere by default; this chip opts them back in (mode "all").
// A third mode, "only" (finetunes next to the base models they were trained from), is
// link-only for now: #/finetunes or ?ft=only — no control on the page yet.
// Shared by the leaderboard + insights so both read the same state (App owns it).
export default function FinetuneChip({ mode, onChange }) {
  const on = mode !== "hide";
  return (
    <button className="lb-chip" aria-pressed={on} onClick={() => onChange(on ? "hide" : "all")}
      data-tip="Also list models that are finetunes of another model (hidden by default)">
      Include finetunes
    </button>
  );
}
