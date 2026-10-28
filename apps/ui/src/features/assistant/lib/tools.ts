import { Array as Arr, Option, Schema } from "effect";
import {
  DrinkSize,
  MenuItem,
  Milk,
  OrderDraft,
  OrderTicket,
  Temperature,
} from "#features/coffee-shop/lib/coffee-schemas.ts";
import { getOrderActions, type OrderAction } from "#features/coffee-shop/lib/coffee.ts";
import { type ParsedReply, parseReply } from "#features/assistant/lib/tool-call.ts";

export const AssistantPage = Schema.Literals(["shop", "staff"]);
export type AssistantPage = typeof AssistantPage.Type;

/** Everything the assistant may read for one request: the page and what it shows. */
export const AssistantRequest = Schema.Struct({
  page: AssistantPage,
  prompt: Schema.String,
  menu: Schema.Array(MenuItem),
  draft: Schema.Option(OrderDraft),
  orders: Schema.Array(OrderTicket),
});
export type AssistantRequest = typeof AssistantRequest.Type;

const OrderActionName = Schema.Literals(["start-brewing", "mark-ready", "pick-up", "cancel"]);

/** The draft fields the customer asked to change; everything else stays. */
export const DraftPatch = Schema.Struct({
  drinkId: Schema.optionalKey(Schema.String),
  size: Schema.optionalKey(DrinkSize),
  milk: Schema.optionalKey(Milk),
  temperature: Schema.optionalKey(Temperature),
  shots: Schema.optionalKey(Schema.Int),
  extraShots: Schema.optionalKey(Schema.Int),
  quantity: Schema.optionalKey(Schema.Int),
  notes: Schema.optionalKey(Schema.String),
});
export type DraftPatch = typeof DraftPatch.Type;

/**
 * What one assistant turn means for the UI. Draft edits apply at once (and can
 * be undone); anything that commits work is only proposed, for a person to tap.
 */
export const AssistantTurn = Schema.TaggedUnion({
  Replied: { text: Schema.String },
  UpdatedDraft: { patch: DraftPatch, text: Schema.String },
  ProposedPlaceOrder: { text: Schema.String },
  ProposedOrderAction: { orderId: Schema.String, action: OrderActionName, text: Schema.String },
});
export type AssistantTurn = typeof AssistantTurn.Type;

/** A tool in the OpenAI-style shape the LFM3 chat template renders. */
export interface ToolDefinition {
  readonly type: "function";
  readonly function: {
    readonly name: string;
    readonly description: string;
    readonly parameters: unknown;
  };
}

interface Tool {
  readonly definition: ToolDefinition;
  readonly toTurn: (args: unknown, text: string) => Option.Option<AssistantTurn>;
}

const emptyParameters = { type: "object", properties: {} };

/** One definition drives both the prompt (as JSON Schema) and decoding the model's call. */
const tool = <A, I>(
  name: string,
  description: string,
  parameters: Schema.Codec<A, I>,
  toTurn: (args: A, text: string) => AssistantTurn,
  options: { readonly empty?: boolean } = {},
): Tool => ({
  definition: {
    type: "function",
    function: {
      name,
      description,
      parameters: options.empty ? emptyParameters : Schema.toJsonSchemaDocument(parameters).schema,
    },
  },
  toTurn: (args, text) =>
    Schema.decodeUnknownOption(parameters)(args).pipe(
      Option.map((decoded) => toTurn(decoded, text)),
    ),
});

/** Ranges go in the description, not the decoder: the composer clamps, so a near miss still lands. */
const count = (description: string) => Schema.Int.annotate({ description });

const shopTools = (menu: readonly MenuItem[]): readonly Tool[] =>
  Arr.match(
    Arr.map(menu, (item) => item.id),
    {
      onEmpty: () => [],
      onNonEmpty: (drinkIds) => [
        tool(
          "update_order",
          "Change the customer's draft drink. Pass only the fields the customer changed.",
          Schema.Struct({
            drinkId: Schema.optionalKey(Schema.Literals(drinkIds)),
            size: Schema.optionalKey(DrinkSize),
            milk: Schema.optionalKey(Milk),
            temperature: Schema.optionalKey(Temperature),
            shots: Schema.optionalKey(
              count("Total espresso shots, 0 to 4, only when the customer names a number"),
            ),
            extraShots: Schema.optionalKey(
              count('Shots on top of the usual: 1 for "an extra shot", 2 for "a double"'),
            ),
            quantity: Schema.optionalKey(count("How many of this drink, 1 to 9")),
            notes: Schema.optionalKey(
              Schema.String.annotate({ description: "Anything else for the barista" }),
            ),
          }),
          (patch, text) => AssistantTurn.cases.UpdatedDraft.make({ patch, text }),
        ),
        tool(
          "place_order",
          "Send the draft to the baristas. Call it when the customer says to order, send, check out, or that they are done.",
          Schema.Struct({}),
          (_, text) => AssistantTurn.cases.ProposedPlaceOrder.make({ text }),
          { empty: true },
        ),
      ],
    },
  );

/** Staff tools share their names with the Coffee MCP actions they mirror. */
const staffActions: ReadonlyArray<{
  readonly action: OrderAction;
  readonly name: string;
  readonly description: string;
}> = [
  {
    action: "start-brewing",
    name: "start_brewing",
    description: "Start brewing a pending ticket.",
  },
  {
    action: "mark-ready",
    name: "mark_ready",
    description: "Mark a brewing ticket ready for pickup.",
  },
  {
    action: "pick-up",
    name: "pick_up_order",
    description: "Record that a ready ticket was picked up.",
  },
  { action: "cancel", name: "cancel_order", description: "Cancel a pending or brewing ticket." },
];

/** Each action offers only the tickets it is legal for right now. */
const staffTools = (orders: readonly OrderTicket[]): readonly Tool[] =>
  staffActions.flatMap(({ action, name, description }) =>
    Arr.match(
      orders
        .filter((order) => getOrderActions(order.status).some((option) => option.action === action))
        .map((order) => order.id),
      {
        onEmpty: () => [],
        onNonEmpty: (orderIds) => [
          tool(
            name,
            description,
            Schema.Struct({
              orderId: Schema.Literals(orderIds).annotate({ description: "The ticket id" }),
            }),
            ({ orderId }, text) =>
              AssistantTurn.cases.ProposedOrderAction.make({ orderId, action, text }),
          ),
        ],
      },
    ),
  );

export const toolsFor = (request: AssistantRequest): readonly Tool[] =>
  request.page === "shop" ? shopTools(request.menu) : staffTools(request.orders);

export const toolDefinitions = (tools: readonly Tool[]): readonly ToolDefinition[] =>
  tools.map((entry) => entry.definition);

const fallback = "Sorry, I couldn't turn that into an order. Try saying it another way.";

const turnFromCall = (tools: readonly Tool[], reply: ParsedReply) =>
  Arr.head(reply.calls).pipe(
    Option.flatMap((call) =>
      Arr.findFirst(tools, (entry) => entry.definition.function.name === call.name).pipe(
        Option.flatMap((entry) => entry.toTurn(call.arguments, reply.text)),
      ),
    ),
  );

/**
 * Decodes model output into a turn. The first tool call wins; a call the
 * schemas reject becomes an apology rather than an error.
 */
export const decodeTurn = (tools: readonly Tool[], output: string): AssistantTurn => {
  const reply = parseReply(output);
  return Option.getOrElse(turnFromCall(tools, reply), () =>
    AssistantTurn.cases.Replied.make({
      text: reply.calls.length === 0 && reply.text.length > 0 ? reply.text : fallback,
    }),
  );
};
