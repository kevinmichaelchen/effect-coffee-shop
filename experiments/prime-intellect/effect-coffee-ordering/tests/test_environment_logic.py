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

    def test_product_efficiency_rewards_expected_cart_sequence_and_counts(self):
        latte = env.quote_payload(None, "latte", "medium", "oat", "hot", 1, "", 1)["items"][0]
        espresso = env.quote_payload(None, "espresso", "small", "none", "hot", 1, "", 1)["items"][0]
        order = env.order_payload([latte, espresso], "Ava")
        final_text = f"Latte {order['id']} {env.cents_to_dollars(order['price_cents'])}."
        info = env.PRODUCT_READINESS_TASKS[0]["info"]
        good_completion = [
            {"role": "tool", "name": "add_cart_item", "content": json.dumps({"ok": True, "cart": {"items": []}})},
            {"role": "tool", "name": "add_cart_item", "content": json.dumps({"ok": True, "cart": {"items": []}})},
            {"role": "tool", "name": "checkout_cart", "content": json.dumps({"ok": True, "order": order})},
            {"role": "assistant", "content": final_text},
        ]
        missing_add_completion = [
            {"role": "tool", "name": "add_cart_item", "content": json.dumps({"ok": True, "cart": {"items": []}})},
            {"role": "tool", "name": "checkout_cart", "content": json.dumps({"ok": True, "order": order})},
            {"role": "assistant", "content": final_text},
        ]

        good_score = asyncio.run(env.product_efficiency(good_completion, info))
        missing_add_score = asyncio.run(env.product_efficiency(missing_add_completion, info))

        self.assertEqual(good_score, 1.0)
        self.assertLess(missing_add_score, good_score)

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


if __name__ == "__main__":
    unittest.main()
