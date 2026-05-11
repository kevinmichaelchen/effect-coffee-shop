import asyncio
import importlib
import json
import sys
from pathlib import Path
from types import ModuleType
import unittest


EXPERIMENT_DIR = Path(__file__).resolve().parents[1]
ENVIRONMENT_DIR = EXPERIMENT_DIR / "environment"


class FakeDataset:
    def __init__(self, rows):
        self.rows = rows

    @classmethod
    def from_list(cls, rows):
        return cls(rows)

    def select(self, indexes):
        return FakeDataset([self.rows[index] for index in indexes])

    def __len__(self):
        return len(self.rows)


class FakeRubric:
    def __init__(self, **kwargs):
        self.kwargs = kwargs


class FakeToolEnv:
    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)


def load_environment_module():
    datasets_module = ModuleType("datasets")
    datasets_module.Dataset = FakeDataset
    verifiers_module = ModuleType("verifiers")
    verifiers_module.Environment = object
    verifiers_module.Rubric = FakeRubric
    verifiers_module.ToolEnv = FakeToolEnv
    sys.modules["datasets"] = datasets_module
    sys.modules["verifiers"] = verifiers_module
    sys.path.insert(0, str(ENVIRONMENT_DIR))
    return importlib.import_module("effect_coffee_ordering")


env = load_environment_module()


