import React from "react";
import CostQualityScatter from "./CostQualityScatter";
import CostBars from "./CostBars";
import CategoryRadar from "./CategoryRadar";

export default function Insights({ models, categories, hasCost }) {
  const ncats = Object.keys(categories).length;
  return (
    <section className="lb-section" id="lb-insights">
      <div className="lb-wrap">
        <div className="lb-sec-head"><span className="lb-sec-no">02</span><h2>Insights</h2></div>
        <p className="lb-sec-sub">
          {hasCost
            ? "A few analytical views — the headline is cost vs. quality, because a score alone doesn't tell you whether a model is worth it."
            : "Capability views for this release. Cost-based charts appear on releases that publish cost data."}
        </p>
        {hasCost && (
          <div className="lb-ins-grid">
            <div className="lb-card"><CostQualityScatter models={models} /></div>
            <div className="lb-card">
              <h3>Cost, ranked</h3>
              <p className="ch-sub">Cost per question, cheapest first. Hover for $/1M output and verbosity.</p>
              <CostBars models={models} />
            </div>
          </div>
        )}
        <div className="lb-card" style={{ marginTop: hasCost ? 18 : 0 }}>
          <h3>Category profile</h3>
          <p className="ch-sub">Add any 2–3 models to compare across the {ncats} categories.</p>
          <CategoryRadar models={models} categories={categories} />
        </div>
      </div>
    </section>
  );
}
