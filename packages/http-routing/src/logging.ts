import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import { WideEvent, withWideEvent } from "effect-wide-event";

// oxlint-disable-next-line effect/prefer-option-over-null -- Trusted structured log fields may explicitly include JSON null.
export type StructuredLogValue = boolean | number | string | null;
export type StructuredLogRecord = Readonly<Record<string, StructuredLogValue>>;

export const logStructuredEvent = (record: StructuredLogRecord) =>
  Effect.logInfo("structured event").pipe(Effect.annotateLogs(record));

// Error payloads can contain credentials, SQL parameters, or request bodies.
// Classify the cause without serializing any of its values.
const extractRequestError = (cause: Cause.Cause<unknown>) => {
  if (Cause.hasDies(cause)) {
    return { errorType: "Defect", errorMessage: "HTTP request defect" };
  }
  if (Cause.hasFails(cause)) {
    return { errorType: "Failure", errorMessage: "HTTP request failed" };
  }
  return { errorType: "Interrupted", errorMessage: "HTTP request interrupted" };
};

export const withHttpWideEvent =
  (request: Request) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    Effect.suspend(() =>
      withWideEvent(effect, {
        service: "http-routing",
        method: request.method,
        // Omit URLs: even path segments can carry password-reset tokens.
        // Generate locally rather than accepting arbitrary transport header values.
        requestId: crypto.randomUUID(),
        envelope: { event: "http_routing.request", route_kind: "unmatched" },
        extractError: extractRequestError,
      }),
    );

export const annotateHttpResponse = (input: {
  readonly extraFields?: StructuredLogRecord;
  readonly response: Response;
  readonly routeKind: string;
}) =>
  WideEvent.set({
    ...input.extraFields,
    event: "http_routing.request",
    route_kind: input.routeKind,
    http_status: input.response.status,
    outcome:
      input.response.status >= 500
        ? "domain_error"
        : input.response.status >= 400
          ? "warning"
          : "ok",
  });
