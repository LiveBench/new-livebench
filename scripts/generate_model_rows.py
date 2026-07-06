#!/usr/bin/env python3
"""Generate the leaderboard `table_<release>.csv` and `cost_<release>.csv` rows for
one model, directly from the livebench-private eval data. Produces the exact
combined-column format the website consumes (task columns + nq_* + avg tokens + prices).

Methodology (validated to reproduce existing rows exactly):
  score[col]  = mean(judgment.score for the model over valid question_ids in the
                mapped task dirs) * 100, rounded to 3 decimals.
  cost[col]   = sum over answers of the per-answer cost (see _answer_cost):
                  - provider cost_usd when present (+ cache-read at 0.1x input for
                    CACHE_READ_OMITTED models whose cost_usd charged $0 for reads),
                  - else spend_report's token fallback: uncached*IN + cached*0.1*IN + out*OUT.
                  Cache-WRITE (cache_creation) tokens are never charged.
  nq_col      = number of scored (judged) questions for the column.
  avg_*_tokens= mean input/output tokens across the model's answers.
  prices      = cost_per_million.input / .output from the model config.

Pricing comes from the LiveBench model config (same source as scripts/spend_report.py);
override with --input-price/--output-price when the config isn't importable.

Examples:
  # Opus 4.8 (agentic v2 refreshed from its own answers)
  python scripts/generate_model_rows.py --model claude-opus-4-8-xhigh-effort \
      --data ~/livebench/livebench-private/data/live_bench

  # Fable 5 published under a canonical name but sourced from the rerun data
  python scripts/generate_model_rows.py --model claude-fable-5-xhigh-effort-rerun \
      --display-name claude-fable-5-xhigh-effort \
      --data ~/livebench/livebench-private/data/live_bench

  # Verify the generator reproduces an existing row
  python scripts/generate_model_rows.py --model claude-opus-4-7-xhigh-effort \
      --data ~/livebench/livebench-private/data/live_bench \
      --verify ../public
"""
import argparse, csv, glob, json, os, sys

# column -> [(category, task), ...]  (agentic uses the v2 task set)
COLS = {
 'AMPS_Hard': [('math','AMPS_Hard'),('math','AMPS_Hard_2')],
 'code_completion': [('coding','code_completion'),('coding','coding_completion'),('coding','coding_completion_2')],
 'code_generation': [('coding','code_generation'),('coding','LCB_generation'),('coding','LCB_generation_2')],
 'connections': [('language','connections'),('language','connections_2'),('language','connections_3')],
 'consecutive_events': [('data_analysis','consecutive_events'),('data_analysis','cta')],
 'integrals_with_game': [('math','integrals_with_game')],
 'javascript': [('agentic_coding_v2','javascript')],
 'logic_with_navigation': [('reasoning','logic_with_navigation')],
 'math_comp': [('math','math_comp'),('math','math_comp_2'),('math','math_comp_3'),('math','math_comp_4')],
 'olympiad': [('math','olympiad'),('math','olympiad_2'),('math','olympiad_3')],
 'paraphrase': [('instruction_following','paraphrase'),('instruction_following','paraphrase_2'),('instruction_following','paraphrase_3')],
 'plot_unscrambling': [('language','plot_unscrambling'),('language','plot_unscrambling_2')],
 'python': [('agentic_coding_v2','python')],
 'simplify': [('instruction_following','simplify'),('instruction_following','simplify_2'),('instruction_following','simplify_3')],
 'spatial': [('reasoning','spatial')],
 'story_generation': [('instruction_following','story_generation'),('instruction_following','story_generation_2'),('instruction_following','story_generation_3')],
 'summarize': [('instruction_following','summarize'),('instruction_following','summarize_2'),('instruction_following','summarize_3')],
 'tablejoin': [('data_analysis','tablejoin'),('data_analysis','tablejoin_2')],
 'tablereformat': [('data_analysis','tablereformat'),('data_analysis','tablereformat_2')],
 'theory_of_mind': [('reasoning','theory_of_mind')],
 'typescript': [('agentic_coding_v2','typescript')],
 'typos': [('language','typos'),('language','typos_2')],
 'zebra_puzzle': [('reasoning','zebra_puzzle'),('reasoning','zebra_puzzle_2'),('reasoning','zebra_puzzle_3')],
}
COLORDER = list(COLS.keys())


def load_price(model):
    """(input, output) USD/1M from the LiveBench config, or None if unavailable."""
    try:
        from livebench.model import get_model_config
        cpm = getattr(get_model_config(model), 'cost_per_million', None)
        if cpm:
            return float(cpm.get('input', 0)), float(cpm.get('output', 0))
    except Exception:
        pass
    return None


def _read(path):
    return [json.loads(l) for l in open(path)] if os.path.exists(path) else []


def is_anthropic(model):
    try:
        from livebench.model import get_model_config
        an = getattr(get_model_config(model), 'api_name', {})
        return 'anthropic' in (an if isinstance(an, dict) else {})
    except Exception:
        return model.startswith('claude')


# Anthropic models whose recorded cost_usd omitted cache reads: they had no
# cost_per_million in config at eval time, so cost_usd = input + output only
# ($0 for cache-read tokens) while every other model charges them. For these we
# add cache-read at 0.1x input so the leaderboard is priced consistently.
CACHE_READ_OMITTED = {
    'claude-opus-4-5-20251101-thinking-64k-high-effort',
    'claude-opus-4-6-thinking-auto-high-effort',
    'claude-opus-4-7-xhigh-effort',
    'claude-opus-4-8-xhigh-effort',
    'claude-sonnet-4-6-thinking-auto-medium-effort',
}


