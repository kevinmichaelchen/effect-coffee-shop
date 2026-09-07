import * as Option from "effect/Option";
/**
 * Decodes assistant request bodies and normalizes UI/model messages.
 *
 * @module
 */
import type { AssistantConversationMessage } from "../../application/model.ts";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

const AssistantContentTextPart = Schema.Struct({
  type: Schema.Literal("text"),
  content: Schema.String,
});

const AssistantThinkingPart = Schema.Struct({
  type: Schema.Literal("thinking"),
  content: Schema.String,
});

const AssistantModelMessage = Schema.Struct({
  role: Schema.Literals(["user", "assistant", "tool"] as const),
  content: Schema.Union([Schema.String, Schema.Null, Schema.Array(AssistantContentTextPart)]),
});

const AssistantUiMessage = Schema.Struct({
  id: Schema.String,
  role: Schema.Literals(["system", "user", "assistant"] as const),
  parts: Schema.Array(Schema.Union([AssistantContentTextPart, AssistantThinkingPart])),
});

const AssistantRequestBody = Schema.Struct({
  messages: Schema.Array(Schema.Union([AssistantModelMessage, AssistantUiMessage])),
});

type AssistantModelMessageInput = typeof AssistantModelMessage.Type;
export type AssistantRequestBody = typeof AssistantRequestBody.Type;
type AssistantRequestMessage = (typeof AssistantRequestBody.Type.messages)[number];
type AssistantUiMessageInput = typeof AssistantUiMessage.Type;

const decodeAssistantRequestBody = Schema.decodeUnknownEffect(AssistantRequestBody);
const isAssistantUiMessage = Schema.is(AssistantUiMessage);

export async function parseAssistantRequestBody(
  request: Request,
): Promise<Option.Option<AssistantRequestBody>> {
  // oxlint-disable-next-line effect/effect-run-in-body -- Native Promise/callback boundary owns running this Effect; application effects stay composed.
  return Effect.runPromise(
    Effect.tryPromise({
      try: async () => request.json(),
      catch: () => null,
    }).pipe(
      Effect.matchEffect({
        onFailure: () => Effect.succeedNone,
        onSuccess: (body) =>
          decodeAssistantRequestBody(body).pipe(
            Effect.matchEffect({
              onFailure: () => Effect.succeedNone,
              onSuccess: Effect.succeedSome,
            }),
          ),
      }),
    ),
  );
}

export function toAssistantConversationMessages(
  messages: readonly AssistantRequestMessage[],
): readonly AssistantConversationMessage[] {
  return messages.flatMap((message) =>
    isAssistantUiMessage(message)
      ? toAssistantConversationMessagesFromUiMessage(message)
      : toAssistantConversationMessage(message),
  );
}

function extractModelMessageText(content: AssistantModelMessageInput["content"]): string {
  if (content === null) {
    return "";
  }

  if (Schema.is(Schema.String)(content)) {
    return content;
  }

  return content
    .filter((part) => part.type === "text")
    .map((part) => part.content)
    .join("");
}

function toAssistantConversationMessage(
  message: AssistantModelMessageInput,
): readonly AssistantConversationMessage[] {
  const content = extractModelMessageText(message.content);

  if (content === "") {
    return [];
  }

  if (message.role === "tool") {
    return [
      {
        content,
        name: "tool",
        role: "tool",
      },
    ];
  }

  return [
    {
      role: message.role,
      content,
    },
  ];
}

function toAssistantConversationMessagesFromUiMessage(
  message: AssistantUiMessageInput,
): readonly AssistantConversationMessage[] {
  if (message.role === "system") {
    return [];
  }

  const content = message.parts
    .map((part) => part.content)
    .join("")
    .trim();

  if (content === "") {
    return [];
  }

  return [
    {
      role: message.role,
      content,
    },
  ];
}
