# new-livebench

A modern React leaderboard for LiveBench — a contamination-free LLM benchmark. Per-release scores across 7 categories with subtask drill-down, cost-vs-quality insights, and a release timeline. React 18 (CRA) · hand-built SVG charts (no chart dependency) · deploys to GitHub Pages.

## How data is stored

All data lives in `public/`, **one set of files per release** (named by date, `YYYY_MM_DD`):

| File | Holds | Required |
|---|---|---|
| `table_<date>.csv` | one row per model, one column per subtask — raw score 0–100 | ✅ |
| `categories_<date>.json` | maps each category → its subtask columns | ✅ |
| `cost_<date>.csv` | per-model cost + pricing (see below) | optional |

**Scores are stored raw, per subtask.** Overall and per-category averages are **computed in the browser** (`src/lib/compute.js`, reusing `src/Table/Averaging.js`) — they are never stored in the CSV.

**Cost — stored per subtask, aggregated question-weighted.** `cost_<date>.csv` stores, for each (model, subtask), the **total cost** (the subtask column, same names as `table_<date>.csv`) and the **question count** (`nq_<subtask>`). Columns:
`model, <subtask total cost ...>, nq_<subtask> ..., avg_input_tokens, avg_output_tokens, input_price_per_million, output_price_per_million`

- **`$/Q`** (cost per question) is **scope-aware** and **question-weighted**: `(Σ total cost) / (Σ nq)` over the subtasks in the selected scope. So overall = total run cost ÷ total questions; a focused category = its total ÷ its question count; a subtask = its total ÷ its count. It is **not** the mean of the per-category `$/Q` values — a small-but-pricey suite like Agentic Coding is weighted by its question count, not 1/7.
- **`$/quality`** = scoped `$/Q ÷ scoped score` (cost per LiveBench point); lower is better value. The **Value** pill marks the per-scope Pareto frontier (cheapest model at each new score ceiling).
- `avg_*_tokens` / `*_price_per_million` — model-level, for tooltips/reference (not score columns).
- Per-question cost = the runner's recorded `cost_usd` when it's a real (>0) cache-aware value, else billed tokens × the official per-million rates (`(uncached·input + cached·cached_input + output·output)/1e6`). One answer per (task, question) is kept (latest run), matching the scorer. Generate/refresh with `scripts/gen_cost_row.py --like-table public/table_<date>.csv` (in the `livebench-private` repo).
- If a release has **no** `cost_<date>.csv`, all cost columns and cost charts hide for it (cost is opt-in per release).

**Model metadata** (display name, org, reasoner/open-weight flags, effort-variant grouping) comes from `src/Table/modelLinks.js`, keyed by the `model` string. A model not listed there is hidden.

## How to add a release

1. Drop `table_<date>.csv`, `categories_<date>.json`, and (optionally) `cost_<date>.csv` into `public/`.
2. Add the date to `RELEASES` in `src/lib/constants.js` (last entry = latest, shown by default).
3. Ensure every `model` value has an entry in `src/Table/modelLinks.js`.

No other code changes. Run `npm run check-data` to confirm the `model` keys line up across `table` ↔ `cost` ↔ `modelLinks` for every release.

## Develop, test, deploy

```bash
npm install            # node_modules is gitignored
npm start              # dev server at http://localhost:3000
npm test               # unit (compute) + render tests
npm run check-data     # model-key integrity across all releases
npm run build          # production build
npm run deploy         # publish livebench.ai (runs the LiveBench/livebench-agents deploy Action; needs `gh` logged in)
```

**livebench.ai is the LiveBench 2.0 site** from [LiveBench/livebench-agents](https://github.com/LiveBench/livebench-agents). It shows the v1 releases on its timeline, copied from `main` here on every deploy. So the v1 data flow is unchanged: update the data here, merge to `main`, then run `npm run deploy` (or the livebench-agents Actions tab → *Deploy to livebench.ai* → **Run workflow**). Without that, its daily run picks up the new `main` within a day.

Both sites are published to the `gh-pages` branch of this repo, which GitHub Pages serves as livebench.ai. LiveBench 2.0 goes to the root and to `v2/`.

**Rollback to the v1 app at the root:** `npm run deploy-v1-root` (the old deploy). It builds this repo, replaces every root file except `v2/` (`--remove '{!(v2)/**,*}'`), and keeps https://livebench.ai/v2/. The livebench-agents daily run would put 2.0 back at the root, so disable that workflow first if the rollback should stick.
