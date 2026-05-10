# effect-coffee-ordering

### Overview
- **Environment ID**: `effect-coffee-ordering`
- **Short description**: Tool-use environment for training coffee-shop ordering assistants against Effect Coffee Shop menu rules.
- **Tags**: tool-use, coffee, ordering, train, eval

### Datasets
- **Primary dataset(s)**: Synthetic customer requests based on the Effect Coffee Shop domain model.
- **Source links**: Local app menu and order rules.
- **Split sizes**: 20 train examples, 8 eval examples, 8 hard eval examples, 22 receipt drill examples.

### Task
- **Type**: tool use
- **Output format expectations**: Use `list_menu` for availability questions and `place_order` for valid orders. Refuse invalid or ambiguous orders without placing an order.
- **Rubric overview**: Rewards correct tool behavior, exact order fields, useful menu answers, refusal of invalid requests, and concise final customer-facing confirmations.

### Quickstart
Run an evaluation with default settings:

```bash
prime eval run effect-coffee-ordering
```

Configure model and sampling:

```bash
prime eval run effect-coffee-ordering -m openai/gpt-4.1-mini -n 3 -r 1 -t 512
```

Notes:
- Use `-a` / `--env-args` to pass environment-specific configuration as a JSON object.

### Environment Arguments
Document any supported environment arguments and their meaning. Example:

| Arg | Type | Default | Description |
| --- | ---- | ------- | ----------- |
| `split` | str | `"train"` | Use `"train"`, `"eval"`, `"hard_eval"`, or `"receipt_drill"` examples |
| `num_examples` | int | `-1` | Limit dataset size; use -1 for all examples |

### Metrics
Summarize key metrics your rubric emits and how they’re interpreted.

| Metric | Meaning |
| ------ | ------- |
| `reward` | Main scalar reward (weighted sum of criteria) |
| `tool_correctness` | Correct tool choice and structured order/refusal behavior |
| `final_response_quality` | Customer-facing confirmation or refusal quality |
