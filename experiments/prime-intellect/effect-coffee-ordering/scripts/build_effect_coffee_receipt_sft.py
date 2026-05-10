import json
from pathlib import Path
from typing import Any


MENU = {
    "espresso": {
        "name": "Espresso",
        "kind": "espresso",
        "base_price_cents": 300,
        "available_milks": ["none"],
        "available_temperatures": ["hot"],
        "max_shots": 4,
    },
    "americano": {
        "name": "Americano",
        "kind": "espresso",
        "base_price_cents": 350,
        "available_milks": ["none"],
        "available_temperatures": ["hot", "iced"],
        "max_shots": 4,
    },
    "latte": {
        "name": "Latte",
        "kind": "espresso",
        "base_price_cents": 450,
        "available_milks": ["whole", "oat", "almond", "none"],
        "available_temperatures": ["hot", "iced", "extra-hot"],
        "max_shots": 4,
    },
    "cappuccino": {
        "name": "Cappuccino",
        "kind": "espresso",
        "base_price_cents": 425,
        "available_milks": ["whole", "oat", "almond", "none"],
        "available_temperatures": ["hot", "extra-hot"],
        "max_shots": 4,
    },
    "cold-brew": {
        "name": "Cold Brew",
        "kind": "espresso",
        "base_price_cents": 400,
        "available_milks": ["whole", "oat", "almond", "none"],
        "available_temperatures": ["iced"],
        "max_shots": 2,
    },
    "tea": {
        "name": "Tea",
        "kind": "tea",
        "base_price_cents": 325,
        "available_milks": ["none"],
        "available_temperatures": ["hot", "iced"],
        "max_shots": 0,
    },
}

SIZE_MULTIPLIERS = {
    "small": 1.0,
    "medium": 1.15,
    "large": 1.3,
}

SYSTEM_PROMPT = """You are Beanline, the Effect Coffee Shop ordering assistant.
Use list_menu when you need to validate menu availability or order options.
For valid orders, call place_order once with canonical menu ids and option values.
After place_order succeeds, stop using tools and give one concise confirmation with the drink, order id, and price.
If the request is invalid or ambiguous, do not place an order. Give one concise correction or valid alternative."""

SUCCESS_EXAMPLES = [
    ("Order a medium hot whole milk latte with one shot for Rowan.", "latte", "medium", "whole", "hot", 1, "Rowan"),
    ("Can you ring up a large iced oat latte with two shots for Avery?", "latte", "large", "oat", "iced", 2, "Avery"),
    ("Please put in a small hot espresso for Mina.", "espresso", "small", "none", "hot", 1, "Mina"),
    ("Tessa needs a large iced americano.", "americano", "large", "none", "iced", 1, "Tessa"),
    ("Aria wants a medium iced cold brew with oat milk and two shots.", "cold-brew", "medium", "oat", "iced", 2, "Aria"),
    ("Order a medium extra-hot almond cappuccino for Jules.", "cappuccino", "medium", "almond", "extra-hot", 1, "Jules"),
    ("A small iced tea for Devon, please.", "tea", "small", "none", "iced", 0, "Devon"),
    ("Make Priya a large iced cold brew with whole milk.", "cold-brew", "large", "whole", "iced", 1, "Priya"),
    ("Blair wants a medium hot latte with whole milk.", "latte", "medium", "whole", "hot", 1, "Blair"),
    ("Ellis needs a large iced americano.", "americano", "large", "none", "iced", 1, "Ellis"),
    ("Sam wants a small hot espresso.", "espresso", "small", "none", "hot", 1, "Sam"),
    ("Create a large iced cold brew with almond milk and two shots for Riley.", "cold-brew", "large", "almond", "iced", 2, "Riley"),
    ("Put in a small iced tea for Harper.", "tea", "small", "none", "iced", 0, "Harper"),
    ("Order a medium extra-hot cappuccino with oat milk for Noor.", "cappuccino", "medium", "oat", "extra-hot", 1, "Noor"),
    ("Kai would like a medium iced americano.", "americano", "medium", "none", "iced", 1, "Kai"),
    ("Morgan wants a small hot latte with almond milk.", "latte", "small", "almond", "hot", 1, "Morgan"),
    ("Casey needs a large extra-hot cappuccino with whole milk.", "cappuccino", "large", "whole", "extra-hot", 1, "Casey"),
    ("Please ring up a medium iced latte with oat milk and three shots for Nia.", "latte", "medium", "oat", "iced", 3, "Nia"),
]

