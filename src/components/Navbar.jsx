import React from "react";

// Slim sticky nav shared by both routes. On home, Leaderboard/Insights smooth-scroll
// to the in-page sections; on /details they link back home.
export default function Navbar({ variant = "home" }) {
  const scrollTo = (id) => () => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };
  return (
    <nav className="lb-nav" aria-label="Primary">
      <div className="lb-nav-in">
        <a href="./#/" className="lb-brand"><span className="lb-pulse" />LiveBench <span className="tag">LIVE</span></a>
        <div className="lb-links">
          {variant === "home" ? (
            <>
              <button type="button" onClick={scrollTo("lb-leaderboard")}>Leaderboard</button>
              <button type="button" onClick={scrollTo("lb-insights")}>Insights</button>
            </>
          ) : (
            <a href="./#/">Leaderboard</a>
          )}
          <a href="./#/details">Details</a>
          <a href="https://arxiv.org/abs/2406.19314" target="_blank" rel="noreferrer">Paper</a>
          <a href="https://github.com/livebench/livebench" target="_blank" rel="noreferrer">Code ↗</a>
        </div>
      </div>
    </nav>
  );
}
