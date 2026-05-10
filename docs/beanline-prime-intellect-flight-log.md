# Beanline Prime Intellect Flight Log

This file is the durable training journal for the Beanline coffee-shop model.
It records the plan, empirical results, decisions, and remaining risks for each
Prime Intellect iteration so the model work stays measurable and budget-aware.

## Operating Goals

- Produce an adapter that is verifiably better than the raw base model on a
  held-out coffee-ordering eval.
- Stay under the initial `$50.00` Prime Intellect credit budget.
- Keep the value story tied to real user outcomes: fewer invalid order
  submissions, better menu-policy compliance, and more reliable confirmations.
- Record each juncture with what changed, why it changed, and what the evals
  showed afterward.

## Product Value Story

Beanline is not a general chatbot. It is an ordering assistant that sits between
customers and the coffee shop's order actions. The useful model behavior is
therefore operational:

- Check the real menu before answering availability or placing orders.
- Use valid internal tool values such as `latte`, `whole`, `extra-hot`, and
  `cold-brew` rather than customer-facing paraphrases that the order action
  rejects.
- Refuse or redirect invalid requests instead of hallucinating a successful
  order.
- Confirm accepted orders with the drink, order id, and price.

The first trained adapter's clearest gain is tool correctness. That matters
because a bad tool call is not just a bad sentence; it becomes a bad or failed
order in the product flow.

## Prime Intellect Setup

- Prime username: `kevinmichaelchen`
- Authentication: GitHub SSO
- Starting wallet: `$50.00`
- Working directory for the lab artifacts:
  `.context/prime-intellect/lab`
- Public docs and blog were pulled into `.context/prime-intellect/` before the
  first run.
- CLI installed with `uv tool install -U prime`
- Agent-friendly CLI mode used throughout: `prime --plain`

## Environment Design

- Prime Hub environment: `kevinmichaelchen/effect-coffee-ordering`
- Visibility: private
- Runtime: Verifiers `ToolEnv`
- Tools:
  - `list_menu`: returns the simulated Effect Coffee Shop menu.
  - `place_order`: validates and simulates order placement.
- Menu coverage:
  - Espresso
  - Americano
  - Latte
  - Cappuccino
  - Cold Brew
  - Tea
- Training set: 14 tasks
- Held-out eval set: 8 tasks
- Reward functions:
  - `tool_correctness`, weighted `0.8`
  - `final_response_quality`, weighted `0.2`

The environment intentionally models product invariants rather than general
conversation quality. It rewards correct menu/tool behavior first, then rewards
the final user-facing confirmation or refusal.

## Iteration 0: Vanilla Baseline

### Question

How well does the raw small model handle the coffee shop's tool-use workflow
without task-specific training?

### Model

- Base model: `Qwen/Qwen3.5-0.8B`
- Published environment version: `0.1.1`
- Hosted eval id: `f21thzst9tm2hlsu6tgg2cd2`
- Eval shape: 8 examples, 2 rollouts per example, 256 max tokens

### Results

| Metric | Value |
| --- | ---: |
| reward avg | `0.417` |
| pass@1 | `0.562` |
| pass@2 | `0.750` |
| tool_correctness avg | `0.484` |
| final_response_quality avg | `0.146` |

### Observed Failure Mode

The baseline often used invalid tool arguments, then recovered badly. One
representative example asked for a medium hot whole-milk latte. The raw model
called `place_order` with `milk: "whole milk"` instead of the valid enum
`whole`, received a tool error, then hallucinated a successful espresso order.

### Decision

Proceed with a small, budget-capped adapter training run. The baseline showed
enough headroom, and the failure mode was directly tied to product value.

## Iteration 1: Tool-Correct Coffee Ordering Adapter

### Plan

Train the smallest available Qwen model first so we can validate the training
loop cheaply before trying a larger model.

- Model: `Qwen/Qwen3.5-0.8B`
- Max steps: `50`
- Batch size: `128`
- Rollouts per example: `8`
- Max tokens: `256`
- Eval interval: `25`
- Adapter checkpoints retained: last two
- Target budget for first real run: comfortably under `$10`

### Packaging Issue

The first hosted training run failed before consuming tokens.

- Failed run: `keikstv7hn8ctd9yip79apxu`
- Cost: `$0.00`
- Cause: hosted Prime RL expected the Prime `verifiers` git build, but the
  environment dependency upgraded the training container to PyPI
  `verifiers==0.1.14`, which caused an import failure for
  `flatten_task_input`.