REFUSAL_EXAMPLES = [
    (
        "Can I get a medium hot americano with whole milk for Quinn?",
        "Americano only supports milk option none.",
    ),
    (
        "Please order an extra-hot cold brew for Lee.",
        "Cold Brew is only available iced.",
    ),
    (
        "Can you make tea with oat milk for Morgan?",
        "Tea only supports milk option none.",
    ),
    (
        "Make a large mocha with almond milk for Robin.",
        "Mocha is not on the menu. A latte is the closest valid option.",
    ),
]

PRODUCT_SUCCESS_EXAMPLES = [
    (
        "Order a medium extra-hot oat latte for Sol, no foam, pickup at 8:15.",
        "latte",
        "medium",
        "oat",
        "extra-hot",
        1,
        "Sol",
        "no foam; pickup 8:15",
    ),
    (
        "Order a small hot cappuccino for Luca and keep the receipt short.",
        "cappuccino",
        "small",
        "whole",
        "hot",
        1,
        "Luca",
        "",
    ),
    (
        "Order a medium iced americano for Jamie and note light ice.",
        "americano",
        "medium",
        "none",
        "iced",
        1,
        "Jamie",
        "light ice",
    ),
]

PRODUCT_MENU_EXAMPLES = [
    (
        "Oat milk is out today. What can I get that does not need oat milk?",
        "You can choose Espresso, Americano, or Tea as-is. Latte, Cappuccino, and Cold Brew can use whole or almond milk instead.",
    ),
    (
        "What non-dairy milks can I get for a latte?",
        "Latte supports oat milk and almond milk.",
    ),
    (
        "What's the cheapest hot drink?",
        "Espresso is the cheapest hot drink at $3.00.",
    ),
    (
        "I need something vegan and iced. What are my options?",
        "Iced Americano and iced Tea work without milk; Cold Brew can use oat or almond milk.",
    ),
]

PRODUCT_REFUSAL_EXAMPLES = [
    (
        "Can you start a cart with a medium oat latte for Ava and a small espresso for Ben?",
        "I can place one drink at a time. Which drink should I start with?",
    ),
    (
        "I added a cappuccino by mistake. Remove it and make the cart a large iced americano for Jo.",
        "I cannot manage a cart yet; I can place one drink at a time.",
    ),
    (
        "No oat milk today; please order a medium hot oat latte for Ina.",
        "Oat milk is unavailable. A latte can use whole or almond milk instead.",
    ),
    (
        "I'll have my usual.",
        "Which drink, size, and name should I use?",
    ),
    (
        "Make it iced for Jordan.",
        "Which drink and size should I make iced for Jordan?",
    ),
    (
        "Can I get a decaf medium hot latte for Ren?",
        "Decaf is not available in the current options.",
    ),
    (
        "Make Morgan a cold brew with three shots.",
        "Cold Brew supports at most 2 shots.",
    ),
    (
        "Can I get an iced cappuccino for Imani?",
        "Cappuccino is only available hot or extra-hot.",
    ),
    (
        "Order a large iced tea with two shots for Remy.",
        "Tea supports 0 shots.",
    ),
]


def calculate_price_cents(drink_id: str, size: str, shots: int) -> int:
    item = MENU[drink_id]
    scaled_base = round(item["base_price_cents"] * SIZE_MULTIPLIERS[size])
    included_shots = 0 if item["kind"] == "tea" else 1
    extra_shots = max(shots - included_shots, 0)
    return scaled_base + extra_shots * 75


def cents_to_dollars(cents: int) -> str:
    return f"${cents / 100:.2f}"


def order_payload(
    drink_id: str,
    size: str,
    milk: str,
    temperature: str,
    shots: int,
    customer_name: str,
    notes: str = "",
) -> dict[str, Any]:
    item = MENU[drink_id]
    return {
        "customer_name": customer_name,
        "drink_id": drink_id,
        "drink_name": item["name"],
        "id": "order-simulated-0001",
        "milk": milk,
        "notes": notes,
        "price_cents": calculate_price_cents(drink_id, size, shots),
        "shots": shots,
        "size": size,
        "status": "pending",
        "temperature": temperature,
    }


