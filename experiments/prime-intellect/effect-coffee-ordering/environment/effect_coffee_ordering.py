import json
from typing import Any

from datasets import Dataset
import verifiers as vf


MENU = [
    {
        "id": "espresso",
        "name": "Espresso",
        "kind": "espresso",
        "base_price_cents": 300,
        "available_milks": ["none"],
        "available_temperatures": ["hot"],
        "max_shots": 4,
    },
    {
        "id": "americano",
        "name": "Americano",
        "kind": "espresso",
        "base_price_cents": 350,
        "available_milks": ["none"],
        "available_temperatures": ["hot", "iced"],
        "max_shots": 4,
    },
    {
        "id": "latte",
        "name": "Latte",
        "kind": "espresso",
        "base_price_cents": 450,
        "available_milks": ["whole", "oat", "almond", "none"],
        "available_temperatures": ["hot", "iced", "extra-hot"],
        "max_shots": 4,
    },
    {
        "id": "cappuccino",
        "name": "Cappuccino",
        "kind": "espresso",
        "base_price_cents": 425,
        "available_milks": ["whole", "oat", "almond", "none"],
        "available_temperatures": ["hot", "extra-hot"],
        "max_shots": 4,
    },
    {
        "id": "cold-brew",
        "name": "Cold Brew",
        "kind": "espresso",
        "base_price_cents": 400,
        "available_milks": ["whole", "oat", "almond", "none"],
        "available_temperatures": ["iced"],
        "max_shots": 2,
    },
    {
        "id": "tea",
        "name": "Tea",
        "kind": "tea",
        "base_price_cents": 325,
        "available_milks": ["none"],
        "available_temperatures": ["hot", "iced"],
        "max_shots": 0,
    },
]

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