def _answer_cost(a, in_price, out_price, cached_price, add_cache_read):
    """Per-answer cost, matching scripts/spend_report.py + cache-read consistency.

    Use the provider-reported cost_usd when present. Two adjustments:
    - CACHE-READS: for models in CACHE_READ_OMITTED (whose cost_usd charged $0 for
      cache reads), add cache-read at 0.1x input so all models are consistent.
    - CACHE-WRITES are never charged: only Anthropic reports cache_creation
      tokens, they're inflated by cache-miss thrash on runaway agentic runs, and
      the provider cost_usd excludes them. See spend_report.py.
    Fallback when cost_usd is absent uses spend_report's split (cached is a
    subset of input): cost = uncached*in + cached*cached_price + output*out.
    """
    ti = a.get('total_input_tokens', 0) or 0
    to = a.get('total_output_tokens', 0) or 0
    cr = a.get('total_cached_tokens', 0) or 0
    cu = a.get('cost_usd')
    if cu is not None:
        return cu + (cr*in_price*0.1 / 1e6 if add_cache_read else 0.0)
    cached = min(cr, ti)
    uncached = ti - cached
    return (uncached*in_price + cached*cached_price + to*out_price) / 1e6


def generate(data_dir, model, in_price, out_price, cached_price=None):
    # cache-read price for the cost_usd-absent fallback; defaults to 0.1x input
    # (the Anthropic/OpenAI standard). Pass explicitly to match a provider's rate.
    if cached_price is None:
        cached_price = in_price * 0.1
    add_cache_read = model in CACHE_READ_OMITTED
    def qids(cat, task):
        # Active questions only, matching scripts/spend_report.py active_ids:
        # a question is active iff its livebench_removal_date is empty. The task
        # question.jsonl files retain deprecated questions (removal_date set), so
        # this filter is required to hit the canonical 1198 regular + 72 agentic.
        return {q['question_id'] for q in _read(f'{data_dir}/{cat}/{task}/question.jsonl')
                if q.get('livebench_removal_date', '') == ''}
    def judgments(cat, task):
        return _read(f'{data_dir}/{cat}/{task}/model_judgment/ground_truth_judgment.jsonl')
    def answers(cat, task):
        return _read(f'{data_dir}/{cat}/{task}/model_answer/{model}.jsonl')

    score, cost, nq = {}, {}, {}
    tin = tout = nans = 0
    for col, dirs in COLS.items():
        sc, c = [], 0.0
        for cat, task in dirs:
            valid = qids(cat, task)
            for r in judgments(cat, task):
                m = r.get('model')
                if isinstance(m, str) and m.lower() == model.lower() and r.get('score', -1) != -1 and r.get('question_id') in valid:
                    sc.append(r['score'])
            for a in answers(cat, task):
                if a.get('question_id') not in valid:
                    continue
                c += _answer_cost(a, in_price, out_price, cached_price, add_cache_read)
                to = a.get('total_output_tokens', 0) or 0
                if to != -1:
                    tin += a.get('total_input_tokens', 0) or 0; tout += to; nans += 1
        score[col] = round(100*sum(sc)/len(sc), 3) if sc else None
        cost[col] = round(c, 4)
        nq[col] = len(sc)
    avg_in = round(tin/nans) if nans else 0
    avg_out = round(tout/nans) if nans else 0
    return score, cost, nq, avg_in, avg_out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--model', required=True, help='answer/judgment model_id (data source)')
    ap.add_argument('--display-name', help='name to write in the CSV row (default: --model)')
    ap.add_argument('--data', required=True, help='path to livebench-private/data/live_bench')
    ap.add_argument('--input-price', type=float, help='USD/1M input (else read from config)')
    ap.add_argument('--output-price', type=float, help='USD/1M output (else read from config)')
    ap.add_argument('--verify', metavar='PUBLIC_DIR', help='compare against table/cost CSVs in this dir')
    args = ap.parse_args()

    price = (args.input_price, args.output_price)
    if price[0] is None or price[1] is None:
        cfg = load_price(args.model)
        if cfg is None:
            sys.exit('No pricing: pass --input-price/--output-price or ensure the model config is importable.')
        price = cfg
    in_price, out_price = price
    name = args.display_name or args.model

    score, cost, nq, avg_in, avg_out = generate(args.data, args.model, in_price, out_price)

    table_row = [name] + [str(score[c]) for c in COLORDER]
    cost_row = ([name] + [str(cost[c]) for c in COLORDER] + [str(nq[c]) for c in COLORDER]
                + [str(avg_in), str(avg_out), _num(in_price), _num(out_price)])

    if args.verify:
        _verify(args.verify, name, score, cost, nq)
        return
    print('# table row (append to table_<release>.csv):')
    print(','.join(table_row))
    print('\n# cost row (append to cost_<release>.csv):')
    print(','.join(cost_row))


def _num(x):
    return str(int(x)) if float(x).is_integer() else str(x)


def _verify(public_dir, name, score, cost, nq):
    t = {r['model']: r for r in csv.DictReader(open(f'{public_dir}/table_2026_06_25.csv'))}
    c = {r['model']: r for r in csv.DictReader(open(f'{public_dir}/cost_2026_06_25.csv'))}
    if name not in t:
        sys.exit(f'{name} not in table CSV; cannot verify.')
    ok = True
    for col in COLORDER:
        for label, gen, ref in (('score', score[col], t[name][col]), ('cost', cost[col], c[name][col])):
            if abs(float(gen) - float(ref)) > 0.02:
                ok = False
                print(f'  MISMATCH {label} {col}: gen={gen} csv={ref}')
    print('VERIFY: all columns match' if ok else 'VERIFY: mismatches above')


if __name__ == '__main__':
    main()
