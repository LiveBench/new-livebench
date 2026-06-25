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

**Cost is stored raw, per subtask — exactly like scores.** `cost_<date>.csv` has the same subtask columns as `table_<date>.csv` (one **$/question per (model, subtask)**), so the browser derives per-category and overall cost with the *same* `Averaging.js` it uses for scores. Columns:
`model, <subtask_1>, …, <subtask_N>, avg_input_tokens, avg_output_tokens, input_price_per_million, output_price_per_million`

- Each `<subtask>` cell = the model's mean cost per question on that subtask.
- **`$/task`** is **scope-aware**: it shows the cost at the selected scope — a subtask cell, a category (mean of its subtask costs), or overall (mean of category costs) — tracking whichever score column/category you select or sort by.
- **`$/quality`** = scoped `$/task ÷ scoped score` (cost per LiveBench point); lower is better value. Also scope-aware. The **Value** pill marks the per-scope Pareto frontier (cheapest model at each new score ceiling).
- `avg_input_tokens` / `avg_output_tokens` / `input_price_per_million` / `output_price_per_million` — model-level, for tooltips/reference (not score columns).
- Per-question cost = the runner's recorded `cost_usd` when it's a real (>0) cache-aware value, else billed tokens × the official per-million rates (`(uncached·input + cached·cached_input + output·output)/1e6`). Generate/refresh a release's file with `scripts/gen_cost_row.py --like-table public/table_<date>.csv` (in the `livebench-private` repo).
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
npm run deploy         # build + push to the gh-pages branch (serves at https://livebench.ai/new-livebench/)
```

Deploys to GitHub Pages from the `gh-pages` branch. `homepage` in `package.json` is `"."` (relative paths) for serving at the custom domain root; change the `--cname` in the `deploy` script to target a different domain.
