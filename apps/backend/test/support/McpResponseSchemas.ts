import * as Schema from "effect/Schema";

export const StringIdResponseSchema = Schema.Struct({ id: Schema.String });

export const InitializeResponseSchema = Schema.Struct({
  protocolVersion: Schema.String,
  serverInfo: Schema.Struct({ name: Schema.String, version: Schema.String }),
});

export const ToolListResponseSchema = Schema.Struct({
  tools: Schema.Array(Schema.Struct({ name: Schema.String })),
});

export const ResourceListResponseSchema = Schema.Struct({
  resources: Schema.Array(Schema.Struct({ uri: Schema.String })),
});

export const PromptListResponseSchema = Schema.Struct({
  prompts: Schema.Array(Schema.Struct({ name: Schema.String })),
});

export const ToolCallOrderResponseSchema = Schema.Struct({
  isError: Schema.optionalKey(Schema.Boolean),
  structuredContent: Schema.Struct({ id: Schema.String }),
});

export const ToolCallConfirmationResponseSchema = Schema.Struct({
  structuredContent: Schema.Struct({ confirmationId: Schema.String }),
});

export const ResourceReadResponseSchema = Schema.Struct({
  contents: Schema.Array(
    Schema.Struct({
      mimeType: Schema.optionalKey(Schema.String),
      text: Schema.optionalKey(Schema.String),
      uri: Schema.optionalKey(Schema.String),
    }),
  ),
});

export const PromptGetResponseSchema = Schema.Struct({
  messages: Schema.Array(
    Schema.Struct({
      content: Schema.Struct({
        text: Schema.optionalKey(Schema.String),
        type: Schema.optionalKey(Schema.String),
      }),
    }),
  ),
});
