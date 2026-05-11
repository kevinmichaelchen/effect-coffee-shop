import asyncio
import json
from typing import Any

from coffee_domain import (
    MENU,
    SIZE_MULTIPLIERS,
    SYSTEM_PROMPT,
    calculate_price_cents,
    cents_to_dollars,
    default_milk,
    default_shots,
    default_temperature,
    find_menu_item,
)
from datasets import Dataset
import verifiers as vf


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

PRODUCT_READINESS_TASKS = [
    {
        "question": "Can you start a cart with a medium oat latte for Ava and a small espresso for Ben?",
        "info": {
            "expected_action": "confirm_order",
            "expected_tool_names": ["add_cart_item"],
            "expected_tool_sequence": ["add_cart_item", "add_cart_item"],
            "expected_tool_counts": {"add_cart_item": 2, "checkout_cart": 0},
            "expected_order": {
                "customer_name": "Ava",
            },
            "required_terms": ["Latte", "Espresso", "Ava", "$8.18", "Should I place"],
            "expected_items": [
                {
                    "drink_id": "latte",
                    "size": "medium",
                    "milk": "oat",
                    "temperature": "hot",
                    "shots": 1,
                    "quantity": 1,
                },
                {
                    "drink_id": "espresso",
                    "size": "small",
                    "milk": "none",
                    "temperature": "hot",
                    "shots": 1,
                    "quantity": 1,
                },
            ],
        },
    },
    {
        "question": "Start a cart by adding a cappuccino by mistake. Remove it and make the cart a large iced americano for Jo.",
        "info": {
            "expected_action": "confirm_order",
            "expected_tool_names": ["add_cart_item", "remove_cart_item"],
            "expected_tool_sequence": ["add_cart_item", "remove_cart_item", "add_cart_item"],
            "expected_tool_counts": {"add_cart_item": 2, "remove_cart_item": 1, "checkout_cart": 0},
            "expected_order": {
                "customer_name": "Jo",
            },
            "required_terms": ["Americano", "Jo", "$4.55", "Should I place"],
            "expected_items": [
                {
                    "drink_id": "americano",
                    "size": "large",
                    "milk": "none",
                    "temperature": "iced",
                    "shots": 1,
                    "quantity": 1,
                },
            ],
        },
    },
    {
        "question": "Oat milk is out today. What can I get that does not need oat milk?",
        "info": {
            "expected_action": "list_menu",
            "required_terms": ["Espresso", "Americano", "Tea", "almond", "whole"],
        },
    },
    {
        "question": "No oat milk today; please order a medium hot oat latte for Ina.",
        "info": {
            "expected_action": "refuse",
            "required_terms": ["oat", "whole", "almond"],
        },
    },
    {
        "question": "I'll have my usual.",
        "info": {
            "expected_action": "refuse",
            "required_terms": ["which drink", "size", "name"],
        },
    },
    {
        "question": "Make it iced for Jordan.",
        "info": {
            "expected_action": "refuse",
            "required_terms": ["which drink", "size"],
        },
    },
    {
        "question": "Can I get a decaf medium hot latte for Ren?",
        "info": {
            "expected_action": "refuse",
            "required_terms": ["decaf", "not available"],
        },
    },
    {
        "question": "Make Morgan a cold brew with three shots.",
        "info": {
            "expected_action": "refuse",
            "required_terms": ["cold brew", "2", "shots"],
        },
    },
    {
        "question": "What non-dairy milks can I get for a latte?",
        "info": {
            "expected_action": "list_menu",
            "required_terms": ["Latte", "oat", "almond"],
        },
    },
    {
        "question": "Order a medium extra-hot oat latte for Sol, no foam, pickup at 8:15.",
        "info": {
            "expected_action": "confirm_order",
            "expected_tool_names": ["quote_order"],
            "expected_tool_sequence": ["quote_order"],
            "expected_tool_counts": {"quote_order": 1, "place_order": 0},
            "required_terms": ["Latte", "Sol", "$5.18", "Should I place"],
            "expected_order": {
                "customer_name": "Sol",
            },
            "expected_items": [
                {
                    "drink_id": "latte",
                    "size": "medium",
                    "milk": "oat",
                    "temperature": "extra-hot",
                    "shots": 1,
                    "quantity": 1,
                    "notes": "no foam; pickup 8:15",
                }
            ],
        },
    },
    {
        "question": "Order a small hot cappuccino for Luca and keep the receipt short.",
        "info": {
            "expected_action": "confirm_order",
            "expected_tool_names": ["quote_order"],
            "expected_tool_sequence": ["quote_order"],
            "expected_tool_counts": {"quote_order": 1, "place_order": 0},
            "required_terms": ["Cappuccino", "Luca", "$4.25", "Should I place"],
            "expected_order": {
                "customer_name": "Luca",
            },
            "expected_items": [
                {
                    "drink_id": "cappuccino",
                    "size": "small",
                    "milk": "whole",
                    "temperature": "hot",
                    "shots": 1,
                    "quantity": 1,
                }
            ],
        },
    },
    {
        "question": "Can I get an iced cappuccino for Imani?",
        "info": {
            "expected_action": "refuse",
            "required_terms": ["cappuccino", "hot", "extra-hot"],
        },
    },
    {
        "question": "What's the cheapest hot drink?",
        "info": {
            "expected_action": "list_menu",
            "required_terms": ["Espresso", "$3.00"],
        },
    },
    {
        "question": "I need something vegan and iced. What are my options?",
        "info": {
            "expected_action": "list_menu",
            "required_terms": ["Americano", "Tea", "Cold Brew"],
        },
    },
    {
        "question": "Order a large iced tea with two shots for Remy.",
        "info": {
            "expected_action": "refuse",
            "required_terms": ["tea", "shots", "0"],
        },
    },
    {
        "question": "Order a medium iced americano for Jamie and note light ice.",
        "info": {
            "expected_action": "confirm_order",
            "expected_tool_names": ["quote_order"],
            "expected_tool_sequence": ["quote_order"],
            "expected_tool_counts": {"quote_order": 1, "place_order": 0},
            "required_terms": ["Americano", "Jamie", "$4.02", "Should I place"],
            "expected_order": {
                "customer_name": "Jamie",
            },
            "expected_items": [
                {
                    "drink_id": "americano",
                    "size": "medium",
                    "milk": "none",
                    "temperature": "iced",
                    "shots": 1,
                    "quantity": 1,
                    "notes": "light ice",
                }
            ],
        },
    },
]


