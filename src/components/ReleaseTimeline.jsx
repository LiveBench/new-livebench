import React from "react";

// Horizontal release timeline (replaces the old range slider). Clicking a dot
// re-scopes the whole page to that release.
export default function ReleaseTimeline({ releases, value, onChange }) {
  const idx = Math.max(0, releases.indexOf(value));
  const last = releases.length - 1;
  const pct = (i) => (last === 0 ? 0 : (i / last) * 100);
  return (
    <div className="lb-tl">
      <div className="lb-tl-head">
        <span className="lab">Release</span>
        <span className="date">{value}</span>
      </div>
      <div className="lb-rail">
        <div className="lb-rail-line" />
        <div className="lb-rail-prog" style={{ width: `${pct(idx)}%` }} />
        {releases.map((d, i) => (
          <button
            key={d}
            type="button"
            className={"lb-dot" + (i < idx ? " done" : "") + (i === idx ? " active" : "")}
            style={{ left: `${pct(i)}%` }}
            data-tip={d}
            aria-label={`Release ${d}`}
            aria-current={i === idx ? "true" : undefined}
            onClick={() => onChange(d)}
          />
        ))}
      </div>
      <div className="lb-tl-ends">
        <span>{releases[0]} · v1</span>
        <span>{releases[last]} · latest</span>
      </div>
    </div>
  );
}