TRAIN_TASKS = [
    {
        "question": "Please order a large iced oat latte with two shots for Avery.",
        "info": {
            "expected_action": "place_order",
            "expected_order": {
                "drink_id": "latte",
                "size": "large",
                "milk": "oat",
                "temperature": "iced",
                "shots": 2,
                "customer_name": "Avery",
            },
        },
    },
    {
        "question": "Can I get a small hot espresso for Mina?",
        "info": {
            "expected_action": "place_order",
            "expected_order": {
                "drink_id": "espresso",
                "size": "small",
                "milk": "none",
                "temperature": "hot",
                "shots": 1,
                "customer_name": "Mina",
            },
        },
    },
    {
        "question": "Please make Kai a medium iced americano.",
        "info": {
            "expected_action": "place_order",
            "expected_order": {
                "drink_id": "americano",
                "size": "medium",
                "milk": "none",
                "temperature": "iced",
                "shots": 1,
                "customer_name": "Kai",
            },
        },
    },
    {
        "question": "I'd like a large iced cold brew with whole milk for Priya.",
        "info": {
            "expected_action": "place_order",
            "expected_order": {
                "drink_id": "cold-brew",
                "size": "large",
                "milk": "whole",
                "temperature": "iced",
                "shots": 1,
                "customer_name": "Priya",
            },
        },
    },
    {
        "question": "A small iced tea for Devon, please.",
        "info": {
            "expected_action": "place_order",
            "expected_order": {
                "drink_id": "tea",
                "size": "small",
                "milk": "none",
                "temperature": "iced",
                "shots": 0,
                "customer_name": "Devon",
            },
        },
    },
    {
        "question": "Order a medium extra-hot almond cappuccino for Jules.",
        "info": {
            "expected_action": "place_order",
            "expected_order": {
                "drink_id": "cappuccino",
                "size": "medium",
                "milk": "almond",
                "temperature": "extra-hot",
                "shots": 1,
                "customer_name": "Jules",
            },
        },
    },
    {
        "question": "Ring up a medium hot latte with whole milk for Blair. Final receipt should include the total in dollars.",
        "info": {
            "expected_action": "place_order",
            "expected_order": {
                "drink_id": "latte",
                "size": "medium",
                "milk": "whole",
                "temperature": "hot",
                "shots": 1,
                "customer_name": "Blair",
            },
        },
    },
    {
        "question": "Please order a large iced americano for Ellis and confirm with the order id and dollar total.",
        "info": {
            "expected_action": "place_order",
            "expected_order": {
                "drink_id": "americano",
                "size": "large",
                "milk": "none",
                "temperature": "iced",
                "shots": 1,
                "customer_name": "Ellis",
            },
        },
    },
    {
        "question": "Sam wants a small hot espresso. Keep the receipt to one sentence with the price as dollars.",
        "info": {
            "expected_action": "place_order",
            "expected_order": {
                "drink_id": "espresso",
                "size": "small",
                "milk": "none",
                "temperature": "hot",
                "shots": 1,
                "customer_name": "Sam",
            },
        },
    },
    {
        "question": "Create a large iced cold brew with almond milk and two shots for Riley. Say the exact dollar total.",
        "info": {
            "expected_action": "place_order",
            "expected_order": {
                "drink_id": "cold-brew",
                "size": "large",
                "milk": "almond",
                "temperature": "iced",
                "shots": 2,
                "customer_name": "Riley",
            },
        },
    },
    {
        "question": "Put in a small iced tea for Harper and only confirm drink, order id, and total.",
        "info": {
            "expected_action": "place_order",
            "expected_order": {
                "drink_id": "tea",
                "size": "small",
                "milk": "none",
                "temperature": "iced",
                "shots": 0,
                "customer_name": "Harper",
            },
        },
    },
    {
        "question": "Order a medium extra-hot cappuccino with oat milk for Noor. The final total must be in dollars.",
        "info": {
            "expected_action": "place_order",
            "expected_order": {
                "drink_id": "cappuccino",
                "size": "medium",
                "milk": "oat",
                "temperature": "extra-hot",
                "shots": 1,
                "customer_name": "Noor",
            },
        },
    },
    {
        "question": "What can I get iced?",
        "info": {
            "expected_action": "list_menu",
            "required_terms": ["Americano", "Latte", "Cold Brew", "Tea"],
        },
    },
    {
        "question": "Which drinks can use oat milk?",
        "info": {
            "expected_action": "list_menu",
            "required_terms": ["Latte", "Cappuccino", "Cold Brew"],
        },
    },
    {
        "question": "Which drinks do not allow milk?",
        "info": {
            "expected_action": "list_menu",
            "required_terms": ["Espresso", "Americano", "Tea"],
        },
    },
    {
        "question": "I'd like a cold brew with four shots.",
        "info": {
            "expected_action": "refuse",
            "required_terms": ["cold brew", "2", "shots"],
        },
    },
    {
        "question": "Please order an extra-hot cold brew for Lee.",
        "info": {
            "expected_action": "refuse",
            "required_terms": ["cold brew", "iced"],
        },
    },
    {
        "question": "Can you make tea with oat milk for Morgan?",
        "info": {
            "expected_action": "refuse",
            "required_terms": ["tea", "milk", "none"],
        },
    },
    {
        "question": "Can you make an iced espresso with oat milk?",
        "info": {
            "expected_action": "refuse",
            "required_terms": ["espresso", "hot", "milk"],
        },
    },
    {
        "question": "Make a large mocha with almond milk for Robin.",
        "info": {
            "expected_action": "refuse",
            "required_terms": ["mocha", "menu", "latte"],
        },
    },
]

