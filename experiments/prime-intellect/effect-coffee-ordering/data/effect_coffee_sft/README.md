# Effect Coffee Receipt SFT Data

Generated deterministic pre-purchase confirmation and product-behavior corpora.

- `receipt_final_response_sft.jsonl`: prompt/completion rows focused on pre-purchase confirmation wording.
- `receipt_tool_trajectory_sft.jsonl`: raw messages rows with quote/cart tool calls and confirmation questions.
- `product_behavior_final_response_sft.jsonl`: prompt/completion rows for broader cashier behavior.
- `product_behavior_tool_trajectory_sft.jsonl`: raw messages rows for broader cashier behavior.

Final-response rows: 22
Tool-trajectory rows: 22
Product-behavior final-response rows: 16
Product-behavior tool-trajectory rows: 16

Validation rules: successful confirmations use exact `$x.xx` totals, avoid cents/wrong-currency wording, and stay short.
