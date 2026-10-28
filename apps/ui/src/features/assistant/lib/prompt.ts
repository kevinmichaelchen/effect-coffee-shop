import { Option } from "effect";
import { isActiveOrder } from "#features/coffee-shop/lib/coffee.ts";
import type { MenuItem, OrderDraft, OrderTicket } from "#features/coffee-shop/lib/coffee.ts";
import type { AssistantRequest } from "#features/assistant/lib/tools.ts";

/** A chat message in the shape the LFM3 chat template takes. */
export interface ChatMessage {
  readonly role: "system" | "user";
  readonly content: string;
}

const describeItem = (item: MenuItem): string =>
  `${item.id} (${item.name}; milk: ${item.availableMilks.join("/")}; ${item.availableTemperatures.join("/")}; up to ${item.maxShots} shots)`;

const describeDraft = (draft: OrderDraft): string =>
  [
    `${draft.quantity}x ${draft.size} ${draft.drinkId}`,
    `${draft.milk} milk`,
    draft.temperature,
    `${draft.shots} shots`,
    ...(draft.notes.length > 0 ? [`notes: ${draft.notes}`] : []),
  ].join(", ");

const describeTicket = (order: OrderTicket): string =>
  `- ${order.id}: ${order.customerName}, ${order.status}, ${order.items
    .map(
      (item) =>
        `${item.quantity}x ${item.size} ${item.drinkName} (${item.milk} milk, ${item.temperature})`,
    )
    .join("; ")}`;

const shopPrompt = (request: AssistantRequest): string =>
  [
    "You are the order assistant in a coffee shop app.",
    `Menu: ${request.menu.map(describeItem).join(", ")}.`,
    `Current draft: ${Option.match(request.draft, { onNone: () => "none yet", onSome: describeDraft })}.`,
    "Rules:",
    "- To change the draft, call update_order with only the fields the customer mentioned.",
    "- To send the draft, call place_order.",
    "- For questions, answer in one short sentence and call no tool.",
    "Examples:",
    '- "a large oat latte" → update_order with drinkId latte, size large, milk oat',
    '- "with an extra shot" → update_order with extraShots 1',
    '- "two of those" → update_order with quantity 2',
    '- "a small tea, extra hot" → update_order with drinkId tea, size small, temperature extra-hot',
    '- "send it", "that\'s it", "check out" → place_order',
  ].join("\n");

const staffPrompt = (request: AssistantRequest): string => {
  const active = request.orders.filter(isActiveOrder);
  return [
    "You are the barista's assistant for a coffee shop's live ticket queue.",
    active.length > 0
      ? `Active tickets:\n${active.map(describeTicket).join("\n")}`
      : "The queue is empty.",
    "Rules:",
    "- To move a ticket along, call the one tool for that step with the ticket's id. Match tickets by customer name or drink.",
    "- For questions about the queue, answer in one short sentence and call no tool.",
  ].join("\n");
};

export const messagesFor = (request: AssistantRequest): readonly ChatMessage[] => [
  { role: "system", content: request.page === "shop" ? shopPrompt(request) : staffPrompt(request) },
  { role: "user", content: request.prompt },
];