EVAL_TASKS = [
    {
        "question": "Order a medium hot whole milk latte with one shot for Rowan.",
        "info": {
            "expected_action": "place_order",
            "expected_order": {
                "drink_id": "latte",
                "size": "medium",
                "milk": "whole",
                "temperature": "hot",
                "shots": 1,
                "customer_name": "Rowan",
            },
        },
    },
    {
        "question": "Do you have drinks that come extra hot?",
        "info": {
            "expected_action": "list_menu",
            "required_terms": ["Latte", "Cappuccino"],
        },
    },
    {
        "question": "Please order a large iced americano for Tessa.",
        "info": {
            "expected_action": "place_order",
            "expected_order": {
                "drink_id": "americano",
                "size": "large",
                "milk": "none",
                "temperature": "iced",
                "shots": 1,
                "customer_name": "Tessa",
            },
        },
    },
    {
        "question": "I'd like a medium iced cold brew with two shots and oat milk for Aria.",
        "info": {
            "expected_action": "place_order",
            "expected_order": {
                "drink_id": "cold-brew",
                "size": "medium",
                "milk": "oat",
                "temperature": "iced",
                "shots": 2,
                "customer_name": "Aria",
            },
        },
    },
    {
        "question": "What can I order without milk?",
        "info": {
            "expected_action": "list_menu",
            "required_terms": ["Espresso", "Americano", "Tea"],
        },
    },
    {
        "question": "I want a large iced tea with almond milk for Sam.",
        "info": {
            "expected_action": "refuse",
            "required_terms": ["tea", "milk", "none"],
        },
    },
    {
        "question": "Make an extra-hot americano for Casey.",
        "info": {
            "expected_action": "refuse",
            "required_terms": ["americano", "hot", "iced"],
        },
    },
    {
        "question": "Order a small matcha with whole milk.",
        "info": {
            "expected_action": "refuse",
            "required_terms": ["matcha", "menu"],
        },
    },
]

HARD_EVAL_TASKS = [
    {
        "question": "Can you ring up a medium hot whole milk latte for Nia? Please include the final total in dollars.",
        "info": {
            "expected_action": "place_order",
            "expected_order": {
                "drink_id": "latte",
                "size": "medium",
                "milk": "whole",
                "temperature": "hot",
                "shots": 1,
                "customer_name": "Nia",
            },
        },
    },
    {
        "question": "Avery wants a large iced latte with oat milk and two shots. Keep the confirmation short.",
        "info": {
            "expected_action": "place_order",
            "expected_order": {
                "drink_id": "latte",
                "size": "large",
                "milk": "oat",
                "temperature": "iced",
                "shots": 2,
                "customer_name": "Avery",
            },
        },
    },
    {
        "question": "Please put in a small hot espresso for Mina and tell me the price as dollars.",
        "info": {
            "expected_action": "place_order",
            "expected_order": {
                "drink_id": "espresso",
                "size": "small",
                "milk": "none",
                "temperature": "hot",
                "shots": 1,
                "customer_name": "Mina",
            },
        },
    },
    {
        "question": "Tessa needs a large iced americano. Confirm only the drink, order id, and total.",
        "info": {
            "expected_action": "place_order",
            "expected_order": {
                "drink_id": "americano",
                "size": "large",
                "milk": "none",
                "temperature": "iced",
                "shots": 1,
                "customer_name": "Tessa",
            },
        },
    },
    {
        "question": "Aria wants a medium iced cold brew with oat milk and two shots; give a one sentence receipt.",
        "info": {
            "expected_action": "place_order",
            "expected_order": {
                "drink_id": "cold-brew",
                "size": "medium",
                "milk": "oat",
                "temperature": "iced",
                "shots": 2,
                "customer_name": "Aria",
            },
        },
    },
    {
        "question": "Can I get a medium hot americano with whole milk for Quinn? If not, tell me exactly why.",
        "info": {
            "expected_action": "refuse",
            "required_terms": ["americano", "milk", "none"],
        },
    },
    {
        "question": "Which drinks are iced and dairy-free without changing the milk setting?",
        "info": {
            "expected_action": "list_menu",
            "required_terms": ["Americano", "Tea"],
        },
    },
    {
        "question": "I want an extra-hot cold brew for Lee. Do not place it if that is impossible.",
        "info": {
            "expected_action": "refuse",
            "required_terms": ["cold brew", "iced"],
        },
    },
]

