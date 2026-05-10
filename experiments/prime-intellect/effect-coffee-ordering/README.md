# Prime Intellect Effect Coffee Ordering Experiment

This directory contains the reproducible source artifacts for the Beanline
Prime Intellect training work. Scratch outputs, Prime metadata, virtualenvs,
wheels, and hosted eval outputs remain under `.context/` and are not checked in.

## Contents

- `NEXT_STEPS.md` - short handoff with the next run command and promotion gate.
- `environment/` - Prime Verifiers environment source published as
  `kevinmichaelchen/effect-coffee-ordering`.
- `configs/rl/` - hosted RL training configs used for the recorded runs.
- `scripts/build_effect_coffee_receipt_sft.py` - deterministic receipt-format
  and product-behavior corpus generator.
- `data/effect_coffee_sft/` - generated supervised receipt-format and
  product-behavior corpora.
- `configs/rl/effect-coffee-ordering-qwen-0.8b-receipt-drill-warmup.toml` -
  deterministic warmup fallback if hosted SFT is unavailable.
- `configs/rl/effect-coffee-ordering-qwen-0.8b-product-readiness-warmup.toml` -
  broader cashier-behavior warmup after publishing environment `0.1.7`.

## Current Champion

- Adapter: `rqvfrcdy4xt95oka37b0xjyu`
- Model string when deployed:
  `Qwen/Qwen3.5-0.8B:rqvfrcdy4xt95oka37b0xjyu`
- Latest hard-holdout gate: environment `0.1.5`, `split=hard_eval`
- Champion reward: `0.830`
- Main remaining weakness: `price_format = 0.625`

See `docs/beanline-prime-intellect-flight-log.md` for the full decision log.

## Regenerate SFT Corpora

From this directory:

```sh
uv run python scripts/build_effect_coffee_receipt_sft.py
```

Expected output:

- `data/effect_coffee_sft/receipt_final_response_sft.jsonl`
- `data/effect_coffee_sft/receipt_tool_trajectory_sft.jsonl`

The generator validates that successful receipts use exact `$x.xx` totals,
avoid cents/wrong-currency wording, and stay short.

## Receipt Drill Fallback

The environment source includes a `receipt_drill` split with the same 22
receipt/refusal cases as the SFT corpus. Publish that environment snapshot as
version `0.1.6` before launching the warmup config.

Warm-start configs use checkpoint `oo8lrytspz37lfsdlloubig7` from the champion's
source run. Keep comparing candidates against the final champion adapter
`rqvfrcdy4xt95oka37b0xjyu`.

## Product Readiness Expansion

The environment source also includes a `product_readiness` split for cases that
define a better coffee-shop assistant beyond receipts:

- multi-item/cart requests,
- substitutions and unavailable ingredients,
- ambiguous orders that need clarification,
- modifier edge cases,
- pickup timing, customer name, and order notes,
- concise refusal behavior.

Publish the checked-in environment as version `0.1.7` before launching:

```sh
prime --plain train configs/rl/effect-coffee-ordering-qwen-0.8b-product-readiness-warmup.toml --yes
```

## Prime Hosted RL

The checked-in configs mirror the hosted runs recorded in the flight log. To run
one from the Prime lab workspace, copy or reference the relevant config and run:

```sh
prime --plain train configs/rl/<config>.toml --yes
```

Do not start a new RL run unless it has a clear gate against the current
champion and a budget cap.

## SFT Status

Prime-RL docs describe an SFT entrypoint:

```sh
uv run sft ...
```

The local Prime lab environment used during this work did not have the `sft`
executable installed. The supervised corpora here are therefore prepared as the
next artifact to use once an SFT-capable runtime is available.