async def list_menu() -> str:
    """List the current coffee menu.

    Returns:
        A JSON payload containing all available drinks and customization limits.
    """
    return json.dumps({"menu": MENU}, sort_keys=True)


async def get_item_options(drink_id: str) -> str:
    """Get valid options and defaults for one menu item.

    Args:
        drink_id: Menu drink id, such as latte, espresso, cold-brew, or tea.

    Returns:
        A JSON payload with valid sizes, valid options, and defaults.
    """
    item = find_menu_item(drink_id)
    if item is None:
        return json.dumps({"ok": False, "error": f"Unknown drink id: {drink_id}."}, sort_keys=True)
    return json.dumps(
        {
            "ok": True,
            "options": {
                "item": item,
                "available_sizes": list(SIZE_MULTIPLIERS.keys()),
                "default_size": "medium",
                "default_milk": default_milk(item),
                "default_temperature": default_temperature(item),
                "default_shots": default_shots(item),
                "default_quantity": 1,
            },
        },
        sort_keys=True,
    )


async def validate_order(
    items_json: str = "",
    drink_id: str = "",
    size: str = "",
    milk: str = "",
    temperature: str = "",
    shots: int | None = None,
    notes: str = "",
    quantity: int | None = None,
) -> str:
    """Validate a proposed multi-item coffee order.

    Args:
        items_json: JSON array or single JSON object of proposed order items.
            Legacy single-drink arguments are also accepted for compatibility.

    Returns:
        A JSON payload with either validated normalized items or a validation error.
    """
    items = parse_items_json(items_json)
    if isinstance(items, dict):
        return json.dumps(items, sort_keys=True)
    quote = quote_payload(items, drink_id, size, milk, temperature, shots, notes, quantity)
    if quote.get("ok") is not True:
        return json.dumps(quote, sort_keys=True)
    return json.dumps({"ok": True, "valid": True, "items": quote["items"], "total_price_cents": quote["total_price_cents"]}, sort_keys=True)