RECEIPT_DRILL_TASKS = [
    {
        "question": "Order a medium hot whole milk latte with one shot for Rowan. Final reply must be exactly one short receipt with drink, order id, and dollar total.",
        "info": {
            "expected_action": "place_order",
            "expected_order": {
                "drink_id": "latte",
                "size": "medium",
                "milk": "whole",
                "temperature": "hot",
                "shots": 1,
                "customer_name": "Rowan",
            },
        },
    },
    {
        "question": "Can you ring up a large iced oat latte with two shots for Avery? Confirm only drink, order id, and `$x.xx` total.",
        "info": {
            "expected_action": "place_order",
            "expected_order": {
                "drink_id": "latte",
                "size": "large",
                "milk": "oat",
                "temperature": "iced",
                "shots": 2,
                "customer_name": "Avery",
            },
        },
    },
    {
        "question": "Please put in a small hot espresso for Mina. End with one concise receipt using dollars, not cents.",
        "info": {
            "expected_action": "place_order",
            "expected_order": {
                "drink_id": "espresso",
                "size": "small",
                "milk": "none",
                "temperature": "hot",
                "shots": 1,
                "customer_name": "Mina",
            },
        },
    },
    {
        "question": "Tessa needs a large iced americano. Confirm only the drink, order id, and exact dollar total.",
        "info": {
            "expected_action": "place_order",
            "expected_order": {
                "drink_id": "americano",
                "size": "large",
                "milk": "none",
                "temperature": "iced",
                "shots": 1,
                "customer_name": "Tessa",
            },
        },
    },
    {
        "question": "Aria wants a medium iced cold brew with oat milk and two shots. Give a one-sentence receipt with `$x.xx` price.",
        "info": {
            "expected_action": "place_order",
            "expected_order": {
                "drink_id": "cold-brew",
                "size": "medium",
                "milk": "oat",
                "temperature": "iced",
                "shots": 2,
                "customer_name": "Aria",
            },
        },
    },
    {
        "question": "Order a medium extra-hot almond cappuccino for Jules. Keep the final receipt under twelve words.",
        "info": {
            "expected_action": "place_order",
            "expected_order": {
                "drink_id": "cappuccino",
                "size": "medium",
                "milk": "almond",
                "temperature": "extra-hot",
                "shots": 1,
                "customer_name": "Jules",
            },
        },
    },
    {
        "question": "A small iced tea for Devon, please. Receipt only: drink, order id, dollar total.",
        "info": {
            "expected_action": "place_order",
            "expected_order": {
                "drink_id": "tea",
                "size": "small",
                "milk": "none",
                "temperature": "iced",
                "shots": 0,
                "customer_name": "Devon",
            },
        },
    },
    {
        "question": "Make Priya a large iced cold brew with whole milk. Do not mention cents in the receipt.",
        "info": {
            "expected_action": "place_order",
            "expected_order": {
                "drink_id": "cold-brew",
                "size": "large",
                "milk": "whole",
                "temperature": "iced",
                "shots": 1,
                "customer_name": "Priya",
            },
        },
    },
    {
        "question": "Blair wants a medium hot latte with whole milk. Reply with a compact receipt and dollar total.",
        "info": {
            "expected_action": "place_order",
            "expected_order": {
                "drink_id": "latte",
                "size": "medium",
                "milk": "whole",
                "temperature": "hot",
                "shots": 1,
                "customer_name": "Blair",
            },
        },
    },
    {
        "question": "Ellis needs a large iced americano. After placing it, stop using tools and give the receipt.",
        "info": {
            "expected_action": "place_order",
            "expected_order": {
                "drink_id": "americano",
                "size": "large",
                "milk": "none",
                "temperature": "iced",
                "shots": 1,
                "customer_name": "Ellis",
            },
        },
    },
    {
        "question": "Sam wants a small hot espresso. Final answer should be short and include `$x.xx`.",
        "info": {
            "expected_action": "place_order",
            "expected_order": {
                "drink_id": "espresso",
                "size": "small",
                "milk": "none",
                "temperature": "hot",
                "shots": 1,
                "customer_name": "Sam",
            },
        },
    },
    {
        "question": "Create a large iced cold brew with almond milk and two shots for Riley. Give only the receipt.",
        "info": {
            "expected_action": "place_order",
            "expected_order": {
                "drink_id": "cold-brew",
                "size": "large",
                "milk": "almond",
                "temperature": "iced",
                "shots": 2,
                "customer_name": "Riley",
            },
        },
    },
    {
        "question": "Put in a small iced tea for Harper. Confirm with drink, order id, and exact dollar total.",
        "info": {
            "expected_action": "place_order",
            "expected_order": {
                "drink_id": "tea",
                "size": "small",
                "milk": "none",
                "temperature": "iced",
                "shots": 0,
                "customer_name": "Harper",
            },
        },
    },
    {
        "question": "Order a medium extra-hot cappuccino with oat milk for Noor. The final total must be in dollars.",
        "info": {
            "expected_action": "place_order",
            "expected_order": {
                "drink_id": "cappuccino",
                "size": "medium",
                "milk": "oat",
                "temperature": "extra-hot",
                "shots": 1,
                "customer_name": "Noor",
            },
        },
    },
    {
        "question": "Kai would like a medium iced americano. Receipt format: drink order id `$x.xx`.",
        "info": {
            "expected_action": "place_order",
            "expected_order": {
                "drink_id": "americano",
                "size": "medium",
                "milk": "none",
                "temperature": "iced",
                "shots": 1,
                "customer_name": "Kai",
            },
        },
    },
    {
        "question": "Morgan wants a small hot latte with almond milk. Keep the confirmation to one sentence.",
        "info": {
            "expected_action": "place_order",
            "expected_order": {
                "drink_id": "latte",
                "size": "small",
                "milk": "almond",
                "temperature": "hot",
                "shots": 1,
                "customer_name": "Morgan",
            },
        },
    },
    {
        "question": "Casey needs a large extra-hot cappuccino with whole milk. Return a short receipt with dollars.",
        "info": {
            "expected_action": "place_order",
            "expected_order": {
                "drink_id": "cappuccino",
                "size": "large",
                "milk": "whole",
                "temperature": "extra-hot",
                "shots": 1,
                "customer_name": "Casey",
            },
        },
    },
    {
        "question": "Please ring up a medium iced latte with oat milk and three shots for Nia. Receipt only, exact `$x.xx` price.",
        "info": {
            "expected_action": "place_order",
            "expected_order": {
                "drink_id": "latte",
                "size": "medium",
                "milk": "oat",
                "temperature": "iced",
                "shots": 3,
                "customer_name": "Nia",
            },
        },
    },
    {
        "question": "Can I get a medium hot americano with whole milk for Quinn?",
        "info": {
            "expected_action": "refuse",
            "required_terms": ["Americano", "milk", "none"],
        },
    },
    {
        "question": "Please order an extra-hot cold brew for Lee.",
        "info": {
            "expected_action": "refuse",
            "required_terms": ["Cold Brew", "iced"],
        },
    },
    {
        "question": "Can you make tea with oat milk for Morgan?",
        "info": {
            "expected_action": "refuse",
            "required_terms": ["Tea", "milk", "none"],
        },
    },
    {
        "question": "Make a large mocha with almond milk for Robin.",
        "info": {
            "expected_action": "refuse",
            "required_terms": ["mocha", "menu", "latte"],
        },
    },
]