def menu_tool_result() -> str:
    rows = [{"id": drink_id, **item} for drink_id, item in MENU.items()]
    return json.dumps({"menu": rows}, sort_keys=True)


def final_receipt(order: dict[str, Any]) -> str:
    return f"{order['drink_name']} {order['id']} {cents_to_dollars(order['price_cents'])}."


def tool_arguments(order: dict[str, Any]) -> str:
    args = {
        "drink_id": order["drink_id"],
        "size": order["size"],
        "milk": order["milk"],
        "temperature": order["temperature"],
        "shots": order["shots"],
        "customer_name": order["customer_name"],
        "notes": order["notes"],
    }
    return json.dumps(args, sort_keys=True)


def tool_result(order: dict[str, Any]) -> str:
    return json.dumps({"ok": True, "order": order}, sort_keys=True)


def final_response_rows() -> list[dict[str, str]]:
    rows = []
    for question, drink_id, size, milk, temperature, shots, customer_name in SUCCESS_EXAMPLES:
        order = order_payload(drink_id, size, milk, temperature, shots, customer_name)
        prompt = "\n".join(
            [
                SYSTEM_PROMPT,
                "",
                f"User request: {question}",
                f"place_order result: {tool_result(order)}",
                "Write only the final customer-facing confirmation.",
            ]
        )
        rows.append({"prompt": prompt, "completion": final_receipt(order)})
    for question, answer in REFUSAL_EXAMPLES:
        prompt = "\n".join([SYSTEM_PROMPT, "", f"User request: {question}", "Write only the final customer-facing response."])
        rows.append({"prompt": prompt, "completion": answer})
    return rows


def product_behavior_final_response_rows() -> list[dict[str, str]]:
    rows = []
    for question, drink_id, size, milk, temperature, shots, customer_name, notes in PRODUCT_SUCCESS_EXAMPLES:
        order = order_payload(drink_id, size, milk, temperature, shots, customer_name, notes)
        prompt = "\n".join(
            [
                SYSTEM_PROMPT,
                "",
                f"User request: {question}",
                f"place_order result: {tool_result(order)}",
                "Write only the final customer-facing confirmation.",
            ]
        )
        rows.append({"prompt": prompt, "completion": final_receipt(order)})
    for question, answer in PRODUCT_MENU_EXAMPLES:
        prompt = "\n".join(
            [
                SYSTEM_PROMPT,
                "",
                f"User request: {question}",
                f"list_menu result: {menu_tool_result()}",
                "Write only the final customer-facing response.",
            ]
        )
        rows.append({"prompt": prompt, "completion": answer})
    for question, answer in PRODUCT_REFUSAL_EXAMPLES:
        prompt = "\n".join([SYSTEM_PROMPT, "", f"User request: {question}", "Write only the final customer-facing response."])
        rows.append({"prompt": prompt, "completion": answer})
    return rows


def tool_trajectory_rows() -> list[dict[str, Any]]:
    rows = []
    for index, (question, drink_id, size, milk, temperature, shots, customer_name) in enumerate(SUCCESS_EXAMPLES, 1):
        order = order_payload(drink_id, size, milk, temperature, shots, customer_name)
        call_id = f"call_receipt_{index:04d}"
        rows.append(
            {
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": question},
                    {
                        "role": "assistant",
                        "content": "",
                        "tool_calls": [
                            {
                                "id": call_id,
                                "type": "function",
                                "function": {"name": "place_order", "arguments": tool_arguments(order)},
                            }
                        ],
                    },
                    {"role": "tool", "tool_call_id": call_id, "name": "place_order", "content": tool_result(order)},
                    {"role": "assistant", "content": final_receipt(order)},
                ]
            }
        )
    for question, answer in REFUSAL_EXAMPLES:
        rows.append(
            {
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": question},
                    {"role": "assistant", "content": answer},
                ]
            }
        )
    return rows