async def quote_order(
    items_json: str = "",
    drink_id: str = "",
    size: str = "",
    milk: str = "",
    temperature: str = "",
    shots: int | None = None,
    notes: str = "",
    quantity: int | None = None,
) -> str:
    """Quote a proposed multi-item coffee order.

    Args:
        items_json: JSON array or single JSON object of proposed order items.
            Legacy single-drink arguments are also accepted.

    Returns:
        A JSON payload with normalized items and total price.
    """
    items = parse_items_json(items_json)
    if isinstance(items, dict):
        return json.dumps(items, sort_keys=True)
    return json.dumps(quote_payload(items, drink_id, size, milk, temperature, shots, notes, quantity), sort_keys=True)


async def place_order(
    items_json: str = "",
    drink_id: str = "",
    size: str = "",
    milk: str = "",
    temperature: str = "",
    shots: int | None = None,
    customer_name: str = "",
    notes: str = "",
    quantity: int | None = None,
) -> str:
    """Create a simulated coffee order if the requested items are valid.

    Args:
        items_json: JSON array or single JSON object of one or more order items.
            Legacy single-drink arguments are also accepted.
        customer_name: Customer name for the order.

    Returns:
        A JSON payload with either the accepted order or a validation error.
    """
    items = parse_items_json(items_json)
    if isinstance(items, dict):
        return json.dumps(items, sort_keys=True)
    quote = quote_payload(items, drink_id, size, milk, temperature, shots, notes, quantity)
    if quote.get("ok") is not True:
        return json.dumps(quote, sort_keys=True)
    order = order_payload(quote["items"], customer_name)
    return json.dumps({"ok": True, "order": order}, sort_keys=True)


async def get_cart() -> str:
    """Fetch the current simulated cart."""
    return json.dumps({"ok": True, "cart": cart_payload()}, sort_keys=True)


async def add_cart_item(
    drink_id: str,
    size: str = "",
    milk: str = "",
    temperature: str = "",
    shots: int | None = None,
    notes: str = "",
    quantity: int | None = None,
) -> str:
    """Add a validated item to the current simulated cart."""
    quote = quote_payload(None, drink_id, size, milk, temperature, shots, notes, quantity)
    if quote.get("ok") is not True:
        return json.dumps(quote, sort_keys=True)
    cart = rollout_cart()
    for item in quote["items"]:
        cart.append({"cart_item_id": next_cart_item_id(), "item": item})
    return json.dumps({"ok": True, "cart": cart_payload()}, sort_keys=True)


async def update_cart_item(
    cart_item_id: str,
    drink_id: str = "",
    size: str = "",
    milk: str = "",
    temperature: str = "",
    shots: int | None = None,
    notes: str = "",
    quantity: int | None = None,
) -> str:
    """Update one item in the current simulated cart."""
    cart = rollout_cart()
    matches = [entry for entry in cart if entry["cart_item_id"] == cart_item_id]
    if not matches:
        return json.dumps({"ok": False, "error": f"cart item {cart_item_id} was not found"}, sort_keys=True)
    current = matches[0]["item"]
    quote = quote_payload(
        None,
        drink_id or current["drink_id"],
        size or current["size"],
        milk or current["milk"],
        temperature or current["temperature"],
        shots if shots is not None else current["shots"],
        notes if notes else current.get("notes", ""),
        quantity if quantity is not None else current["quantity"],
    )
    if quote.get("ok") is not True:
        return json.dumps(quote, sort_keys=True)
    matches[0]["item"] = quote["items"][0]
    return json.dumps({"ok": True, "cart": cart_payload()}, sort_keys=True)


async def remove_cart_item(cart_item_id: str) -> str:
    """Remove one item from the current simulated cart."""
    cart = rollout_cart()
    if not any(entry["cart_item_id"] == cart_item_id for entry in cart):
        return json.dumps({"ok": False, "error": f"cart item {cart_item_id} was not found"}, sort_keys=True)
    rollout_cart_state()["items"] = [entry for entry in cart if entry["cart_item_id"] != cart_item_id]
    return json.dumps({"ok": True, "cart": cart_payload()}, sort_keys=True)


async def clear_cart() -> str:
    """Clear the current simulated cart."""
    reset_cart()
    return json.dumps({"ok": True, "cart": cart_payload()}, sort_keys=True)