async def list_menu() -> str:
    """List the current coffee menu.

    Returns:
        A JSON payload containing all available drinks and customization limits.
    """
    return json.dumps({"menu": MENU}, sort_keys=True)


async def place_order(
    drink_id: str,
    size: str,
    milk: str = "",
    temperature: str = "",
    shots: int = 1,
    customer_name: str = "",
    notes: str = "",
) -> str:
    """Create a simulated coffee order if the requested options are valid.

    Args:
        drink_id: Menu drink id, such as latte, espresso, cold-brew, or tea.
        size: Drink size: small, medium, or large.
        milk: Milk choice. Use none when milk is unavailable or not requested.
        temperature: Drink temperature: hot, iced, or extra-hot.
        shots: Espresso shot count.
        customer_name: Customer name for the order.
        notes: Optional preparation notes.

    Returns:
        A JSON payload with either the accepted order or a validation error.
    """
    item = find_menu_item(drink_id)
    if item is None:
        return json.dumps(
            {"ok": False, "error": f"Unknown drink id: {drink_id}. Use list_menu first."},
            sort_keys=True,
        )

    normalized_milk = milk or default_milk(item)
    normalized_temperature = temperature or default_temperature(item)

    validation_error = validate_order(item, size, normalized_milk, normalized_temperature, shots)
    if validation_error is not None:
        return json.dumps({"ok": False, "error": validation_error}, sort_keys=True)

    order = {
        "id": "order-simulated-0001",
        "customer_name": customer_name,
        "drink_id": item["id"],
        "drink_name": item["name"],
        "size": size,
        "milk": normalized_milk,
        "temperature": normalized_temperature,
        "shots": shots,
        "notes": notes,
        "price_cents": calculate_price_cents(item, size, shots),
        "status": "pending",
    }
    return json.dumps({"ok": True, "order": order}, sort_keys=True)


