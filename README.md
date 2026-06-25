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

**Cost** — `cost_<date>.csv` columns:
`model, avg_input_tokens, avg_output_tokens, cost_per_question, input_price_per_million, output_price_per_million`

- `cost_per_question` → the **`$/Q`** column: measured $ to run the model over that release's tasks.
- `output_price_per_million` → the **`$/1M out`** column: the provider's **official list price**, read directly (`perMillionOut()` in `compute.js`) — not derived from tokens.
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
npm run deploy         # build + push to the gh-pages branch (CNAME: new.livebench.ai)
```

Deploys to GitHub Pages from the `gh-pages` branch. `homepage` in `package.json` is `"."` (relative paths) for serving at the custom domain root; change the `--cname` in the `deploy` script to target a different domain.