async def checkout_cart(customer_name: str = "") -> str:
    """Place the current simulated cart as one multi-item order."""
    cart = rollout_cart()
    if not cart:
        return json.dumps({"ok": False, "error": "cart must include at least one item"}, sort_keys=True)
    order = order_payload([entry["item"] for entry in cart], customer_name)
    reset_cart()
    return json.dumps({"ok": True, "order": order}, sort_keys=True)


_CARTS: dict[int, dict[str, Any]] = {}


def cart_key() -> int:
    task = asyncio.current_task()
    return id(task) if task is not None else 0


def rollout_cart() -> list[dict[str, Any]]:
    return rollout_cart_state()["items"]


def rollout_cart_state() -> dict[str, Any]:
    key = cart_key()
    if key not in _CARTS:
        _CARTS[key] = {"items": [], "next_id": 1}
    return _CARTS[key]


def next_cart_item_id() -> str:
    state = rollout_cart_state()
    item_id = f"cart-item-{state['next_id']:04d}"
    state["next_id"] += 1
    return item_id


def reset_cart() -> None:
    _CARTS[cart_key()] = {"items": [], "next_id": 1}


def cart_payload() -> dict[str, Any]:
    cart = rollout_cart()
    total = sum(entry["item"]["line_total_cents"] for entry in cart)
    return {"items": cart, "total_price_cents": total, "totalPriceCents": total}


def parse_items_json(items_json: str) -> list[dict[str, Any]] | dict[str, Any] | None:
    if items_json.strip() == "":
        return None
    try:
        parsed = json.loads(items_json)
    except json.JSONDecodeError:
        return {"ok": False, "error": "items_json must be a JSON array of order items."}
    if isinstance(parsed, dict):
        return [parsed]
    if isinstance(parsed, list) and all(isinstance(item, dict) for item in parsed):
        return parsed
    return {"ok": False, "error": "items_json must be a JSON object or array of order items."}


def validate_order_item(
    item: dict[str, Any],
    size: str,
    milk: str,
    temperature: str,
    shots: int,
    quantity: int,
) -> str | None:
    if size not in SIZE_MULTIPLIERS:
        return f"Unsupported size: {size}."
    if milk not in item["available_milks"]:
        return f"{item['name']} does not support milk option {milk}."
    if temperature not in item["available_temperatures"]:
        return f"{item['name']} does not support temperature {temperature}."
    if item["kind"] == "tea" and shots != 0:
        return "Tea drinks do not support extra shots."
    if shots < 0 or shots > item["max_shots"]:
        return f"{item['name']} supports at most {item['max_shots']} shots."
    if quantity < 1:
        return "Quantity must be a positive integer."
    return None


def quote_payload(
    items: list[dict[str, Any]] | None,
    drink_id: str,
    size: str,
    milk: str,
    temperature: str,
    shots: int | None,
    notes: str,
    quantity: int | None,
) -> dict[str, Any]:
    raw_items = items if items else [
        {
            "drink_id": drink_id,
            "drinkId": drink_id,
            "size": size,
            "milk": milk,
            "temperature": temperature,
            "shots": shots,
            "notes": notes,
            "quantity": quantity,
        }
    ]
    hydrated_items = [
        {
            "drink_id": raw_item.get("drink_id") or raw_item.get("drinkId") or drink_id,
            "drinkId": raw_item.get("drinkId") or raw_item.get("drink_id") or drink_id,
            "size": raw_item.get("size") or size,
            "milk": raw_item.get("milk") or milk,
            "temperature": raw_item.get("temperature") or temperature,
            "shots": raw_item.get("shots") if raw_item.get("shots") is not None else shots,
            "notes": raw_item.get("notes") or notes,
            "quantity": raw_item.get("quantity") if raw_item.get("quantity") is not None else quantity,
        }
        for raw_item in raw_items
    ]
    normalized_items = []
    for raw_item in hydrated_items:
        normalized_item = normalize_order_item(raw_item)
        if normalized_item.get("ok") is not True:
            return normalized_item
        normalized_items.append(normalized_item["item"])
    total = sum(item["line_total_cents"] for item in normalized_items)
    return {"ok": True, "items": normalized_items, "total_price_cents": total, "totalPriceCents": total}