def find_menu_item(drink_id: str) -> dict[str, Any] | None:
    matches = [item for item in MENU if item["id"] == drink_id]
    return matches[0] if matches else None


def default_milk(item: dict[str, Any]) -> str:
    milks = item["available_milks"]
    return "whole" if "whole" in milks else milks[0]


def default_temperature(item: dict[str, Any]) -> str:
    return item["available_temperatures"][0]


def validate_order(
    item: dict[str, Any],
    size: str,
    milk: str,
    temperature: str,
    shots: int,
) -> str | None:
    if size not in SIZE_MULTIPLIERS:
        return f"Unsupported size: {size}."
    if milk not in item["available_milks"]:
        return f"{item['name']} does not support milk option {milk}."
    if temperature not in item["available_temperatures"]:
        return f"{item['name']} does not support temperature {temperature}."
    if shots < 0 or shots > item["max_shots"]:
        return f"{item['name']} supports at most {item['max_shots']} shots."
    return None


def calculate_price_cents(item: dict[str, Any], size: str, shots: int) -> int:
    scaled_base = round(item["base_price_cents"] * SIZE_MULTIPLIERS[size])
    included_shots = 0 if item["kind"] == "tea" else 1
    extra_shots = max(shots - included_shots, 0)
    return scaled_base + extra_shots * 75


async def tool_correctness(completion, info) -> float:
    expected_action = info["expected_action"]
    text = completion_text(completion)

    if expected_action == "place_order":
        order = accepted_order(completion)
        expected_order = info["expected_order"]
        if order is None:
            return 0.0
        checks = [
            order.get("drink_id") == expected_order["drink_id"],
            order.get("size") == expected_order["size"],
            order.get("milk") == expected_order["milk"],
            order.get("temperature") == expected_order["temperature"],
            order.get("shots") == expected_order["shots"],
            order.get("customer_name") == expected_order["customer_name"],
        ]
        return sum(1.0 for check in checks if check) / len(checks)

    if expected_action == "list_menu":
        has_menu_tool_result = any("available_temperatures" in content for content in tool_contents(completion))
        required_terms = info["required_terms"]
        term_score = sum(1.0 for term in required_terms if term.lower() in text.lower()) / len(
            required_terms
        )
        return 0.5 * float(has_menu_tool_result) + 0.5 * term_score

    placed_order = accepted_order(completion)
    required_terms = info["required_terms"]
    term_score = sum(1.0 for term in required_terms if term.lower() in text.lower()) / len(
        required_terms
    )
    return 0.5 * float(placed_order is None) + 0.5 * term_score