def product_behavior_tool_trajectory_rows() -> list[dict[str, Any]]:
    rows = []
    for index, (question, drink_id, size, milk, temperature, shots, customer_name, notes) in enumerate(
        PRODUCT_SUCCESS_EXAMPLES, 1
    ):
        order = order_payload(drink_id, size, milk, temperature, shots, customer_name, notes)
        call_id = f"call_product_order_{index:04d}"
        rows.append(
            {
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": question},
                    {
                        "role": "assistant",
                        "content": "",
                        "tool_calls": [
                            {
                                "id": call_id,
                                "type": "function",
                                "function": {"name": "place_order", "arguments": tool_arguments(order)},
                            }
                        ],
                    },
                    {"role": "tool", "tool_call_id": call_id, "name": "place_order", "content": tool_result(order)},
                    {"role": "assistant", "content": final_receipt(order)},
                ]
            }
        )
    for index, (question, answer) in enumerate(PRODUCT_MENU_EXAMPLES, 1):
        call_id = f"call_product_menu_{index:04d}"
        rows.append(
            {
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": question},
                    {
                        "role": "assistant",
                        "content": "",
                        "tool_calls": [
                            {
                                "id": call_id,
                                "type": "function",
                                "function": {"name": "list_menu", "arguments": "{}"},
                            }
                        ],
                    },
                    {"role": "tool", "tool_call_id": call_id, "name": "list_menu", "content": menu_tool_result()},
                    {"role": "assistant", "content": answer},
                ]
            }
        )
    for question, answer in PRODUCT_REFUSAL_EXAMPLES:
        rows.append(
            {
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": question},
                    {"role": "assistant", "content": answer},
                ]
            }
        )
    return rows


def validate_final_response_rows(rows: list[dict[str, str]]) -> None:
    for row in rows:
        completion = row["completion"]
        if "cent" in completion.lower() or "₹" in completion:
            raise ValueError(f"bad currency wording: {completion}")
        if "order-simulated-0001" not in completion:
            continue
        if "$" not in completion:
            raise ValueError(f"missing dollar total: {completion}")
        if len(completion.split()) > 12:
            raise ValueError(f"receipt too long: {completion}")


def write_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(json.dumps(row, sort_keys=True) for row in rows) + "\n")


def main() -> None:
    output_dir = Path("data/effect_coffee_sft")
    final_rows = final_response_rows()
    trajectory_rows = tool_trajectory_rows()
    product_final_rows = product_behavior_final_response_rows()
    product_trajectory_rows = product_behavior_tool_trajectory_rows()
    validate_final_response_rows(final_rows)
    validate_final_response_rows(product_final_rows)
    write_jsonl(output_dir / "receipt_final_response_sft.jsonl", final_rows)
    write_jsonl(output_dir / "receipt_tool_trajectory_sft.jsonl", trajectory_rows)
    write_jsonl(output_dir / "product_behavior_final_response_sft.jsonl", product_final_rows)
    write_jsonl(output_dir / "product_behavior_tool_trajectory_sft.jsonl", product_trajectory_rows)
    (output_dir / "README.md").write_text(
        "\n".join(
            [
                "# Effect Coffee Receipt SFT Data",
                "",
                "Generated deterministic receipt-format and product-behavior corpora.",
                "",
                "- `receipt_final_response_sft.jsonl`: prompt/completion rows focused on final receipt wording.",
                "- `receipt_tool_trajectory_sft.jsonl`: raw messages rows with tool calls, tool results, and final receipts.",
                "- `product_behavior_final_response_sft.jsonl`: prompt/completion rows for broader cashier behavior.",
                "- `product_behavior_tool_trajectory_sft.jsonl`: raw messages rows for broader cashier behavior.",
                "",
                f"Final-response rows: {len(final_rows)}",
                f"Tool-trajectory rows: {len(trajectory_rows)}",
                f"Product-behavior final-response rows: {len(product_final_rows)}",
                f"Product-behavior tool-trajectory rows: {len(product_trajectory_rows)}",
                "",
                "Validation rules: successful receipts use exact `$x.xx` totals, avoid cents/wrong-currency wording, and stay short.",
                "",
            ]
        )
    )
    print(
        json.dumps(
            {
                "final_response_rows": len(final_rows),
                "product_behavior_final_response_rows": len(product_final_rows),
                "product_behavior_tool_trajectory_rows": len(product_trajectory_rows),
                "tool_trajectory_rows": len(trajectory_rows),
            },
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