def normalize_order_item(raw_item: dict[str, Any]) -> dict[str, Any]:
    drink_id = str(raw_item.get("drink_id") or raw_item.get("drinkId") or "")
    item = find_menu_item(drink_id)
    if item is None:
        return {"ok": False, "error": f"Unknown drink id: {drink_id}. Use list_menu first."}
    size = str(raw_item.get("size") or "medium")
    milk = str(raw_item.get("milk") or default_milk(item))
    temperature = str(raw_item.get("temperature") or default_temperature(item))
    shots = raw_item.get("shots")
    normalized_shots = default_shots(item) if shots is None else int(shots)
    quantity = raw_item.get("quantity")
    normalized_quantity = 1 if quantity is None else int(quantity)
    validation_error = validate_order_item(item, size, milk, temperature, normalized_shots, normalized_quantity)
    if validation_error is not None:
        return {"ok": False, "error": validation_error}
    unit_price = calculate_price_cents(item, size, normalized_shots)
    line_total = unit_price * normalized_quantity
    notes = str(raw_item.get("notes") or "")
    return {
        "ok": True,
        "item": {
            "drink_id": item["id"],
            "drinkId": item["id"],
            "drink_name": item["name"],
            "drinkName": item["name"],
            "size": size,
            "milk": milk,
            "temperature": temperature,
            "shots": normalized_shots,
            "notes": notes,
            "quantity": normalized_quantity,
            "unit_price_cents": unit_price,
            "unitPriceCents": unit_price,
            "line_total_cents": line_total,
            "lineTotalCents": line_total,
        },
    }


def order_payload(items: list[dict[str, Any]], customer_name: str) -> dict[str, Any]:
    total = sum(item["line_total_cents"] for item in items)
    first = items[0]
    order = {
        "id": "order-simulated-0001",
        "customer_name": customer_name,
        "customerName": customer_name,
        "ownerUserId": "simulated-user",
        "items": items,
        "status": "pending",
        "total_price_cents": total,
        "totalPriceCents": total,
        "createdAt": "2026-05-10T00:00:00Z",
        "drink_id": first["drink_id"],
        "drink_name": first["drink_name"],
        "size": first["size"],
        "milk": first["milk"],
        "temperature": first["temperature"],
        "shots": first["shots"],
        "notes": first.get("notes", ""),
        "quantity": first["quantity"],
        "price_cents": total,
    }
    return order


