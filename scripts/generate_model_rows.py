#!/usr/bin/env python3
"""Generate the leaderboard `table_<release>.csv` and `cost_<release>.csv` rows for
one model, directly from the livebench-private eval data. Produces the exact
combined-column format the website consumes (task columns + nq_* + avg tokens + prices).

Methodology (validated to reproduce existing rows exactly):
  score[col]  = mean(judgment.score for the model over valid question_ids in the
                mapped task dirs) * 100, rounded to 3 decimals.
  cost[col]   = sum over answers of the per-answer cost, computed purely from token
                counts x config pricing (the provider-reported cost_usd is NOT used —
                it is inconsistent across providers): uncached_in*input + cache_read*cached
                + output*output, plus cache_write*cache_write_price for models that report
                cache_creation (Anthropic), excluding runaway answers at the 250-call step cap.
  nq_col      = number of scored (judged) questions for the column.
  avg_*_tokens= mean input/output tokens per question over answers with valid token
                data (excludes $ERROR$ / -1 answers), on the active 1198+72 basis.
  out_<col>   = mean output tokens for that subcategory (same basis) — for per-
                subcategory token charts.
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

# category -> subcategory columns (for the overall score used by cost_per_successful_task)
CATEGORIES = {
    'math': ['AMPS_Hard', 'integrals_with_game', 'math_comp', 'olympiad'],
    'coding': ['code_completion', 'code_generation'],
    'data_analysis': ['consecutive_events', 'tablejoin', 'tablereformat'],
    'instruction_following': ['paraphrase', 'simplify', 'story_generation', 'summarize'],
    'language': ['connections', 'plot_unscrambling', 'typos'],
    'reasoning': ['logic_with_navigation', 'spatial', 'theory_of_mind', 'zebra_puzzle'],
    'agentic_coding': ['python', 'javascript', 'typescript'],
}


def _overall_score(score):
    """Global average = mean of the 7 category averages (matches the site)."""
    cats = [sum(score[c] for c in cols) / len(cols) for cols in CATEGORIES.values()]
    return sum(cats) / len(cats)


def load_price(model):
    """(input, cached, output, cache_write) USD/1M from the LiveBench config, or None.
    Missing cached / cache_write default to the standard 0.1x / 1.25x of input."""
    try:
        from livebench.model import get_model_config
        cpm = getattr(get_model_config(model), 'cost_per_million', None)
        if cpm:
            ip = float(cpm.get('input', 0)); op = float(cpm.get('output', 0))
            return ip, float(cpm.get('cached_input', ip * 0.1)), op, float(cpm.get('cache_creation', ip * 1.25))
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


RUNAWAY_CALLS = 250  # agent step cap; answers that hit it thrash the prompt cache
                     # (cache-write >> cache-read), so their cache-writes are excluded.


def _answer_cost(a, in_price, cached_price, out_price, cache_write_price, charge_cache_write):
    """Per-answer cost from token counts x config pricing (uniform across providers).

    cost = uncached_input*input + cache_read*cached + output*output. total_input_tokens
    follows two conventions (auto-detected per answer): Anthropic-native reports it
    EXCLUSIVE of cache reads (cache_read can exceed input); OpenAI/xAI (and some Anthropic
    runs) report it INCLUSIVE. For models that report cache_creation
    (Anthropic), cache-write is added at cache_write_price -- EXCEPT on runaway answers
    that hit the RUNAWAY_CALLS step cap, whose caching thrashed (re-writing the context
    every call); those cache-writes are excluded as harness artifacts.
    The provider-reported cost_usd is deliberately NOT used: it is inconsistent across
    providers (undiscounted cache reads, $0 records, differing cache accounting).
    """
    ti = max(0, a.get('total_input_tokens', 0) or 0)   # clamp $ERROR$/-1 sentinels to 0
    to = max(0, a.get('total_output_tokens', 0) or 0)
    cr = max(0, a.get('total_cached_tokens', 0) or 0)
    cc = max(0, a.get('total_cache_creation_tokens', 0) or 0)
    ncalls = a.get('n_model_calls') or 0
    # total_input_tokens uses one of two conventions, auto-detected per answer:
    #  EXCLUSIVE (Anthropic native, e.g. opus-4-8): input = uncached only; cache_read is
    #    reported separately and typically exceeds input (cr > ti)  ->  uncached = input.
    #  INCLUSIVE (OpenAI/xAI, and some Anthropic runs e.g. opus-4-5): input already
    #    includes cache_read (+ cache_creation)  ->  uncached = input - cache_read - cache_creation.
    # cache_read (cr) is always billed at cached_price; cache_creation (cc) is billed
    # separately below (Anthropic), so it must not remain inside uncached either way.
    uncached = ti if cr > ti else max(0, ti - cr - cc)
    cost = (uncached*in_price + cr*cached_price + to*out_price) / 1e6
    if charge_cache_write and cc and ncalls < RUNAWAY_CALLS:
        cost += cc*cache_write_price / 1e6
    return cost


def generate(data_dir, model, in_price, cached_price, out_price, cache_write_price):
    charge_cache_write = is_anthropic(model)
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

    score, cost, nq, out = {}, {}, {}, {}
    tin = tout = nans = 0
    for col, dirs in COLS.items():
        sc, c = [], 0.0
        col_out = col_n = 0
        for cat, task in dirs:
            valid = qids(cat, task)
            judged_qids, judged_aids = set(), set()   # questions scored, and the scored answer_ids
            for r in judgments(cat, task):
                m = r.get('model')
                if isinstance(m, str) and m.lower() == model.lower() and r.get('score', -1) != -1 and r.get('question_id') in valid:
                    sc.append(r['score'])
                    judged_qids.add(r['question_id'])
                    if r.get('answer_id'):
                        judged_aids.add(r['answer_id'])
            # Count cost/tokens for exactly ONE answer per scored question. Answer files
            # can hold re-runs (duplicate question_ids, different answer_id) and un-scored
            # error retries; summing all of them over-counts cost. Per question, prefer the
            # answer whose answer_id was judged; if none matches (e.g. answer_id drift after
            # a re-judgment), fall back to the latest answer for that question. Restricting
            # to judged questions keeps the cost numerator aligned with the nq denominator.
            chosen = {}
            for a in answers(cat, task):
                q = a.get('question_id')
                if q not in judged_qids:
                    continue
                cur = chosen.get(q)
                if cur is None or a.get('answer_id') in judged_aids or cur.get('answer_id') not in judged_aids:
                    chosen[q] = a
            for a in chosen.values():
                c += _answer_cost(a, in_price, cached_price, out_price, cache_write_price, charge_cache_write)
                o = a.get('total_output_tokens')
                i = a.get('total_input_tokens')
                if o is not None and o >= 0:   # exclude $ERROR$ / -1 sentinel from token stats
                    col_out += o; col_n += 1
                    tout += o; nans += 1
                    if i is not None and i >= 0:
                        tin += i
        score[col] = round(100*sum(sc)/len(sc), 3) if sc else None
        cost[col] = round(c, 4)
        nq[col] = len(sc)
        out[col] = round(col_out/col_n) if col_n else 0   # avg output tokens for this subcategory
    avg_in = round(tin/nans) if nans else 0
    avg_out = round(tout/nans) if nans else 0
    return score, cost, nq, avg_in, avg_out, out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--model', required=True, help='answer/judgment model_id (data source)')
    ap.add_argument('--display-name', help='name to write in the CSV row (default: --model)')
    ap.add_argument('--data', required=True, help='path to livebench-private/data/live_bench')
    ap.add_argument('--input-price', type=float, help='USD/1M input (else read from config)')
    ap.add_argument('--output-price', type=float, help='USD/1M output (else read from config)')
    ap.add_argument('--verify', metavar='PUBLIC_DIR', help='compare against table/cost CSVs in this dir')
    args = ap.parse_args()

    if args.input_price is not None and args.output_price is not None:
        in_price, out_price = args.input_price, args.output_price
        cached_price, cache_write_price = in_price * 0.1, in_price * 1.25
    else:
        cfg = load_price(args.model)
        if cfg is None:
            sys.exit('No pricing: pass --input-price/--output-price or ensure the model config is importable.')
        in_price, cached_price, out_price, cache_write_price = cfg
    name = args.display_name or args.model

    score, cost, nq, avg_in, avg_out, out = generate(args.data, args.model, in_price, cached_price, out_price, cache_write_price)

    # overall $/question and cost per successful task (= $/Q ÷ score × 100)
    cpq = sum(cost.values()) / sum(nq.values()) if sum(nq.values()) else 0
    osc = _overall_score(score)
    cpst = cpq / osc * 100 if osc else 0

    table_row = [name] + [str(score[c]) for c in COLORDER]
    # cost row: task costs, nq_*, summary tokens/prices, per-subcategory avg output (out_*),
    # then overall cost_per_question and cost_per_successful_task.
    cost_row = ([name] + [str(cost[c]) for c in COLORDER] + [str(nq[c]) for c in COLORDER]
                + [str(avg_in), str(avg_out), _num(in_price), _num(out_price)]
                + [str(out[c]) for c in COLORDER]
                + [f'{cpq:.4f}', f'{cpst:.4f}'])

    if args.verify:
        _verify(args.verify, name, score, cost, nq, avg_out, out, cpq, cpst)
        return
    print('# table row (append to table_<release>.csv):')
    print(','.join(table_row))
    print('\n# cost row (append to cost_<release>.csv):')
    print(','.join(cost_row))


def _num(x):
    return str(int(x)) if float(x).is_integer() else str(x)


def _verify(public_dir, name, score, cost, nq, avg_out, out, cpq, cpst):
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
        if 'out_' + col in c[name] and c[name]['out_' + col] != '' and int(out[col]) != int(float(c[name]['out_' + col])):
            ok = False
            print(f'  MISMATCH out_{col}: gen={out[col]} csv={c[name]["out_" + col]}')
    if c[name].get('avg_output_tokens') and int(avg_out) != int(float(c[name]['avg_output_tokens'])):
        ok = False
        print(f'  MISMATCH avg_output_tokens: gen={avg_out} csv={c[name]["avg_output_tokens"]}')
    for label, gen in (('cost_per_question', cpq), ('cost_per_successful_task', cpst)):
        ref = c[name].get(label)
        if ref not in (None, '') and abs(gen - float(ref)) > 0.01:
            ok = False
            print(f'  MISMATCH {label}: gen={gen:.4f} csv={ref}')
    print('VERIFY: all columns match' if ok else 'VERIFY: mismatches above')


if __name__ == '__main__':
    main()
