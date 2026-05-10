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

Use the small budget-capped receipt-drill warmup. Environment
`kevinmichaelchen/effect-coffee-ordering@0.1.6` is already published and
integration tested.

```sh
cd experiments/prime-intellect/effect-coffee-ordering
prime --plain train configs/rl/effect-coffee-ordering-qwen-0.8b-receipt-drill-warmup.toml --yes
```

## Product-Readiness Run

The process now has a broader `product_readiness` split and matching SFT corpora
for:

- multi-item/cart requests,
- substitutions and unavailable ingredients,
- ambiguous orders that need clarification,
- modifier edge cases,
- pickup timing, customer name, and order notes,
- concise refusal behavior.

Publish the checked-in environment as the next version before launching this
run:

```sh
cd experiments/prime-intellect/effect-coffee-ordering
prime --plain env push --path environment --owner kevinmichaelchen --visibility PRIVATE
prime --plain env status kevinmichaelchen/effect-coffee-ordering --output json
```

Only run the product-readiness warmup after the new version is available as
`0.1.7`:

```sh
prime --plain train configs/rl/effect-coffee-ordering-qwen-0.8b-product-readiness-warmup.toml --yes
```

Track the run:

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
  --temperature 0.4 \
  --abbreviated-summary

prime --plain eval run kevinmichaelchen/effect-coffee-ordering \
  --hosted \
  --model Qwen/Qwen3.5-0.8B:<candidate_adapter_id> \
  --env-args '{"split":"product_readiness"}' \
  --num-examples 16 \
  --rollouts-per-example 2 \
  --max-tokens 256 \
  --temperature 0.4 \
  --abbreviated-summary

prime --plain eval get <eval_id> --output json
prime --plain deployments delete <candidate_adapter_id>
```

The explicit `--env-args '{"split":"hard_eval"}'` matters. Without it, ad hoc
evals can fall back to the environment default split.

## Promote Only If

Promote the candidate only if all of these hold:

- Hard-eval reward is greater than `0.830`.
- `price_format` is materially above `0.625`.
- Tool correctness stays near `0.984`.
- Product-readiness eval shows correct clarification, substitution, and
  unsupported-cart behavior.
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