async def final_response_quality(completion, info) -> float:
    text = final_assistant_text(completion).lower()
    expected_action = info["expected_action"]

    if expected_action == "place_order":
        order = accepted_order(completion)
        if order is None:
            return 0.0
        required_terms = [order["drink_name"], order["id"], cents_to_dollars(order["price_cents"])]
        required_score = sum(1.0 for term in required_terms if str(term).lower() in text) / len(required_terms)
        concise_score = concise_text_score(text, max_words=32)
        return 0.75 * required_score + 0.25 * concise_score

    if expected_action == "list_menu":
        required_terms = info["required_terms"]
        term_score = sum(1.0 for term in required_terms if term.lower() in text) / len(required_terms)
        return 0.7 * term_score + 0.3 * concise_text_score(text, max_words=60)

    refusal_terms = ["can't", "cannot", "not available", "instead", "valid", "only", "max"]
    refusal_score = float(any(term in text for term in refusal_terms))
    required_terms = info["required_terms"]
    term_score = sum(1.0 for term in required_terms if term.lower() in text) / len(required_terms)
    return 0.5 * refusal_score + 0.3 * term_score + 0.2 * concise_text_score(text, max_words=36)


async def price_format(completion, info) -> float:
    if info["expected_action"] != "place_order":
        return 1.0

    order = accepted_order(completion)
    if order is None:
        return 0.0

    text = final_assistant_text(completion).lower()
    expected_price = cents_to_dollars(order["price_cents"]).lower()
    wrong_markers = ["₹", " cents", " cent", f"${order['price_cents']}"]
    return float(expected_price in text and not any(marker in text for marker in wrong_markers))


async def receipt_style(completion, info) -> float:
    if info["expected_action"] != "place_order":
        return 1.0

    order = accepted_order(completion)
    final_text = final_assistant_text(completion)
    if order is None or final_text == "":
        return 0.0

    normalized_text = final_text.lower()
    expected_price = cents_to_dollars(order["price_cents"]).lower()
    checks = [
        order["drink_name"].lower() in normalized_text,
        order["id"].lower() in normalized_text,
        expected_price in normalized_text,
        "cent" not in normalized_text,
        "₹" not in normalized_text,
        len(final_text.split()) <= 24,
        no_tools_after_success(completion),
    ]
    return sum(1.0 for check in checks if check) / len(checks)


async def product_efficiency(completion, info) -> float:
    expected_action = info["expected_action"]
    payloads = tool_payloads(completion)
    menu_calls = count_menu_results(payloads)
    order_calls = count_order_results(payloads)
    final_text = final_assistant_text(completion)

    if expected_action == "place_order":
        order = accepted_order(completion)
        checks = [
            menu_calls <= 1,
            order_calls == 1,
            order is not None,
            no_tools_after_success(completion),
            final_text != "",
            concise_text_score(final_text, max_words=32) >= 0.75,
            price_text_is_exact_dollars(final_text, order),
        ]
        return sum(1.0 for check in checks if check) / len(checks)

    if expected_action == "list_menu":
        checks = [
            menu_calls == 1,
            order_calls == 0,
            final_text != "",
            concise_text_score(final_text, max_words=60) >= 0.75,
        ]
        return sum(1.0 for check in checks if check) / len(checks)

    checks = [
        order_calls == 0,
        menu_calls <= 1,
        final_text != "",
        concise_text_score(final_text, max_words=36) >= 0.75,
    ]
    return sum(1.0 for check in checks if check) / len(checks)


def completion_text(completion) -> str:
    return "\n".join(message_content(message) for message in completion)


def final_assistant_text(completion) -> str:
    assistant_messages = [
        message_content(message)
        for message in completion
        if message_role(message) == "assistant" and not message_tool_calls(message)
    ]
    return assistant_messages[-1] if assistant_messages else ""


