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

Start with `receipt_final_response_sft.jsonl`. It has the least blast radius
because it only teaches post-tool receipt wording.

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

Convert the deterministic corpus into a small `receipt_drill` environment split
and use it as a short warmup before returning to normal RL on `train` and
validation on `hard_eval`.

This is less direct than SFT, but it keeps the same principle: force many
unambiguous examples of exact dollar receipt wording before spending on broader
RL again.