class EnvironmentLogicTests(unittest.TestCase):
    def test_product_readiness_uses_selected_dataset_for_eval(self):
        environment = env.load_environment(split="product_readiness")

        self.assertEqual(len(environment.dataset), len(env.PRODUCT_READINESS_TASKS))
        self.assertEqual(len(environment.eval_dataset), len(env.PRODUCT_READINESS_TASKS))

    def test_confirmation_first_uses_selected_dataset_for_eval(self):
        environment = env.load_environment(split="confirmation_first")

        self.assertEqual(len(environment.dataset), len(env.CONFIRMATION_FIRST_TASKS))
        self.assertEqual(len(environment.eval_dataset), len(env.CONFIRMATION_FIRST_TASKS))

    def test_prepare_order_confirmation_returns_pending_ticket(self):
        async def run():
            return await env.prepare_order_confirmation(
                items_json=json.dumps(
                    {
                        "drink_id": "latte",
                        "milk": "oat",
                        "size": "medium",
                    }
                )
            )

        payload = json.loads(asyncio.run(run()))

        self.assertTrue(payload["ok"])
        self.assertEqual(payload["status"], "pending_confirmation")
        self.assertEqual(payload["source"], "direct-order")
        self.assertEqual(payload["items"][0]["drink_id"], "latte")
        self.assertIn("confirmation_id", payload)

    def test_place_order_accepts_single_item_json_payload(self):
        async def run():
            return await env.place_order(
                items_json=json.dumps(
                    {
                        "drink_id": "latte",
                        "milk": "oat",
                        "temperature": "iced",
                    }
                ),
                customer_name="Ivy",
            )

        payload = json.loads(asyncio.run(run()))

        self.assertTrue(payload["ok"])
        self.assertEqual(payload["order"]["customer_name"], "Ivy")
        self.assertEqual(payload["order"]["items"][0]["size"], "medium")
        self.assertEqual(payload["order"]["items"][0]["shots"], 1)

    def test_cart_item_ids_do_not_reuse_removed_ids(self):
        async def run():
            await env.clear_cart()
            await env.add_cart_item("cappuccino")
            await env.remove_cart_item("cart-item-0001")
            return await env.add_cart_item("americano", size="large", temperature="iced")

        payload = json.loads(asyncio.run(run()))

        self.assertEqual(payload["cart"]["items"][0]["cart_item_id"], "cart-item-0002")

    def test_product_efficiency_rewards_confirmation_before_purchase(self):
        latte = env.quote_payload(None, "latte", "medium", "oat", "hot", 1, "", 1)["items"][0]
        espresso = env.quote_payload(None, "espresso", "small", "none", "hot", 1, "", 1)["items"][0]
        order = env.order_payload([latte, espresso], "Ava")
        first_cart = {"items": [{"cart_item_id": "cart-item-0001", "item": latte}], "total_price_cents": 518}
        second_cart = {
            "items": [
                {"cart_item_id": "cart-item-0001", "item": latte},
                {"cart_item_id": "cart-item-0002", "item": espresso},
            ],
            "total_price_cents": 818,
        }
        final_text = (
            "I have a medium hot oat milk Latte and a small hot Espresso for Ava, "
            "total $8.18. Should I place it?"
        )
        info = env.PRODUCT_READINESS_TASKS[0]["info"]
        good_completion = [
            {"role": "tool", "name": "add_cart_item", "content": json.dumps({"ok": True, "cart": first_cart})},
            {"role": "tool", "name": "add_cart_item", "content": json.dumps({"ok": True, "cart": second_cart})},
            {"role": "assistant", "content": final_text},
        ]
        premature_checkout_completion = [
            {"role": "tool", "name": "add_cart_item", "content": json.dumps({"ok": True, "cart": first_cart})},
            {"role": "tool", "name": "checkout_cart", "content": json.dumps({"ok": True, "order": order})},
            {"role": "assistant", "content": f"Latte {order['id']} {env.cents_to_dollars(order['price_cents'])}."},
        ]

        good_score = asyncio.run(env.product_efficiency(good_completion, info))
        premature_checkout_score = asyncio.run(env.product_efficiency(premature_checkout_completion, info))

        self.assertEqual(good_score, 1.0)
        self.assertLess(premature_checkout_score, good_score)

    def test_confirmation_first_rewards_prepare_before_purchase(self):
        item = env.quote_payload(None, "latte", "medium", "whole", "hot", 1, "", 1)["items"][0]
        order = env.order_payload([item], "Rowan")
        confirmation = {
            "ok": True,
            "confirmation_id": "confirmation-test-0001",
            "source": "direct-order",
            "status": "pending_confirmation",
            "items": [item],
            "total_price_cents": 518,
        }
        info = env.CONFIRMATION_FIRST_TASKS[0]["info"]
        good_completion = [
            {"role": "tool", "name": "prepare_order_confirmation", "content": json.dumps(confirmation)},
            {
                "role": "assistant",
                "content": (
                    "I have a medium hot whole milk Latte for Rowan, total $5.18. "
                    "Should I place it?"
                ),
            },
        ]
        premature_order_completion = [
            {"role": "tool", "name": "place_order", "content": json.dumps({"ok": True, "order": order})},
            {"role": "assistant", "content": "Latte. Order order-simulated-0001. Total $5.18."},
        ]

        good_score = asyncio.run(env.product_efficiency(good_completion, info))
        premature_order_score = asyncio.run(env.product_efficiency(premature_order_completion, info))

        self.assertEqual(good_score, 1.0)
        self.assertLess(premature_order_score, good_score)

    def test_price_format_rejects_wrong_currency_and_cent_totals(self):
        item = env.quote_payload(None, "latte", "medium", "whole", "hot", 1, "", 1)["items"][0]
        order = env.order_payload([item], "Blair")
        info = {"expected_action": "place_order"}
        bad_currency_completion = [
            {"role": "tool", "name": "place_order", "content": json.dumps({"ok": True, "order": order})},
            {"role": "assistant", "content": f"Latte {order['id']} ₹{order['price_cents']}."},
        ]
        cent_total_completion = [
            {"role": "tool", "name": "place_order", "content": json.dumps({"ok": True, "order": order})},
            {"role": "assistant", "content": f"Latte {order['id']} ${order['price_cents']}."},
        ]

        self.assertEqual(asyncio.run(env.price_format(bad_currency_completion, info)), 0.0)
        self.assertEqual(asyncio.run(env.price_format(cent_total_completion, info)), 0.0)

    def test_system_prompt_requires_confirmation_before_purchase(self):
        prompt = env.SYSTEM_PROMPT

        self.assertIn("read back the interpreted order and ask for confirmation before purchase", prompt)
        self.assertIn("do not call place_order or checkout_cart yet", prompt)
        self.assertIn("prepare_order_confirmation", prompt)
        self.assertIn("confirmation_id", prompt)
        self.assertIn("Call place_order or checkout_cart only after the user explicitly confirms", prompt)
        self.assertIn("Should I place it?", prompt)
        self.assertIn("520 cents becomes $5.20", prompt)
        self.assertIn('Receipt template: "<drink summary>. Order <id>. Total $x.xx."', prompt)

    def test_ordering_tools_are_presented_before_menu_probe_tools(self):
        environment = env.load_environment(split="hard_eval")
        tool_names = [tool.__name__ for tool in environment.tools]

        self.assertEqual(tool_names[:3], ["prepare_order_confirmation", "prepare_cart_confirmation", "place_order"])
        self.assertLess(tool_names.index("prepare_order_confirmation"), tool_names.index("place_order"))
        self.assertLess(tool_names.index("place_order"), tool_names.index("list_menu"))
        self.assertLess(tool_names.index("place_order"), tool_names.index("get_item_options"))


if __name__ == "__main__":
    unittest.main()
