# Receipt SFT Runbook

This runbook captures the next supervised fine-tuning path for the Beanline
receipt-format weakness.

## Why SFT

The current champion is strong on operational tool behavior but still sometimes
formats prices as cents or wrong currency. This is deterministic style behavior,
so supervised fine-tuning is a better next step than more RL exploration.

Target successful receipt style:

```text
Latte order-simulated-0001 $5.18.
```

## Prepared Data

Regenerate from this directory:

```sh
uv run python scripts/build_effect_coffee_receipt_sft.py
```

Corpora:

| File | Rows | Use |
| --- | ---: | --- |
| `data/effect_coffee_sft/receipt_final_response_sft.jsonl` | `22` | First SFT target. Teaches final receipt wording directly. |
| `data/effect_coffee_sft/receipt_tool_trajectory_sft.jsonl` | `22` | Follow-up target. Teaches full tool-call plus final receipt traces. |
| `data/effect_coffee_sft/product_behavior_final_response_sft.jsonl` | `16` | Broader cashier behavior: clarification, substitutions, unsupported carts, notes, and concise refusals. |
| `data/effect_coffee_sft/product_behavior_tool_trajectory_sft.jsonl` | `16` | Full tool-call traces for the broader cashier behavior set. |

Start with `receipt_final_response_sft.jsonl`. It has the least blast radius
because it only teaches post-tool receipt wording.

Then use `product_behavior_final_response_sft.jsonl` before any broad RL spend.
It teaches what "good" means for customer behavior without changing tool
discipline. Use the product behavior trajectory corpus only after final-response
behavior improves, because trajectory tuning has a larger blast radius.

## Local Mac Status

The current Mac workspace cannot run Prime-RL SFT directly.

Attempted:

```sh
uvx --from prime-rl sft --help
uvx --from git+https://github.com/PrimeIntellect-ai/prime-rl sft --help
```

Results:

- `prime-rl` is not published as a normal PyPI package.
- The GitHub source resolves to `prime-rl==0.4.0`, which depends on
  `torch>=2.9.0` CUDA wheels.
- Those CUDA Torch wheels do not match `macosx arm64`.

Conclusion: run SFT on a Linux GPU runtime, not this Mac.

## Hosted Training Status

The current `prime train configs` surface exposes hosted RL configuration
fields, and the Lab launch blog says hosted SFT support is still forthcoming.
So there is no hosted SFT launch command to spend credits on from this
workspace yet.

## Linux GPU / Prime Runtime Path

On a Linux GPU host:

```sh
git clone https://github.com/PrimeIntellect-ai/prime-rl.git
cd prime-rl
uv sync
uv run sft --help
```

Then point the SFT trainer at one of the JSONL corpora in this repo. Prime-RL
docs say the SFT trainer supports:

- prompt/completion format,
- raw `messages` format.

Use the prompt/completion corpus first:

```text
experiments/prime-intellect/effect-coffee-ordering/data/effect_coffee_sft/receipt_final_response_sft.jsonl
```

## Promotion Gate

Do not promote an SFT adapter unless it beats the current champion on the
published hard holdout.

Current champion:

| Metric | Value |
| --- | ---: |
| Adapter | `rqvfrcdy4xt95oka37b0xjyu` |
| Environment | `0.1.5`, `split=hard_eval` |
| Reward | `0.830` |
| Tool correctness | `0.984` |
| Price format | `0.625` |
| Receipt style | `0.866` |

Required improvement:

- Preserve tool correctness near the champion.
- Improve `price_format` materially above `0.625`.
- Avoid increasing tool calls or visible verbosity.

## Fallback If SFT Is Still Unavailable

The checked-in environment source includes a `receipt_drill` split with 22
deterministic examples matching the SFT corpus shape:

```text
experiments/prime-intellect/effect-coffee-ordering/configs/rl/effect-coffee-ordering-qwen-0.8b-receipt-drill-warmup.toml
```

Use this only after publishing the checked-in environment as `0.1.6`. It starts
from the current champion adapter, uses lower rollout volume than the broader
RL runs, and gates on `hard_eval`.

This is less direct than SFT, but it keeps the same principle: force many
unambiguous examples of exact dollar receipt wording before spending on broader
RL again.

For product-readiness behavior, publish the checked-in environment as `0.1.7`
and use:

```text
experiments/prime-intellect/effect-coffee-ordering/configs/rl/effect-coffee-ordering-qwen-0.8b-product-readiness-warmup.toml
```

This split covers multi-item/cart requests, substitutions, ambiguous orders,
modifier edge cases, unavailable ingredients, notes, and concise refusals.
