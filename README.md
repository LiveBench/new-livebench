# LiveBench — redesigned site

A modernized React build of the LiveBench leaderboard (a challenging, contamination-free LLM benchmark). Same data + scoring as the original `livebench.github.io`, with a refreshed UI: a release timeline, KPI strip, an interactive table (sortable columns, click-to-expand subtask scores, inline filters), first-class cost columns, and SVG insight charts.

## Stack
React 18 (Create React App) · HashRouter · PapaParse · hand-built SVG charts (no chart dependency). Deploys to GitHub Pages via `gh-pages`.

## Data model (per release, in `public/`)
Each release date has its own files:
- `table_<YYYY_MM_DD>.csv` — one row per model, one column per subtask (scores 0–100). **Scores only** — overall + category averages are computed in-app from `categories`.
- `categories_<YYYY_MM_DD>.json` — maps each category to its subtask columns.
- `cost_<YYYY_MM_DD>.csv` *(optional)* — `model, avg_input_tokens, avg_output_tokens, cost_per_question`. **If absent, all cost columns and cost charts are hidden** for that release.

To add a release (e.g. `2026-06-25`): drop the three `*_2026_06_25.*` files in `public/` and add `"2026-06-25"` to `RELEASES` in `src/lib/constants.js`. No other code change.

`$/1M output`, the value/frontier badge, and overall scores are all derived client-side — never stored.

## Architecture
- `src/lib/useLeaderboardData.js` — loads the 3 files for the selected date (cost is tolerant of 404 → `hasCost:false`).
- `src/lib/compute.js` — canonical metrics: `overallOf` (wraps the original `Averaging.js`), `valueFrontier` (Pareto, drives the Best-value badge), `perMillionOut`, `collapseVariants`.
- `src/Table/{Averaging,modelLinks}.js` — reused unchanged from the original site (score math + model metadata/variants).
- `src/components/` — `Navbar`, `ReleaseTimeline`, `MetricsStrip`, `Leaderboard`, and `insights/{CostQualityScatter,CostBars,CategoryRadar,Insights}`.

## Develop
```bash
npm install        # node_modules is gitignored; first checkout needs this
npm start          # http://localhost:3000
```

## Test
```bash
npm test               # Jest unit (compute) + integration (App renders with mocked data)
npm run check-data     # asserts model keys join across table/cost/modelLinks for every release
npm run build          # production build gate
```

## Deploy (GitHub Pages)
```bash
npm run deploy         # builds and pushes build/ to the gh-pages branch
```
The deploy script intentionally has **no `--cname`** so it can't accidentally take over `livebench.ai`. For a preview, set `"homepage"` in `package.json` to `https://<user>.github.io/<repo>`. To publish to the production domain, add `--cname livebench.ai` back to the `deploy` script (and keep `homepage: "."`).

Sponsored by Abacus.AI. Site originally based on the [Nerfies](https://github.com/nerfies/nerfies.github.io) template and [LiveCodeBench](https://livecodebench.github.io/).