### Fix

The environment package was republished as version `0.1.2`, pinning `verifiers`
to the same Prime git commit used by hosted training:

```text
git+https://github.com/PrimeIntellect-ai/verifiers.git@3b77145e14a9bcdaf180a49e7df97dbf2d7bb150
```

This changed packaging/runtime compatibility only. The task and reward code
stayed behaviorally comparable with the baseline.

### Training Run

- Successful run: `wwa92ke3xze596v3c9y85lq5`
- Environment version: `0.1.2`
- Training cost: `$1.55`
- Completed: 50 steps

Trainer evals:

| Checkpoint | Avg@2 |
| --- | ---: |
| step 0 | `0.2167` |
| step 25 | `0.7458` |
| final | `0.7500` |

The step-25 held-out eval cleared the improvement gate, so training continued
to step 50 because marginal cost was still low.

### Deployment Notes

- Step-25 adapter `rkx6rzwf6e86rzr9i8vdba3x` reached `READY`, but deployment
  failed with `Adapter registration failed. Please contact support.`
- Finalization adapter `wukfwrfyupnrxl3sl5apsbjx` deployed successfully.
- The deployed adapter was unloaded after evaluation to avoid accidental
  ongoing serving exposure. The model remains stored and redeployable.

### External Verification Eval

- Adapter: `wukfwrfyupnrxl3sl5apsbjx`
- Inference model string while deployed:
  `Qwen/Qwen3.5-0.8B:wukfwrfyupnrxl3sl5apsbjx`
- Hosted eval id: `h044tihp1vgs8aznqfgsd5kd`
- Eval shape: 8 examples, 2 rollouts per example, 256 max tokens

| Metric | Vanilla Qwen 0.8B | Trained adapter | Delta |
| --- | ---: | ---: | ---: |
| reward avg | `0.417` | `0.775` | `+0.358` |
| pass@1 | `0.562` | `0.812` | `+0.250` |
| pass@2 | `0.750` | `0.875` | `+0.125` |
| tool_correctness avg | `0.484` | `0.906` | `+0.422` |
| final_response_quality avg | `0.146` | `0.250` | `+0.104` |

### Spend

- Final wallet after training and evals: `$48.34`
- Approximate total spend from the initial `$50.00`: `$1.66`
- Budget remaining: about `$48.34`

### Decision

Iteration 1 met the first success bar: the trained adapter is measurably better
than the raw base model on the held-out environment and did not threaten the
budget.

## Remaining Weakness

The adapter is too verbose and sometimes overuses tools. In the external eval,
it often reached `max_turns`, repeated `list_menu`, and continued tool work
after a successful order. Tool correctness improved sharply, but the model did
not yet learn the product ideal of a short, decisive final confirmation.

The next iteration should reward concise final confirmations more strongly and
penalize unnecessary repeated `list_menu` calls after the model has enough
state, especially after a successful `place_order`.

## Iteration 2 Plan: Make the Model More Product-Ready

### Target Behavior

- Use `list_menu` when menu validation is needed, but avoid repeated menu
  calls in the same rollout unless the user asks a new availability question.
- Call `place_order` once with valid canonical arguments for valid requests.
- Stop after a successful `place_order` and produce one concise confirmation.
- For invalid requests, do not call `place_order`; offer the closest valid
  alternative or ask one clarifying question.
- Prefer shorter completions that still include required order details.

### Reward Changes

Add a third scoring component or refine `final_response_quality` so the reward
captures operational polish, not just correctness:

- Penalize repeated `list_menu` calls after the first successful menu lookup.
- Penalize any tool call after a successful `place_order`.
- Penalize max-turn termination when the order has already been accepted.
- Reward final confirmations that include exactly the drink, order id, and
  price in one short response.
- Reward invalid-request refusals that name the invalid option and one valid
  alternative.

### Eval Changes

Keep the current held-out eval as the continuity benchmark, then add a second
product-readiness eval slice:

- Valid order tasks where the ideal trace is `list_menu -> place_order -> final`.
- Invalid option tasks where the ideal trace avoids `place_order`.
- Menu availability tasks where the ideal trace is `list_menu -> answer`.
- Repeated edge cases for cold brew shot limits, tea milk requests, unsupported
  mocha/matcha requests, and extra-hot constraints.

