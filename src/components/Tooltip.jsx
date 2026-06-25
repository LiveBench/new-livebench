import React, { useEffect, useState } from "react";

// Single global tooltip: shows instantly on hover of any element with a
// `data-tip` attribute (native `title` has a ~1s browser delay we can't change).
export default function Tooltip() {
  const [tip, setTip] = useState(null);

  useEffect(() => {
    const owner = (el) => {
      while (el && el !== document.body) {
        if (el.dataset && el.dataset.tip) return el;
        el = el.parentElement;
      }
      return null;
    };
    const over = (e) => {
      const el = owner(e.target);
      if (el) setTip({ text: el.dataset.tip, x: e.clientX, y: e.clientY });
    };
    const out = (e) => { if (owner(e.target)) setTip(null); };
    const hide = () => setTip(null);

    document.addEventListener("mouseover", over);
    document.addEventListener("mouseout", out);
    window.addEventListener("scroll", hide, true);
    return () => {
      document.removeEventListener("mouseover", over);
      document.removeEventListener("mouseout", out);
      window.removeEventListener("scroll", hide, true);
    };
  }, []);

  if (!tip) return null;
  const left = Math.max(8, Math.min(tip.x + 14, window.innerWidth - 256));
  const top = Math.min(tip.y + 16, window.innerHeight - 80);
  return <div className="lb-tip lb-tip-global" style={{ position: "fixed", left, top }}>{tip.text}</div>;
}