async def tool_correctness(completion, info) -> float:
    expected_action = info["expected_action"]
    text = completion_text(completion)

    if expected_action == "place_order":
        order = accepted_order(completion)
        if order is None:
            return 0.0
        expected_order = info.get("expected_order", {})
        checks = [order.get(key) == value for key, value in expected_order.items()]
        expected_items = info.get("expected_items", [])
        checks.extend(compare_expected_items(order.get("items", []), expected_items))
        expected_tool_names = info.get("expected_tool_names", [])
        used_tool_names = tool_names(completion)
        checks.extend(any(name == expected_name for name in used_tool_names) for expected_name in expected_tool_names)
        checks.extend(expected_tool_path_checks(info, used_tool_names))
        return sum(1.0 for check in checks if check) / len(checks)

    if expected_action == "confirm_order":
        payloads = tool_payloads(completion)
        proposed_items = proposed_order_items(payloads)
        expected_items = info.get("expected_items", [])
        used_tool_names = tool_names(completion)
        required_terms = info["required_terms"]
        checks = [
            accepted_order(completion) is None,
            final_assistant_text(completion) != "",
            confirmation_text(final_assistant_text(completion)),
        ]
        checks.extend(compare_expected_items(proposed_items, expected_items))
        checks.extend(term.lower() in text.lower() for term in required_terms)
        checks.extend(any(name == expected_name for name in used_tool_names) for expected_name in info.get("expected_tool_names", []))
        checks.extend(expected_tool_path_checks(info, used_tool_names))
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

    if expected_action == "confirm_order":
        required_terms = info["required_terms"]
        term_score = sum(1.0 for term in required_terms if term.lower() in text) / len(required_terms)
        confirmation_score = float(confirmation_text(text))
        safety_score = float(accepted_order(completion) is None)
        concise_score = concise_text_score(text, max_words=40)
        return 0.45 * term_score + 0.25 * confirmation_score + 0.2 * safety_score + 0.1 * concise_score

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
    if info["expected_action"] == "confirm_order":
        total_cents = proposed_total_cents(tool_payloads(completion))
        return float(total_cents is not None and price_text_has_exact_dollars(final_assistant_text(completion), total_cents))

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
    if info["expected_action"] == "confirm_order":
        final_text = final_assistant_text(completion)
        total_cents = proposed_total_cents(tool_payloads(completion))
        normalized_text = final_text.lower()
        checks = [
            accepted_order(completion) is None,
            confirmation_text(final_text),
            total_cents is not None and price_text_has_exact_dollars(final_text, total_cents),
            "cent" not in normalized_text,
            "₹" not in normalized_text,
            len(final_text.split()) <= 40,
        ]
        return sum(1.0 for check in checks if check) / len(checks)

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
    cart_calls = count_cart_results(payloads)
    quote_calls = count_quote_results(payloads)
    final_text = final_assistant_text(completion)

    if expected_action == "place_order":
        order = accepted_order(completion)
        expected_tool_names = info.get("expected_tool_names", [])
        used_tool_names = tool_names(completion)
        checks = [
            menu_calls <= 1,
            order_calls == 1,
            order is not None,
            no_tools_after_success(completion),
            final_text != "",
            concise_text_score(final_text, max_words=32) >= 0.75,
            price_text_is_exact_dollars(final_text, order),
        ]
        if expected_tool_names:
            checks.extend(any(name == expected_name for name in used_tool_names) for expected_name in expected_tool_names)
            checks.append(cart_calls >= max(len(expected_tool_names) - 1, 0))
        checks.extend(expected_tool_path_checks(info, used_tool_names))
        return sum(1.0 for check in checks if check) / len(checks)

    if expected_action == "confirm_order":
        used_tool_names = tool_names(completion)
        total_cents = proposed_total_cents(payloads)
        checks = [
            menu_calls <= 1,
            order_calls == 0,
            quote_calls + cart_calls >= 1,
            final_text != "",
            confirmation_text(final_text),
            concise_text_score(final_text, max_words=40) >= 0.75,
            total_cents is not None and price_text_has_exact_dollars(final_text, total_cents),
        ]
        checks.extend(expected_tool_path_checks(info, used_tool_names))
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


def tool_names(completion) -> list[str]:
    return [message_tool_name(message) for message in completion if message_role(message) == "tool"]


def compare_expected_items(actual_items: Any, expected_items: list[dict[str, Any]]) -> list[bool]:
    if not expected_items:
        return []
    if not isinstance(actual_items, list):
        return [False for expected_item in expected_items for _ in expected_item]
    checks = []
    for index, expected_item in enumerate(expected_items):
        actual_item = actual_items[index] if index < len(actual_items) and isinstance(actual_items[index], dict) else {}
        checks.extend(actual_item.get(key) == value for key, value in expected_item.items())
    checks.append(len(actual_items) == len(expected_items))
    return checks


def expected_tool_path_checks(info: dict[str, Any], used_tool_names: list[str]) -> list[bool]:
    expected_sequence = info.get("expected_tool_sequence", [])
    expected_counts = info.get("expected_tool_counts", {})
    checks = []
    if expected_sequence:
        checks.append(tool_sequence_contains(used_tool_names, expected_sequence))
    if isinstance(expected_counts, dict):
        checks.extend(
            used_tool_names.count(name) == 0 if count <= 0 else used_tool_names.count(name) >= count
            for name, count in expected_counts.items()
        )
    return checks


def tool_sequence_contains(used_tool_names: list[str], expected_sequence: list[str]) -> bool:
    remaining = list(expected_sequence)
    for name in used_tool_names:
        if remaining and name == remaining[0]:
            remaining.pop(0)
    return not remaining


def count_menu_results(payloads: list[Any]) -> int:
    return sum(1 for payload in payloads if isinstance(payload, dict) and isinstance(payload.get("menu"), list))


def count_order_results(payloads: list[Any]) -> int:
    return sum(1 for payload in payloads if isinstance(payload, dict) and payload.get("ok") is True and "order" in payload)


def count_cart_results(payloads: list[Any]) -> int:
    return sum(1 for payload in payloads if isinstance(payload, dict) and payload.get("ok") is True and "cart" in payload)