def accepted_order(completion) -> dict[str, Any] | None:
    payloads = tool_payloads(completion)
    orders = [
        payload["order"]
        for payload in payloads
        if isinstance(payload, dict) and payload.get("ok") is True and isinstance(payload.get("order"), dict)
    ]
    return orders[-1] if orders else None


def tool_payloads(completion) -> list[Any]:
    return [json_payload(content) for content in tool_contents(completion)]


def count_menu_results(payloads: list[Any]) -> int:
    return sum(1 for payload in payloads if isinstance(payload, dict) and isinstance(payload.get("menu"), list))


def count_order_results(payloads: list[Any]) -> int:
    return sum(1 for payload in payloads if isinstance(payload, dict) and "ok" in payload)


def no_tools_after_success(completion) -> bool:
    saw_success = False
    for message in completion:
        if message_role(message) != "tool":
            continue
        payload = json_payload(message_content(message))
        if saw_success:
            return False
        if isinstance(payload, dict) and payload.get("ok") is True:
            saw_success = True
    return saw_success


def concise_text_score(text: str, max_words: int) -> float:
    words = text.split()
    if not words:
        return 0.0
    if len(words) <= max_words:
        return 1.0
    if len(words) >= max_words * 2:
        return 0.0
    return 1.0 - ((len(words) - max_words) / max_words)


def price_text_is_exact_dollars(text: str, order: dict[str, Any] | None) -> bool:
    if order is None:
        return False
    normalized_text = text.lower()
    expected_price = cents_to_dollars(order["price_cents"]).lower()
    wrong_markers = ["₹", " cents", " cent", f"${order['price_cents']}"]
    return expected_price in normalized_text and not any(marker in normalized_text for marker in wrong_markers)


def tool_contents(completion) -> list[str]:
    return [message_content(message) for message in completion if message_role(message) == "tool"]


def message_role(message) -> str:
    return getattr(message, "role", message.get("role", "") if isinstance(message, dict) else "")


def message_content(message) -> str:
    content = getattr(message, "content", message.get("content", "") if isinstance(message, dict) else "")
    return content if isinstance(content, str) else str(content)


def message_tool_calls(message) -> Any:
    return getattr(message, "tool_calls", message.get("tool_calls") if isinstance(message, dict) else None)


def json_payload(content: str) -> Any:
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        return None


def cents_to_dollars(cents: int) -> str:
    return f"${cents / 100:.2f}"


def to_dataset(rows: list[dict[str, Any]]) -> Dataset:
    return Dataset.from_list(
        [
            {
                "question": row["question"],
                "info": json.dumps(row["info"], sort_keys=True),
            }
            for row in rows
        ]
    )


def load_environment(split: str = "train", num_examples: int = -1, **kwargs) -> vf.Environment:
    """Load the Effect Coffee Shop ordering environment."""
    train_dataset = to_dataset(TRAIN_TASKS)
    eval_dataset = to_dataset(EVAL_TASKS)
    hard_eval_dataset = to_dataset(HARD_EVAL_TASKS)
    receipt_drill_dataset = to_dataset(RECEIPT_DRILL_TASKS)

    datasets = {
        "train": train_dataset,
        "eval": eval_dataset,
        "hard_eval": hard_eval_dataset,
        "receipt_drill": receipt_drill_dataset,
    }
    selected_dataset = datasets.get(split, train_dataset)
    if num_examples > 0:
        selected_dataset = selected_dataset.select(range(min(num_examples, len(selected_dataset))))

    rubric = vf.Rubric(
        funcs=[tool_correctness, final_response_quality, product_efficiency, price_format, receipt_style],
        weights=[0.4, 0.2, 0.15, 0.15, 0.1],
    )

    return vf.ToolEnv(
        dataset=selected_dataset,
        eval_dataset=eval_dataset,
        tools=[list_menu, place_order],
        rubric=rubric,
        system_prompt=SYSTEM_PROMPT,
        max_turns=4,
        **kwargs,
    )
