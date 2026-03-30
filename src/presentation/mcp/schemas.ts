import * as Schema from "effect/Schema";
import {
  DrinkNotFoundError,
  InvalidOrderInputError,
  InvalidOrderStatusTransitionError,
  OrderNotFoundError,
} from "#domain/errors";

export const AppErrorSchema = Schema.Union([
  DrinkNotFoundError,
  InvalidOrderInputError,
  OrderNotFoundError,
  InvalidOrderStatusTransitionError,
]).annotate({ identifier: "AppError" });

export type AppError = typeof AppErrorSchema.Type;

export class CodeModeArgumentsError extends Schema.TaggedErrorClass<CodeModeArgumentsError>()(
  "CodeModeArgumentsError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 400 },
) {}

export class CodeModeExecutionError extends Schema.TaggedErrorClass<CodeModeExecutionError>()(
  "CodeModeExecutionError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 500 },
) {}

export const CodeModeToolErrorSchema = Schema.Union([
  AppErrorSchema,
  CodeModeArgumentsError,
  CodeModeExecutionError,
]).annotate({ identifier: "CodeModeToolError" });

export type CodeModeToolError = typeof CodeModeToolErrorSchema.Type;