Track both:

- Correctness score: can the model obey the shop rules?
- Efficiency score: can the model finish without redundant tools or max-turn
  drift?

### Training Strategy

Use the current adapter as the baseline to beat, not just the raw base model.
The next run should be small and comparative:

- Start from the same `Qwen/Qwen3.5-0.8B` base unless Prime supports continuing
  cleanly from the adapter.
- Train on the revised reward and task mix.
- Keep a strict budget gate: stop after the first checkpoint that beats
  Iteration 1 on both reward and efficiency.
- Only consider a larger model after the reward/eval design is stable.

### Success Criteria

Iteration 2 should be considered better only if it improves or preserves
correctness while reducing verbosity:

| Metric | Iteration 1 | Iteration 2 Target |
| --- | ---: | ---: |
| reward avg | `0.775` | `>= 0.80` |
| pass@1 | `0.812` | `>= 0.85` |
| tool_correctness avg | `0.906` | `>= 0.90` |
| final_response_quality avg | `0.250` | `>= 0.50` |
| average total tool calls | `3.000` | `< 2.25` |
| max_turns_reached rate | `0.562` | `< 0.25` |

## Next Decision

Iteration 2 has now been executed. The result beat Iteration 1 on every tracked
product-readiness metric, so the next decision is whether to harden the eval
suite with more adversarial tasks before trying a larger model.

## Iteration 2 Execution: Efficiency And Final Response Quality

### Reward Revision

Environment `0.1.3` added a third reward component, `product_efficiency`, and
changed the system prompt to make the desired trace explicit:

- Use `list_menu` when validation is needed.
- For valid orders, call `place_order` once with canonical values.
- After `place_order` succeeds, stop using tools.
- Give one concise final confirmation with drink, order id, and price.
- For invalid requests, give one concise correction or valid alternative.

The new reward weights were:

| Reward component | Weight |
| --- | ---: |
| `tool_correctness` | `0.55` |
| `final_response_quality` | `0.25` |
| `product_efficiency` | `0.20` |

`product_efficiency` scored the operational shape of the trace:

- `place_order` tasks: at most one menu lookup, exactly one order call, no tool
  calls after success, a final response, and concise wording.
- `list_menu` tasks: exactly one menu call, no order calls, a final answer, and
  concise wording.
- refusal tasks: no order call, at most one menu call, a final answer, and
  concise wording.

### Stricter Baseline For Iteration 1 Adapter

The Iteration 1 adapter was redeployed and evaluated against environment
`0.1.3` before training Iteration 2.

- Adapter: `wukfwrfyupnrxl3sl5apsbjx`
- Hosted eval id: `xvcy6h7p5z1ffgm9i0t22eka`
- Eval shape: 8 examples, 2 rollouts per example, 256 max tokens

| Metric | Iteration 1 under `0.1.3` |
| --- | ---: |
| reward avg | `0.703` |
| pass@1 | `0.938` |
| pass@2 | `1.000` |
| tool_correctness avg | `0.953` |
| final_response_quality avg | `0.286` |
| product_efficiency avg | `0.536` |
| average total tool calls | `3.000` |
| average `list_menu` calls | `1.625` |
| average `place_order` calls | `1.375` |
| max_turns_reached rate | `0.562` |

This confirmed the diagnosis: the first adapter was already strong on business
correctness, but it still used too many tools, repeated menu lookups, and often
ran to the turn limit.

### Training Run

- Successful run: `pa17nnag3uslv49ydyyjhy85`
- Environment version: `0.1.3`
- Model: `Qwen/Qwen3.5-0.8B`
- Max steps: `50`
- Training cost: `$0.97`

Trainer evals:

| Checkpoint | Avg@2 | Notes |
| --- | ---: | --- |
| step 0 | `0.4521` | raw base model under stricter reward |
| step 25 | `0.6992` | near-tie with Iteration 1 stricter baseline |
| final | `0.7984` | clear improvement, so final adapter was evaluated externally |

The step-25 eval was slightly below the Iteration 1 stricter baseline, but the
training reward was still rising and cost was low, so the run continued to step
50. That was the right call: the final trainer eval moved materially above the
baseline.

### External Verification Eval

- Adapter: `rqvfrcdy4xt95oka37b0xjyu`
- Inference model string while deployed:
  `Qwen/Qwen3.5-0.8B:rqvfrcdy4xt95oka37b0xjyu`
