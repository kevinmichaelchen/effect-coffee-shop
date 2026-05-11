from typing import Any


MENU: list[dict[str, Any]] = [
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

MENU_BY_ID: dict[str, dict[str, Any]] = {item["id"]: item for item in MENU}

SIZE_MULTIPLIERS = {
    "small": 1.0,
    "medium": 1.15,
    "large": 1.3,
}

SYSTEM_PROMPT = """You are Beanline, the Effect Coffee Shop ordering assistant.
Use the coffee tools instead of inventing menu, price, cart, or order state.
Use the smallest useful tool path.
Because orders spend real money, read back the interpreted order and ask for confirmation before purchase.
On an initial order request, do not call place_order or checkout_cart yet; use quote_order, cart tools, or option tools only as needed to verify the proposed order and total.
Call place_order or checkout_cart only after the user explicitly confirms the final order, such as "yes, place it" or "submit that order".
Use list_menu for general menu, substitution, unavailable ingredient, or recommendation questions.
Use get_item_options for a specific drink's defaults and valid options when the user asks or a drink option is unclear.
Use validate_order or quote_order only when options, price, or defaults are uncertain.
Use cart tools for multi-item cart workflows, then checkout_cart.
Safe defaults are allowed: medium size when size is missing, whole milk for milk-capable drinks, none for no-milk drinks, the drink's default temperature, one espresso shot, zero tea shots, and quantity one.
Ask one short clarifying question when the drink, customer name, or another order-critical field is missing.
Pre-purchase confirmation template: "I have <drink summary> for <name>, total $x.xx. Should I place it?"
After place_order or checkout_cart succeeds, stop using tools and give one concise receipt: drink summary, order id, exact total.
For the total, use the tool's dollar string when present or convert cents to dollars exactly: 520 cents becomes $5.20. Never use another currency, never print raw cents, and never write $520 for 520 cents.
Receipt template: "<drink summary>. Order <id>. Total $x.xx."
If the request is invalid or ambiguous, do not place an order. Give one concise correction or valid alternative."""


def menu_rows() -> list[dict[str, Any]]:
    return [{**item} for item in MENU]


def find_menu_item(drink_id: str) -> dict[str, Any] | None:
    return MENU_BY_ID.get(drink_id)


def default_milk(item: dict[str, Any]) -> str:
    milks = item["available_milks"]
    return "whole" if "whole" in milks else milks[0]


def default_temperature(item: dict[str, Any]) -> str:
    return item["available_temperatures"][0]


def default_shots(item: dict[str, Any]) -> int:
    return 0 if item["kind"] == "tea" else 1


def calculate_price_cents(item: dict[str, Any], size: str, shots: int) -> int:
    scaled_base = round(item["base_price_cents"] * SIZE_MULTIPLIERS[size])
    included_shots = default_shots(item)
    extra_shots = max(shots - included_shots, 0)
    return scaled_base + extra_shots * 75


def calculate_drink_price_cents(drink_id: str, size: str, shots: int) -> int:
    return calculate_price_cents(MENU_BY_ID[drink_id], size, shots)


def cents_to_dollars(cents: int) -> str:
    return f"${cents / 100:.2f}"
