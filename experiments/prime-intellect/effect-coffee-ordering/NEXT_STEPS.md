# Beanline Prime Intellect Next Steps

This is the short handoff for the next Beanline training iteration. The longer
decision log is `docs/beanline-prime-intellect-flight-log.md`.

## Plain Goal

Beanline should act like a careful coffee-shop cashier: take one valid drink
order, ask a short question when the request is unclear, suggest valid options
when something is unavailable, and give a compact receipt with the right price.

## Current Champion

| Field | Value |
| --- | --- |
| Adapter | `rqvfrcdy4xt95oka37b0xjyu` |
| Deployed model string | `Qwen/Qwen3.5-0.8B:rqvfrcdy4xt95oka37b0xjyu` |
| Hard eval environment | `kevinmichaelchen/effect-coffee-ordering@0.1.5`, `split=hard_eval` |
| Reward | `0.830` |
| Tool correctness | `0.984` |
| Price format | `0.625` |
| Receipt style | `0.866` |

Main remaining weakness: successful final confirmations are sometimes too
verbose or use bad price formatting.

Hosted Training warm-start note: use checkpoint
`oo8lrytspz37lfsdlloubig7`. The final champion adapter
`rqvfrcdy4xt95oka37b0xjyu` is deployable for inference/eval, but the current
Prime CLI rejects it as a `checkpoint_id` for new training runs.

## Receipt Run

Use the small budget-capped receipt-drill warmup only after fresh baselines on
`kevinmichaelchen/effect-coffee-ordering@0.1.20` once published. Version
`0.1.20` should be used for the next baseline because it contains the PR 47
hardening, prompt-only receipt/direct-tool-path tightening, order-first tool
presentation, confirmation-before-purchase policy, aligned product-readiness
scoring, the dedicated `confirmation_first` split, and purchase-tool rejection
when the model omits the required confirmation token. It also exposes
`get_pending_confirmation` so later-turn "yes" responses can fetch current
pending state instead of guessing.

```sh
cd experiments/prime-intellect/effect-coffee-ordering
prime --plain train configs/rl/effect-coffee-ordering-qwen-0.8b-receipt-drill-warmup.toml --yes
```

## Product-Readiness Status

The process now has a broader `product_readiness` split and matching SFT corpora
for:

- multi-item/cart requests using cart tools,
- substitutions and unavailable ingredients,
- ambiguous orders that need clarification,
- modifier edge cases,
- pickup timing, customer name, and order notes,
- pre-purchase confirmation before real-money order submission,
- concise refusal behavior.

Environment source version `0.1.20` adds a dedicated `confirmation_first` split
and a `get_pending_confirmation` tool. `place_order`/`checkout_cart` now reject
calls unless the confirmation token matches the pending confirmation. Publish it
before the next hosted baselines, evals, or training. It changes the intended
product behavior: Beanline should prepare a pending confirmation, read back the
interpreted order, and ask for confirmation before calling `place_order` or
`checkout_cart`. For later-turn confirmation, Beanline should fetch pending
state first. The product-readiness and confirmation-first splits reward this
path instead of one-shot purchase on initial order requests.
Product-readiness is still blocked by Prime inference 503 errors.

Do not rerun `effect-coffee-ordering-qwen-0.8b-product-readiness-warmup.toml`
until the receipt drill or a prompt/SFT pass improves direct order behavior.
Run `e2s3bs35k9qwzlfbrfw0ol51` was stopped after its first interval
eval because it failed the promotion gate:

| Step | Hard eval Avg@2 | Hard mean completion length | Product-readiness Avg@2 | Product mean completion length |
| ---: | ---: | ---: | ---: | ---: |
| `32` | `0.7545` | `620.5625` | `0.7545` | `629.25` |

Cost was `$0.1226`; no adapter was promoted.

Recent baseline evals on the expanded tool surface:

| Model | Env | Split | Reward | Tool correctness | Price format | Note |
| --- | --- | --- | ---: | ---: | ---: | --- |
| Champion `rqvfrcdy4xt95oka37b0xjyu` | `0.1.11` | `hard_eval` | `0.520` | `0.625` | `0.375` | Too much menu/options probing; bad final prices on successful orders. |
| Champion `rqvfrcdy4xt95oka37b0xjyu` | `0.1.13` | `hard_eval` | `0.507` API / `0.508` logs | `0.531` | `0.438` | Prompt-only receipt tightening improved price format but hurt overall reward. |
| Champion `rqvfrcdy4xt95oka37b0xjyu` | `0.1.14` | `hard_eval` | `0.592` API / `0.564` logs | `0.625` | `0.500` | Order-first tool presentation helped hard eval; product-readiness still needs a scored run. |
| Raw `Qwen/Qwen3.5-2B` | `0.1.11` | `hard_eval` | `0.783` | `0.812` | `0.812` | Better receipt priors, still below champion gate and weaker tool discipline. |