- Hosted eval id: `m5l1fk46fmkwdk123h6j09ne`
- Eval shape: 8 examples, 2 rollouts per example, 256 max tokens
- Deployment status after eval: unloaded

| Metric | Iteration 1 strict baseline | Iteration 2 adapter | Delta |
| --- | ---: | ---: | ---: |
| reward avg | `0.703` | `0.907` | `+0.204` |
| pass@1 | `0.938` | `1.000` | `+0.062` |
| pass@2 | `1.000` | `1.000` | `+0.000` |
| tool_correctness avg | `0.953` | `1.000` | `+0.047` |
| final_response_quality avg | `0.286` | `0.729` | `+0.443` |
| product_efficiency avg | `0.536` | `0.875` | `+0.339` |
| average total tool calls | `3.000` | `1.812` | `-1.188` |
| average `list_menu` calls | `1.625` | `1.062` | `-0.563` |
| average `place_order` calls | `1.375` | `0.750` | `-0.625` |
| max_turns_reached rate | `0.562` | `0.000` | `-0.562` |
| average output tokens | `225.875` | `129.000` | `-96.875` |

### Decision

Iteration 2 succeeded. It did not trade correctness for brevity; it improved
correctness to `1.000` while reducing tool calls, eliminating max-turn drift,
and substantially improving final-response quality.

The remaining quality issue is price formatting. One sampled final response
said `₹518` instead of `$5.18`, while still receiving partial credit through
other required fields. The next reward revision should make price-format
correctness stricter and add eval cases that distinguish cents from dollars.

### Spend

- Wallet after Iteration 2: `$47.27`
- Approximate total spend from the initial `$50.00`: `$2.73`
- Budget remaining: about `$47.27`

### Next Decision

Do not move to a larger model yet. The small model is now strong on the current
eval, so the next best use of budget is harder evaluation:

- Add adversarial price-format tasks that require `$5.18` rather than `518` or
  another currency symbol.
- Add multi-item or follow-up-order tasks only if the product intends to support
  them.
- Add noisy natural-language variants for the same canonical order, such as
  "whole milk" versus internal `whole`.
- Add a true holdout set that is not reused during reward iteration.

After the eval hardening, rerun Iteration 2 as the baseline and only then decide
whether a 4B model is worth the extra cost.

## Iteration 3: Price-Format Hardening

### Plan

The Iteration 2 adapter became the champion, but it still exposed a product
quality bug: accepted orders could be operationally correct while the final
receipt rendered the total as cents or the wrong currency. That is a real user
value issue for a coffee ordering assistant because the customer-facing
confirmation must be trustworthy, not just the backend tool call.

Iteration 3 therefore changed the environment before changing the model:

- Environment version: `0.1.4`
- Added split: `hard_eval`
- Added rubric: `price_format`
- New reward weights:

| Reward component | Weight |
| --- | ---: |
| `tool_correctness` | `0.45` |
| `final_response_quality` | `0.25` |
| `product_efficiency` | `0.20` |
| `price_format` | `0.10` |

The `hard_eval` split keeps price-sensitive and noisy phrasing examples
separate from training. It includes cases such as "whole milk" natural language
that must become the canonical internal value `whole`, and accepted orders that
must mention the exact dollar string, for example `$5.18`.

### Explicit Hard-Holdout Baseline

One important process correction: standalone hosted evals must pass explicit
environment args. Earlier training-config evals already used `split = "eval"`,
but ad hoc hosted evals can otherwise fall back to the environment default.
From this point forward, hard-holdout comparisons use:

```sh
--env-args '{"split":"hard_eval"}'
```

The Iteration 2 champion was redeployed and evaluated against environment
`0.1.4`.

- Adapter: `rqvfrcdy4xt95oka37b0xjyu`
- Hosted eval id: `uio6f0cvm0h9xp7pu18gevsb`
- Eval shape: 8 examples, 2 rollouts per example, 256 max tokens

| Metric | Iteration 2 on `hard_eval` |
| --- | ---: |
| reward avg | `0.835` |
| pass@1 | `1.000` |
| pass@2 | `1.000` |
| tool_correctness avg | `1.000` |
| final_response_quality avg | `0.622` |
| product_efficiency avg | `0.837` |
| price_format avg | `0.625` |
| average total tool calls | `1.812` |
| average `list_menu` calls | `1.062` |
| average `place_order` calls | `0.750` |
| max_turns_reached rate | `0.062` |
| average output tokens | `142.062` |

