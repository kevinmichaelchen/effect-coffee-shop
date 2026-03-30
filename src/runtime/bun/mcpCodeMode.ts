import vm from "node:vm";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Predicate from "effect/Predicate";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import {
  CodeModeFailureSchema,
  type CodeModeFailure,
} from "#presentation/mcp/code-mode-description";
import {
  AppErrorSchema,
  CodeModeArgumentsError,
  CodeModeExecutionError,
} from "#presentation/mcp/schemas";

const CODE_MODE_TIMEOUT_MS = 1_000;

const encodeCodeModeArgumentsError = Schema.encodeSync(CodeModeArgumentsError);
const encodeCodeModeExecutionError = Schema.encodeSync(CodeModeExecutionError);

const toExecutionError = (message: string) =>
  encodeCodeModeExecutionError(new CodeModeExecutionError({ message }));

const toJsonValue = (value: unknown): Schema.Json => {
  if (value === undefined) {
    return null;
  }

  const json = JSON.stringify(value, (_key, nextValue) => {
    if (Predicate.isError(nextValue)) {
      return {
        name: nextValue.name,
        message: nextValue.message,
      };
    }

    return typeof nextValue === "bigint" ? nextValue.toString() : nextValue;
  });

  return (json === undefined ? null : JSON.parse(json)) as Schema.Json;
};

const toJsonError = (cause: unknown): Schema.Json => {
  if (Predicate.isError(cause)) {
    return toExecutionError(cause.message);
  }

  if (Array.isArray(cause) || Predicate.isObject(cause)) {
    try {
      return toJsonValue(cause);
    } catch (error) {
      return toExecutionError(Predicate.isError(error) ? error.message : String(error));
    }
  }

  return toExecutionError(String(cause));
};

const decodeInput = <Input>(
  schema: Schema.Decoder<Input, never>,
  input: unknown,
  allowEmptyObject: boolean,
) => {
  const result = Schema.decodeUnknownResult(schema)(
    allowEmptyObject && input === undefined ? {} : input,
  );

  if (!Result.isFailure(result)) {
    return result.success;
  }

  throw encodeCodeModeArgumentsError(
    new CodeModeArgumentsError({
      message: new Schema.SchemaError(result.failure).message,
    }),
  );
};

const encodeActionResult = async <Output>(
  effect: Effect.Effect<Output, any>,
  successSchema: Schema.Encoder<Output, never>,
) => {
  const exit = await Effect.runPromiseExit(
    effect.pipe(Effect.map((value) => Schema.encodeUnknownSync(successSchema)(value))),
  );

  if (Exit.isSuccess(exit)) {
    return exit.value;
  }

  const error = Cause.findError(exit.cause);
  if (!Result.isFailure(error)) {
    const encodedError = Schema.encodeUnknownResult(AppErrorSchema)(error.success);
    if (!Result.isFailure(encodedError)) {
      throw encodedError.success;
    }
  }

  throw toExecutionError(Cause.pretty(exit.cause));
};

export const toCodeModeFailure = (cause: unknown): CodeModeFailure => {
  const decoded = Schema.decodeUnknownResult(CodeModeFailureSchema)(cause);
  if (!Result.isFailure(decoded)) {
    return decoded.success;
  }

  return {
    error: toJsonError(cause),
    logs: [],
  };
};

export const makeActionCall =
  <Input, Output>(
    parametersSchema: Schema.Decoder<Input, never>,
    successSchema: Schema.Encoder<Output, never>,
    run: (input: Input) => Effect.Effect<Output, unknown>,
    options?: { readonly allowEmptyObject?: boolean },
  ) =>
  async (input?: unknown) => {
    try {
      const decodedInput = decodeInput(parametersSchema, input, options?.allowEmptyObject === true);
      return await encodeActionResult(run(decodedInput), successSchema);
    } catch (error) {
      throw toJsonError(error);
    }
  };

export const executeCodeMode = async (
  code: string,
  codemode: Record<string, (...args: ReadonlyArray<unknown>) => Promise<unknown>>,
): Promise<{ readonly result: Schema.Json; readonly logs: ReadonlyArray<string> }> => {
  const logs: Array<string> = [];
  const context = vm.createContext(
    {
      codemode: Object.freeze(codemode),
      console: Object.freeze({
        log: (...args: ReadonlyArray<unknown>) => {
          logs.push(args.map((arg) => String(arg)).join(" "));
        },
        warn: (...args: ReadonlyArray<unknown>) => {
          logs.push(`[warn] ${args.map((arg) => String(arg)).join(" ")}`);
        },
        error: (...args: ReadonlyArray<unknown>) => {
          logs.push(`[error] ${args.map((arg) => String(arg)).join(" ")}`);
        },
      }),
    },
    {
      codeGeneration: {
        strings: false,
        wasm: false,
      },
    },
  );

  try {
    const execution = vm.runInContext(
      `
      (async () => {
        const fn = (${code});
        if (typeof fn !== "function") {
          throw { _tag: "CodeModeExecutionError", message: "code must evaluate to an async arrow function" };
        }
        return await fn();
      })()
      `,
      context,
      { timeout: CODE_MODE_TIMEOUT_MS },
    );

    const result = await Promise.race([
      execution,
      new Promise((_, reject) =>
        setTimeout(() => {
          reject(toExecutionError(`code execution timed out after ${CODE_MODE_TIMEOUT_MS}ms`));
        }, CODE_MODE_TIMEOUT_MS),
      ),
    ]);

    return {
      result: toJsonValue(result),
      logs,
    };
  } catch (error) {
    throw {
      error: toJsonError(error),
      logs,
    };
  }
};
