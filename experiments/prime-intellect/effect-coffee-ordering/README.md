# Prime Intellect Effect Coffee Ordering Experiment

This directory contains the reproducible source artifacts for the Beanline
Prime Intellect training work. Scratch outputs, Prime metadata, virtualenvs,
wheels, and hosted eval outputs remain under `.context/` and are not checked in.

## Contents

- `environment/` - Prime Verifiers environment source published as
  `kevinmichaelchen/effect-coffee-ordering`.
- `configs/rl/` - hosted RL training configs used for the recorded runs.
- `scripts/build_effect_coffee_receipt_sft.py` - deterministic receipt-format
  corpus generator.
- `data/effect_coffee_sft/` - generated supervised receipt-format corpora.

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