This confirmed the remaining weakness precisely. The model was still perfectly
correct at tool use on the hard split, but several accepted-order confirmations
said values like `518 cents` instead of `$5.18`.

### Experiment A: Raw-Base Price Hardening

- Run: `jkpq2tll4nf95s6m2d1m5k12`
- Config: `effect-coffee-ordering-qwen-0.8b-price-hardening`
- Start point: raw `Qwen/Qwen3.5-0.8B`
- Environment version: `0.1.4`
- Max steps: `40`
- Cost: `$0.85`

Trainer metrics:

| Checkpoint | Hard eval Avg@2 | Mean eval completion length | Decision |
| --- | ---: | ---: | --- |
| step 0 | `0.4181` | `427.625` | raw baseline under hard reward |
| step 22 | `0.6908` | `610.625` | below champion |
| final | `0.7571` | `720.063` | rejected |

The run improved over the raw base but did not beat the Iteration 2 champion.
It also moved in the wrong direction on verbosity, so no external deployment
eval was run.

### Experiment B: Warm-Start Price Hardening

Prime Hosted Training supports warm-starting from a checkpoint by setting
`checkpoint_id`. Iteration 2 had one ready checkpoint:

- Source run: `pa17nnag3uslv49ydyyjhy85`
- Checkpoint: `oo8lrytspz37lfsdlloubig7`
- Checkpoint step: `25`

The hypothesis was that continuing from the Iteration 2 policy would preserve
tool-use gains while learning the stricter receipt formatting reward.

- Run: `olb4i92pisuegkinsaqhoeif`
- Config: `effect-coffee-ordering-qwen-0.8b-warm-price-hardening`
- Start point: Iteration 2 step-25 checkpoint
- Environment version: `0.1.4`
- Max steps: `45`
- Cost: `$0.39`

Trainer metrics:

| Checkpoint | Hard eval Avg@2 | Mean eval completion length | Decision |
| --- | ---: | ---: | --- |
| step 32 | `0.7237` | `674.438` | below champion |
| step 41 | `0.7354` | `617.188` | below champion |
| final | `0.7471` | `742.000` | rejected |

This was the right low-cost experiment, but it did not work. It preserved much
of the tool correctness during training batches, yet the held-out policy was
still worse than the Iteration 2 champion and more verbose.

### Decision

Do not promote either Iteration 3 adapter. The champion remains:

- Adapter: `rqvfrcdy4xt95oka37b0xjyu`
- Model string when deployed:
  `Qwen/Qwen3.5-0.8B:rqvfrcdy4xt95oka37b0xjyu`
- Champion hard-holdout reward: `0.835`

Iteration 3 was still valuable: it produced a stricter, explicit holdout and
showed that simply adding a price-format reward is not enough. The likely
failure mode is sparse, weak pressure on the final answer style. The model can
learn operational tool correctness, but receipt wording needs more direct
training signal.

### Spend

- Wallet after Iteration 3: `$45.94`
- Iteration 3 incremental spend: `$1.24`
- Approximate total spend from the initial `$50.00`: `$4.06`
- Budget remaining: `$45.94`

The budget gate held: no expensive larger-model run was started, and rejected
adapters were not externally evaluated.

### Next Decision

Before spending on a larger base model, make the reward less sparse:

- Add more accepted-order training tasks whose prompts explicitly ask for a
  final total in dollars.
- Increase `price_format` weight only after verifying it does not reduce tool
  correctness.
- Add a direct final-answer style rubric that rewards one short receipt
  sentence after successful `place_order`.
- Consider a small SFT-style warmup or seed examples if Hosted Training supports
  it cleanly; the desired receipt format is deterministic and may not need RL
  exploration.
- Keep the Iteration 2 champion as the production candidate unless the next
  experiment beats `0.835` on `hard_eval` and improves `price_format` above
  `0.625` without raising tool calls.

## Iteration 4: Receipt Signal And Bigger-Model Probe

### Plan

The most valuable next step was to improve the training signal before spending
on much larger models. Iteration 3 showed that price-format reward alone was too
sparse. Iteration 4 therefore made the receipt behavior more explicit:

- Environment version: `0.1.5`
- Added more accepted-order training tasks whose prompts ask for dollar totals.
- Added rubric: `receipt_style`
- New reward weights:

| Reward component | Weight |
| --- | ---: |
| `tool_correctness` | `0.40` |
| `final_response_quality` | `0.20` |
| `product_efficiency` | `0.15` |
| `price_format` | `0.15` |
| `receipt_style` | `0.10` |

`receipt_style` rewards a successful final answer that includes the drink name,
order id, exact dollar total, no cent/currency mistakes, no post-success tool
calls, and short wording.

### Champion Re-Baseline Under `0.1.5`

The reward changed, so the Iteration 2 champion had to be re-evaluated before
any new run could be compared fairly.

- Adapter: `rqvfrcdy4xt95oka37b0xjyu`
- Hosted eval id: `qu00ipz8e4o04ja1jgx119wu`
- Eval shape: 8 examples, 2 rollouts per example, 256 max tokens

| Metric | Champion on `0.1.5 hard_eval` |
| --- | ---: |
| reward avg | `0.830` |
| pass@1 | `1.000` |
| pass@2 | `1.000` |
| tool_correctness avg | `0.984` |
| final_response_quality avg | `0.639` |
| product_efficiency avg | `0.853` |
| price_format avg | `0.625` |
| receipt_style avg | `0.866` |
| average total tool calls | `1.750` |
| average output tokens | `132.562` |

The champion remains strong. The key miss is unchanged: exact dollar formatting
is only `0.625`.

### Experiment A: 0.8B Warm-Start With Receipt Style

- Run: `bepjjxzmb5ix79n0exmvtxra`
- Config: `effect-coffee-ordering-qwen-0.8b-receipt-style-v015`
- Start point: Iteration 2 checkpoint `oo8lrytspz37lfsdlloubig7`
- Environment version: `0.1.5`
- Learning rate: `5e-5`
- Max steps: `55`
- Cost: `$0.60`

Trainer metrics:

| Checkpoint | Hard eval Avg@2 | Mean eval completion length | Decision |
| --- | ---: | ---: | --- |
| step 32 | `0.7435` | `645.688` | below champion |
| step 42 | `0.7521` | `635.563` | below champion |
| step 52 | `0.7412` | `668.688` | below champion |
| final | `0.7426` | `669.625` | rejected |

This confirmed that adding receipt-style reward and examples helped training
batches but did not produce a better held-out policy. The model still became
too verbose on held-out eval.

### Experiment B: Raw Bigger-Model Probes

Before training a bigger model, two raw larger Qwen models were evaluated on
the same hard holdout.

| Model | Eval id | Reward avg | Tool correctness | Price format | Receipt style | Notes |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `Qwen/Qwen3.5-2B` | `psc4otym1oh7irxcdw18tzya` | `0.610` | `0.562` | `0.750` | `0.741` | better receipt prior, weak tool use |
| `Qwen/Qwen3.5-4B` | `a0tbg2ctifimgv5l18z7jrij` | `0.674` | `0.688` | `0.688` | `0.688` | verbose reasoning, 50% truncation |

An attempted `Qwen/Qwen3.5-4B` eval with `enable_thinking=false` failed at the
hosted eval client layer:

- Eval id: `mwxan4rlkl14013zz7usctb6`
- Failure: `AsyncCompletions.create() got an unexpected keyword argument
  'enable_thinking'`

That failed eval is not evidence about model quality; it is a tooling limitation
for this hosted eval path.

### Experiment C: 2B Training Probe

The raw 2B model had a better receipt prior than the 0.8B champion but poor tool
correctness. Since RL previously taught tool behavior well, a small 2B training
run was the most plausible larger-model experiment.

- Run: `ubl29vbu5g5oi08ig4pbhw4q`
- Config: `effect-coffee-ordering-qwen-2b-v015`
- Model: `Qwen/Qwen3.5-2B`
- Environment version: `0.1.5`
- Planned max steps: `50`
- Stopped at: step `31` after the first trained hard eval
- Cost: `$1.80`

Trainer metrics:

| Checkpoint | Hard eval Avg@2 | Mean eval completion length | Decision |
| --- | ---: | ---: | --- |
| step 0 | `0.6116` | `553.438` | raw 2B baseline in training config |
| step 27 | `0.6675` | `628.438` | below champion; stopped soon after |

