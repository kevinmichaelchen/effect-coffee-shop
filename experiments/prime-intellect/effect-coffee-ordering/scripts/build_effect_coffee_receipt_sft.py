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
Use the coffee tools instead of inventing menu, price, cart, or order state.
Use get_item_options for a specific drink's defaults and valid options.
Use validate_order or quote_order before placing an order when options, price, or defaults are uncertain.
Use place_order for a complete one-shot order. Use cart tools for multi-item cart workflows, then checkout_cart.
Safe defaults are allowed: medium size when size is missing, whole milk for milk-capable drinks, none for no-milk drinks, the drink's default temperature, one espresso shot, zero tea shots, and quantity one.
Ask one short clarifying question when the drink, customer name, or another order-critical field is missing.
After place_order or checkout_cart succeeds, stop using tools and give one concise confirmation with drink summary, order id, and exact $x.xx total.
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

PRODUCT_CART_EXAMPLES = [
    (
        "Can you start a cart with a medium oat latte for Ava and a small espresso for Ben?",
        [
            ("latte", "medium", "oat", "hot", 1, 1, ""),
            ("espresso", "small", "none", "hot", 1, 1, ""),
        ],
        "Ava",
        None,
    ),
    (
        "Start a cart by adding a cappuccino by mistake. Remove it and make the cart a large iced americano for Jo.",
        [
            ("americano", "large", "none", "iced", 1, 1, ""),
        ],
        "Jo",
        ("cappuccino", "medium", "whole", "hot", 1, 1, ""),
    ),
]

PRODUCT_REFUSAL_EXAMPLES = [
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


def multi_order_payload(
    item_specs: list[tuple[str, str, str, str, int, int, str]],
    customer_name: str,
) -> dict[str, Any]:
    items = []
    for drink_id, size, milk, temperature, shots, quantity, notes in item_specs:
        item = MENU[drink_id]
        unit_price_cents = calculate_price_cents(drink_id, size, shots)
        items.append(
            {
                "drink_id": drink_id,
                "drink_name": item["name"],
                "line_total_cents": unit_price_cents * quantity,
                "milk": milk,
                "notes": notes,
                "quantity": quantity,
                "shots": shots,
                "size": size,
                "temperature": temperature,
                "unit_price_cents": unit_price_cents,
            }
        )
    first = items[0]
    total = sum(item["line_total_cents"] for item in items)
    return {
        "customer_name": customer_name,
        "drink_id": first["drink_id"],
        "drink_name": first["drink_name"],
        "id": "order-simulated-0001",
        "items": items,
        "milk": first["milk"],
        "notes": first["notes"],
        "price_cents": total,
        "quantity": first["quantity"],
        "shots": first["shots"],
        "size": first["size"],
        "status": "pending",
        "temperature": first["temperature"],
        "total_price_cents": total,
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
    for question, item_specs, customer_name, _mistaken_item in PRODUCT_CART_EXAMPLES:
        order = multi_order_payload(item_specs, customer_name)
        prompt = "\n".join(
            [
                SYSTEM_PROMPT,
                "",
                f"User request: {question}",
                f"checkout_cart result: {tool_result(order)}",
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
    for index, (question, item_specs, customer_name, mistaken_item) in enumerate(PRODUCT_CART_EXAMPLES, 1):
        order = multi_order_payload(item_specs, customer_name)
        cart_items: list[dict[str, Any]] = []
        messages: list[dict[str, Any]] = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": question},
        ]
        if mistaken_item is not None:
            drink_id, size, milk, temperature, shots, quantity, notes = mistaken_item
            mistaken_order = multi_order_payload([mistaken_item], customer_name)
            mistaken_payload = mistaken_order["items"][0]
            mistaken_cart_item = {"cart_item_id": "cart-item-0001", "item": mistaken_payload}
            add_call_id = f"call_product_cart_mistake_add_{index:04d}"
            remove_call_id = f"call_product_cart_mistake_remove_{index:04d}"
            messages.extend(
                [
                    {
                        "role": "assistant",
                        "content": "",
                        "tool_calls": [
                            {
                                "id": add_call_id,
                                "type": "function",
                                "function": {
                                    "name": "add_cart_item",
                                    "arguments": json.dumps(
                                        {
                                            "drink_id": drink_id,
                                            "milk": milk,
                                            "notes": notes,
                                            "quantity": quantity,
                                            "shots": shots,
                                            "size": size,
                                            "temperature": temperature,
                                        },
                                        sort_keys=True,
                                    ),
                                },
                            }
                        ],
                    },
                    {
                        "role": "tool",
                        "tool_call_id": add_call_id,
                        "name": "add_cart_item",
                        "content": json.dumps(
                            {
                                "ok": True,
                                "cart": {
                                    "items": [mistaken_cart_item],
                                    "total_price_cents": mistaken_payload["line_total_cents"],
                                },
                            },
                            sort_keys=True,
                        ),
                    },
                    {
                        "role": "assistant",
                        "content": "",
                        "tool_calls": [
                            {
                                "id": remove_call_id,
                                "type": "function",
                                "function": {
                                    "name": "remove_cart_item",
                                    "arguments": json.dumps({"cart_item_id": "cart-item-0001"}, sort_keys=True),
                                },
                            }
                        ],
                    },
                    {
                        "role": "tool",
                        "tool_call_id": remove_call_id,
                        "name": "remove_cart_item",
                        "content": json.dumps({"ok": True, "cart": {"items": [], "total_price_cents": 0}}, sort_keys=True),
                    },
                ]
            )
        for item_index, (drink_id, size, milk, temperature, shots, quantity, notes) in enumerate(item_specs, 1):
            call_id = f"call_product_cart_add_{index:04d}_{item_index:04d}"
            item_payload = order["items"][item_index - 1]
            cart_items.append({"cart_item_id": f"cart-item-{item_index:04d}", "item": item_payload})
            messages.extend(
                [
                    {
                        "role": "assistant",
                        "content": "",
                        "tool_calls": [
                            {
                                "id": call_id,
                                "type": "function",
                                "function": {
                                    "name": "add_cart_item",
                                    "arguments": json.dumps(
                                        {
                                            "drink_id": drink_id,
                                            "milk": milk,
                                            "notes": notes,
                                            "quantity": quantity,
                                            "shots": shots,
                                            "size": size,
                                            "temperature": temperature,
                                        },
                                        sort_keys=True,
                                    ),
                                },
                            }
                        ],
                    },
                    {
                        "role": "tool",
                        "tool_call_id": call_id,
                        "name": "add_cart_item",
                        "content": json.dumps(
                            {
                                "ok": True,
                                "cart": {
                                    "items": cart_items,
                                    "total_price_cents": sum(
                                        cart_item["item"]["line_total_cents"] for cart_item in cart_items
                                    ),
                                },
                            },
                            sort_keys=True,
                        ),
                    },
                ]
            )
        call_id = f"call_product_cart_checkout_{index:04d}"
        messages.extend(
            [
                {
                    "role": "assistant",
                    "content": "",
                    "tool_calls": [
                        {
                            "id": call_id,
                            "type": "function",
                            "function": {
                                "name": "checkout_cart",
                                "arguments": json.dumps({"customer_name": customer_name}, sort_keys=True),
                            },
                        }
                    ],
                },
                {"role": "tool", "tool_call_id": call_id, "name": "checkout_cart", "content": tool_result(order)},
                {"role": "assistant", "content": final_receipt(order)},
            ]
        )
        rows.append({"messages": messages})
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
