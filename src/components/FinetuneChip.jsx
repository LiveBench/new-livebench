import React from "react";

// Finetunes are hidden everywhere by default; this chip opts them back in.
// Shared by the leaderboard + insights so both read the same state (App owns it).
export default function FinetuneChip({ on, onToggle }) {
  return (
    <button className="lb-chip" aria-pressed={on} onClick={onToggle}
      data-tip="Also list models that are finetunes of another model (hidden by default)">
      Include finetunes
    </button>
  );
}