Training did improve over raw 2B, but it was still far below the 0.8B champion
and had worse verbosity. The run was stopped to protect budget.

### Decision

Do not promote any Iteration 4 adapter. Do not start 4B/9B training yet.

The current champion remains:

- Adapter: `rqvfrcdy4xt95oka37b0xjyu`
- Champion `0.1.5 hard_eval` reward: `0.830`
- Main weakness: `price_format = 0.625`

The larger-model result is informative: bigger raw Qwen models have somewhat
better receipt priors, but they do not naturally preserve the tool discipline we
need. Training 2B did not close the gap cheaply enough, and 4B showed a
verbosity/truncation risk.

### Spend

- Wallet after Iteration 4: `$43.27`
- Iteration 4 incremental spend: about `$2.67`
- Approximate total spend from the initial `$50.00`: `$6.73`
- Budget remaining: `$43.27`

### Next Decision

The next best path is not a bigger RL run. The evidence points toward adding a
more direct supervised receipt-format signal before more RL:

- Add or generate deterministic successful-order transcripts where the final
  answer is exactly one short receipt sentence with `$x.xx`.
- Use SFT or another Prime-supported seed/warmup path if available.
- If SFT is not available, reshape the environment so accepted-order prompts
  expose a stronger contrast between good and bad final receipts, then rerun a
  short 0.8B experiment.
- Only revisit 2B/4B after the final-answer signal is strong enough that the
  larger model's receipt prior can be captured without losing tool correctness.

## Iteration 5: Supervised Receipt-Format Artifact

### Plan

The user asked to proceed with a direct supervised receipt-format signal before
more RL spend. This follows the Iteration 4 conclusion: the model can learn
tool behavior with RL, but the remaining weakness is deterministic final
receipt wording. RL has been an inefficient way to teach that exact formatting.

Prime-RL's local documentation describes an SFT trainer that can consume either
prompt/completion rows or raw `messages` conversations, including tool-calling
conversations. The Hosted Training CLI currently exposes the RL config path we
have been using, so no new hosted training spend was started for this step.

### Artifact Created

Generated deterministic SFT-style corpora under the Prime lab workspace:

- `.context/prime-intellect/lab/data/effect_coffee_sft/receipt_final_response_sft.jsonl`
- `.context/prime-intellect/lab/data/effect_coffee_sft/receipt_tool_trajectory_sft.jsonl`
- `.context/prime-intellect/lab/data/effect_coffee_sft/README.md`
- Generator:
  `.context/prime-intellect/lab/scripts/build_effect_coffee_receipt_sft.py`

Dataset shape:

| Corpus | Rows | Purpose |
| --- | ---: | --- |
| `receipt_final_response_sft.jsonl` | `22` | prompt/completion rows focused directly on final customer receipts |
| `receipt_tool_trajectory_sft.jsonl` | `22` | raw messages rows with tool calls, tool results, and final receipt |

The successful-order completions use the compact target style:

```text
Latte order-simulated-0001 $5.18.
```

Validation was run locally. Successful receipts must:

- include the exact `$x.xx` total,
- avoid `cent`, `cents`, and wrong-currency symbols,
- stay short,
- preserve the canonical simulated order id.

### SFT Path Check

Local docs show the SFT entrypoint as:

```sh
uv run sft ...
```

But the current Prime lab environment does not have an `sft` executable
installed:

```text
error: Failed to spawn: `sft`
Caused by: No such file or directory
```

Therefore the decision is to preserve the supervised data artifact and avoid
spending more RL budget until an SFT-capable runtime is available or we choose a
deliberate environment reshaping step.

### Decision

No model was promoted, no RL run was started, and no adapter was deployed.

The champion remains:

- Adapter: `rqvfrcdy4xt95oka37b0xjyu`
- Champion `0.1.5 hard_eval` reward: `0.830`
- Main weakness: `price_format = 0.625`

Next viable options:

- Install or provision an SFT-capable Prime-RL runtime and run the
  `receipt_final_response_sft` corpus first, because it targets the exact final
  answer weakness with the least behavioral blast radius.
- If SFT remains unavailable, convert the deterministic corpus into a stricter
  `receipt_drill` environment split and use it only as a short warmup before
  returning to the normal `train` and `hard_eval` splits.
- Keep larger-model RL paused until one of those supervised-format paths shows
  an improvement in exact dollar totals without regressing tool correctness.
