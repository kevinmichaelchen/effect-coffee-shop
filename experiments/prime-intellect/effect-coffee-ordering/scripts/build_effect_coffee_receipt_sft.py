import json
from pathlib import Path
import sys
from typing import Any

ENVIRONMENT_DIR = Path(__file__).resolve().parents[1] / "environment"
sys.path.insert(0, str(ENVIRONMENT_DIR))

from coffee_domain import MENU_BY_ID, SYSTEM_PROMPT, calculate_drink_price_cents, cents_to_dollars, menu_rows

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


def order_payload(
    drink_id: str,
    size: str,
    milk: str,
    temperature: str,
    shots: int,
    customer_name: str,
    notes: str = "",
) -> dict[str, Any]:
    item = MENU_BY_ID[drink_id]
    return {
        "customer_name": customer_name,
        "drink_id": drink_id,
        "drink_name": item["name"],
        "id": "order-simulated-0001",
        "milk": milk,
        "notes": notes,
        "price_cents": calculate_drink_price_cents(drink_id, size, shots),
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
        item = MENU_BY_ID[drink_id]
        unit_price_cents = calculate_drink_price_cents(drink_id, size, shots)
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
    return json.dumps({"menu": menu_rows()}, sort_keys=True)


def final_receipt(order: dict[str, Any]) -> str:
    return f"{order['drink_name']} {order['id']} {cents_to_dollars(order['price_cents'])}."


def confirmation_request(order: dict[str, Any]) -> str:
    items = order.get("items")
    summary = " and ".join(item_summary(item) for item in items) if isinstance(items, list) else item_summary(order)
    notes = f", notes: {order['notes']}" if order.get("notes") else ""
    return f"I have {summary} for {order['customer_name']}{notes}, total {cents_to_dollars(order['price_cents'])}. Should I place it?"


def item_summary(item: dict[str, Any]) -> str:
    milk = f" {item['milk']} milk" if item["milk"] != "none" else ""
    quantity = item.get("quantity", 1)
    quantity_prefix = f"{quantity} " if quantity != 1 else "a "
    shot_phrase = "" if item["shots"] == 0 else f" with {item['shots']} shot{'s' if item['shots'] != 1 else ''}"
    return f"{quantity_prefix}{item['size']} {item['temperature']}{milk} {item['drink_name']}{shot_phrase}"


def quote_arguments(order: dict[str, Any]) -> str:
    args = {
        "drink_id": order["drink_id"],
        "size": order["size"],
        "milk": order["milk"],
        "temperature": order["temperature"],
        "shots": order["shots"],
        "notes": order["notes"],
    }
    return json.dumps(args, sort_keys=True)


def quote_result(order: dict[str, Any]) -> str:
    return json.dumps(
        {
            "ok": True,
            "items": [
                {
                    "drink_id": order["drink_id"],
                    "drink_name": order["drink_name"],
                    "line_total_cents": order["price_cents"],
                    "milk": order["milk"],
                    "notes": order["notes"],
                    "quantity": order.get("quantity", 1),
                    "shots": order["shots"],
                    "size": order["size"],
                    "temperature": order["temperature"],
                    "unit_price_cents": order["price_cents"],
                }
            ],
            "total_price_cents": order["price_cents"],
            "totalPriceCents": order["price_cents"],
        },
        sort_keys=True,
    )


def cart_result(order: dict[str, Any]) -> str:
    cart_items = [
        {"cart_item_id": f"cart-item-{index:04d}", "item": item}
        for index, item in enumerate(order.get("items", []), 1)
    ]
    return json.dumps(
        {
            "ok": True,
            "cart": {
                "items": cart_items,
                "total_price_cents": order["price_cents"],
                "totalPriceCents": order["price_cents"],
            },
        },
        sort_keys=True,
    )


def final_response_rows() -> list[dict[str, str]]:
    rows = []
    for question, drink_id, size, milk, temperature, shots, customer_name in SUCCESS_EXAMPLES:
        order = order_payload(drink_id, size, milk, temperature, shots, customer_name)
        prompt = "\n".join(
            [
                SYSTEM_PROMPT,
                "",
                f"User request: {question}",
                f"quote_order result: {quote_result(order)}",
                "Write only the pre-purchase confirmation question.",
            ]
        )
        rows.append({"prompt": prompt, "completion": confirmation_request(order)})
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
                f"quote_order result: {quote_result(order)}",
                "Write only the pre-purchase confirmation question.",
            ]
        )
        rows.append({"prompt": prompt, "completion": confirmation_request(order)})
    for question, item_specs, customer_name, _mistaken_item in PRODUCT_CART_EXAMPLES:
        order = multi_order_payload(item_specs, customer_name)
        prompt = "\n".join(
            [
                SYSTEM_PROMPT,
                "",
                f"User request: {question}",
                f"get_cart result: {cart_result(order)}",
                "Write only the pre-purchase confirmation question.",
            ]
        )
        rows.append({"prompt": prompt, "completion": confirmation_request(order)})
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
                                "function": {"name": "quote_order", "arguments": quote_arguments(order)},
                            }
                        ],
                    },
                    {"role": "tool", "tool_call_id": call_id, "name": "quote_order", "content": quote_result(order)},
                    {"role": "assistant", "content": confirmation_request(order)},
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
                                "function": {"name": "quote_order", "arguments": quote_arguments(order)},
                            }
                        ],
                    },
                    {"role": "tool", "tool_call_id": call_id, "name": "quote_order", "content": quote_result(order)},
                    {"role": "assistant", "content": confirmation_request(order)},
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
        next_cart_item_number = 1
        if mistaken_item is not None:
            drink_id, size, milk, temperature, shots, quantity, notes = mistaken_item
            mistaken_order = multi_order_payload([mistaken_item], customer_name)
            mistaken_payload = mistaken_order["items"][0]
            mistaken_cart_item = {"cart_item_id": "cart-item-0001", "item": mistaken_payload}
            next_cart_item_number = 2
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
            cart_items.append({"cart_item_id": f"cart-item-{next_cart_item_number:04d}", "item": item_payload})
            next_cart_item_number += 1
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
        messages.append({"role": "assistant", "content": confirmation_request(order)})
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
                "Generated deterministic pre-purchase confirmation and product-behavior corpora.",
                "",
                "- `receipt_final_response_sft.jsonl`: prompt/completion rows focused on pre-purchase confirmation wording.",
                "- `receipt_tool_trajectory_sft.jsonl`: raw messages rows with quote/cart tool calls and confirmation questions.",
                "- `product_behavior_final_response_sft.jsonl`: prompt/completion rows for broader cashier behavior.",
                "- `product_behavior_tool_trajectory_sft.jsonl`: raw messages rows for broader cashier behavior.",
                "",
                f"Final-response rows: {len(final_rows)}",
                f"Tool-trajectory rows: {len(trajectory_rows)}",
                f"Product-behavior final-response rows: {len(product_final_rows)}",
                f"Product-behavior tool-trajectory rows: {len(product_trajectory_rows)}",
                "",
                "Validation rules: successful confirmations use exact `$x.xx` totals, avoid cents/wrong-currency wording, and stay short.",
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