def count_quote_results(payloads: list[Any]) -> int:
    return sum(
        1
        for payload in payloads
        if isinstance(payload, dict)
        and payload.get("ok") is True
        and isinstance(payload.get("items"), list)
        and "total_price_cents" in payload
        and "order" not in payload
    )


def proposed_order_items(payloads: list[Any]) -> list[dict[str, Any]]:
    for payload in reversed(payloads):
        if isinstance(payload, dict) and isinstance(payload.get("items"), list):
            return payload["items"]
        if isinstance(payload, dict) and isinstance(payload.get("cart"), dict):
            cart_items = payload["cart"].get("items", [])
            if isinstance(cart_items, list):
                return [
                    cart_item["item"]
                    for cart_item in cart_items
                    if isinstance(cart_item, dict) and isinstance(cart_item.get("item"), dict)
                ]
    return []


def proposed_total_cents(payloads: list[Any]) -> int | None:
    for payload in reversed(payloads):
        if isinstance(payload, dict) and isinstance(payload.get("total_price_cents"), int):
            return payload["total_price_cents"]
        if isinstance(payload, dict) and isinstance(payload.get("cart"), dict):
            total = payload["cart"].get("total_price_cents")
            if isinstance(total, int):
                return total
    return None


def no_tools_after_success(completion) -> bool:
    saw_success = False
    for message in completion:
        if message_role(message) != "tool":
            continue
        payload = json_payload(message_content(message))
        if saw_success:
            return False
        if isinstance(payload, dict) and payload.get("ok") is True and "order" in payload:
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
    return price_text_has_exact_dollars(text, order["price_cents"])


def price_text_has_exact_dollars(text: str, price_cents: int) -> bool:
    normalized_text = text.lower()
    expected_price = cents_to_dollars(price_cents).lower()
    wrong_markers = ["₹", " cents", " cent", f"${price_cents}"]
    return expected_price in normalized_text and not any(marker in normalized_text for marker in wrong_markers)


def confirmation_text(text: str) -> bool:
    normalized_text = text.lower()
    return "?" in text and any(phrase in normalized_text for phrase in ["should i place", "place it", "confirm"])


def tool_contents(completion) -> list[str]:
    return [message_content(message) for message in completion if message_role(message) == "tool"]


def message_role(message) -> str:
    return getattr(message, "role", message.get("role", "") if isinstance(message, dict) else "")


def message_content(message) -> str:
    content = getattr(message, "content", message.get("content", "") if isinstance(message, dict) else "")
    return content if isinstance(content, str) else str(content)


def message_tool_calls(message) -> Any:
    return getattr(message, "tool_calls", message.get("tool_calls") if isinstance(message, dict) else None)


def message_tool_name(message) -> str:
    name = getattr(message, "name", message.get("name", "") if isinstance(message, dict) else "")
    return name if isinstance(name, str) else ""


def json_payload(content: str) -> Any:
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        return None


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
    product_readiness_dataset = to_dataset(PRODUCT_READINESS_TASKS)

    datasets = {
        "train": train_dataset,
        "eval": eval_dataset,
        "hard_eval": hard_eval_dataset,
        "receipt_drill": receipt_drill_dataset,
        "product_readiness": product_readiness_dataset,
    }
    selected_dataset = datasets.get(split, train_dataset)
    if num_examples > 0:
        selected_dataset = selected_dataset.select(range(min(num_examples, len(selected_dataset))))
    selected_eval_dataset = eval_dataset if split == "train" else selected_dataset

    rubric = vf.Rubric(
        funcs=[tool_correctness, final_response_quality, product_efficiency, price_format, receipt_style],
        weights=[0.4, 0.2, 0.15, 0.15, 0.1],
    )

    ordering_tools = [
        place_order,
        add_cart_item,
        checkout_cart,
        get_cart,
        update_cart_item,
        remove_cart_item,
        clear_cart,
    ]
    menu_tools = [
        list_menu,
        get_item_options,
        validate_order,
        quote_order,
    ]

    return vf.ToolEnv(
        dataset=selected_dataset,
        eval_dataset=selected_eval_dataset,
        tools=ordering_tools + menu_tools,
        rubric=rubric,
        system_prompt=SYSTEM_PROMPT,
        max_turns=4,
        **kwargs,
    )
