export type CoffeeActionJsonSchema = Readonly<{
  properties: Readonly<
    Record<
      string,
      Readonly<{
        description?: string;
        type: string;
      }>
    >
  >;
  required: readonly string[];
  type: "object";
}>;

type CoffeeActionJsonSchemaProperty = CoffeeActionJsonSchema["properties"][string];

const property = (
  description: string,
  type: CoffeeActionJsonSchemaProperty["type"],
): CoffeeActionJsonSchemaProperty => ({
  description,
  type,
});

const actionJsonSchema = (
  properties: CoffeeActionJsonSchema["properties"],
  required: readonly string[] = [],
): CoffeeActionJsonSchema => ({
  properties,
  required,
  type: "object",
});

const cartItemIdProperty = property("Cart line id, such as cart-item-0001.", "string");
const drinkIdProperty = property("Menu drink id such as latte.", "string");
const milkProperty = property("Milk choice such as whole, oat, almond, or none.", "string");
const notesProperty = property("Optional item note.", "string");
const quantityProperty = property("Positive line quantity.", "integer");
const shotsProperty = property("Number of espresso shots.", "integer");
const sizeProperty = property("Drink size such as small, medium, or large.", "string");
const temperatureProperty = property("Drink temperature such as hot or iced.", "string");

const orderItemProperties = {
  drinkId: drinkIdProperty,
  milk: milkProperty,
  notes: notesProperty,
  quantity: quantityProperty,
  shots: shotsProperty,
  size: sizeProperty,
  temperature: temperatureProperty,
};

export const emptyActionJsonSchema = actionJsonSchema({});
export const prepareCartCheckoutActionJsonSchema = emptyActionJsonSchema;
export const getCheckoutSessionActionJsonSchema = emptyActionJsonSchema;

export const orderIdActionJsonSchema = actionJsonSchema(
  {
    orderId: property("Coffee shop ticket id, such as order-0001.", "string"),
  },
  ["orderId"],
);

export const itemOptionsActionJsonSchema = actionJsonSchema({ drinkId: drinkIdProperty }, [
  "drinkId",
]);

export const listOrdersActionJsonSchema = actionJsonSchema({
  status: property(
    "Optional order status filter such as pending, brewing, ready, or picked-up.",
    "string",
  ),
});

export const placeOrderActionJsonSchema = actionJsonSchema(
  {
    items: property(
      "Order line items. Each item should include drinkId, size, and optional milk, temperature, shots, notes, and quantity.",
      "array",
    ),
  },
  ["items"],
);

export const quoteOrderActionJsonSchema = placeOrderActionJsonSchema;

export const orderItemActionJsonSchema = actionJsonSchema(orderItemProperties, ["drinkId", "size"]);

export const updateCartItemActionJsonSchema = actionJsonSchema(
  {
    cartItemId: cartItemIdProperty,
    drinkId: property("Optional replacement menu drink id.", "string"),
    milk: property("Optional replacement milk choice.", "string"),
    notes: property("Optional replacement item note.", "string"),
    quantity: property("Optional positive replacement line quantity.", "integer"),
    shots: property("Optional replacement espresso shot count.", "integer"),
    size: property("Optional replacement drink size.", "string"),
    temperature: property("Optional replacement drink temperature.", "string"),
  },
  ["cartItemId"],
);

export const cartItemIdActionJsonSchema = actionJsonSchema(
  {
    cartItemId: cartItemIdProperty,
  },
  ["cartItemId"],
);

export const checkoutCartActionJsonSchema = actionJsonSchema({
  customerName: property("Optional customer display name for system/staff checkout.", "string"),
});
