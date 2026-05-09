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