These results mean `0.1.14` is a meaningful hard-eval improvement over the
expanded-tool baseline, but it is not promotion ready.

Receipt-drill warmup on `0.1.11` was attempted and stopped early:

| Run | Latest step | Cost | Best observed training signal | Decision |
| --- | ---: | ---: | --- | --- |
| `w402wq3sb943xintnex94sga` | `36` | `$0.36` | step `34`: reward `0.715`, tool correctness `1.000`, price format `0.400`; step `35`: reward `0.683`, price format `0.273` | Do not promote. |

READY adapter/checkpoint from this run:

- Adapter `h3g7ts9xw0antutgxb5c8sue` at step `30`
- Checkpoint `lkltzsp29ckjbs9fl83x9gb5` at step `30`

The failure is still final receipt formatting and tool overuse. Rollouts showed
correct order fields but wrong final currency/amount style such as `₹520`
instead of `$5.20`, plus repeated menu/option probes.

Next best action is not another unchanged RL run. Publish and retry
product-readiness plus `confirmation_first` on `0.1.20` once Prime inference is
stable, then use SFT on the final-response and tool-trajectory corpora so 0.8B
learns quote/readback/confirmation before purchase.

Before any new hosted training spend, run fresh hosted baselines on
`kevinmichaelchen/effect-coffee-ordering@0.1.20` once published; the warmup
configs now pin that version and include the `confirmation_first` eval.

Inspect the stopped run:

```sh
prime --plain train list --mine --output json
prime --plain train progress <run_id>
prime --plain train metrics <run_id>
prime --plain train checkpoints <run_id> --status READY --output json
prime --plain train usage <run_id>
```

## Compare Against The Champion

The training config already evaluates candidate checkpoints on
`split=hard_eval`. The product-readiness config also evaluates
`split=product_readiness`. Use those metrics first. If a checkpoint looks
promising, deploy that adapter and run external evals with explicit environment
args:

```sh
prime --plain deployments create <candidate_adapter_id> --yes

prime --plain eval run kevinmichaelchen/effect-coffee-ordering \
  --hosted \
  --model Qwen/Qwen3.5-0.8B:<candidate_adapter_id> \
  --env-args '{"split":"hard_eval"}' \
  --num-examples 8 \
  --rollouts-per-example 2 \
  --max-tokens 256 \
  --temperature 0.4

prime --plain eval run kevinmichaelchen/effect-coffee-ordering \
  --hosted \
  --model Qwen/Qwen3.5-0.8B:<candidate_adapter_id> \
  --env-args '{"split":"product_readiness"}' \
  --num-examples 16 \
  --rollouts-per-example 2 \
  --max-tokens 256 \
  --temperature 0.4

prime --plain eval get <eval_id> --output json
prime --plain deployments delete <candidate_adapter_id>
```

The current Prime CLI rejects `--abbreviated-summary`, so do not include it.
The explicit `--env-args '{"split":"hard_eval"}'` matters. Without it, ad hoc
evals can fall back to the environment default split. Hosted evals currently
resolve the latest published environment even when the command includes
`@0.1.12`, so verify `version_id` in `prime --plain eval get <eval_id>
--output json`.

Current hosted blocker: product-readiness attempts on `0.1.14` reached and
installed the `0.1.14` package, but failed before scoring with Prime inference
503 auth-service errors. Adapter `rqvfrcdy4xt95oka37b0xjyu` now reports
`NOT_DEPLOYED` after the latest unload retry.

Product-readiness eval `exuegi7g55rdsnndi8cd2n15` on `0.1.17` installed the
new package but failed before scoring during inference preflight with a `502 Bad
Gateway` connection error from `api.pinference.ai`. This is still a hosted
inference blocker, not model evidence.

## Promote Only If

Promote the candidate only if all of these hold:

- Hard-eval reward is greater than `0.830`.
- `price_format` is materially above `0.625`.
- Tool correctness stays near `0.984`.
- Product-readiness eval shows correct clarification, substitution, and
  cart behavior.
- Final answers are not more verbose than the champion.
- The model does not repeat tools after a successful order.

If the candidate fails any gate, keep `rqvfrcdy4xt95oka37b0xjyu` as champion and
record the run in the flight log.

## Do Not Do Yet

- Do not start larger-model RL before this receipt-format signal is proven on
  the 0.8B champion.
- Do not promote based only on trainer reward if price formatting or tool
  discipline regresses.
- Do not run hosted SFT from this Mac workspace; current Prime CLI training
  exposes hosted RL, and Prime-RL SFT needs a Linux GPU runtime. The local SFT
  corpora are ready for a Linux GPU runtime:
  - `data/effect_coffee_sft/product_behavior_final_response_sft.jsonl`
  - `data/effect_coffee_sft/product_behavior_tool_trajectory_sft.jsonl`
