# Effect Coffee Receipt SFT Data

Generated deterministic receipt-format corpora.

- `receipt_final_response_sft.jsonl`: prompt/completion rows focused on final receipt wording.
- `receipt_tool_trajectory_sft.jsonl`: raw messages rows with tool calls, tool results, and final receipts.

Final-response rows: 22
Tool-trajectory rows: 22

Validation rules: successful receipts use exact `$x.xx` totals, avoid cents/wrong-currency wording, and stay short.
