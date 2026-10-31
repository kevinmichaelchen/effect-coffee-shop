import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as SecureRandom from "effect/crypto/SecureRandom";
import { WideEvent, withWideEvent } from "effect-wide-event";

export type StructuredLogValue = boolean | number | string;
export type StructuredLogRecord = Readonly<Record<string, StructuredLogValue>>;

export const logStructuredEvent = (record: StructuredLogRecord) =>
  Effect.logInfo("structured event").pipe(Effect.annotateLogs(record));

class HttpRequestEvent extends Context.Service<HttpRequestEvent, { readonly requestId: string }>()(
  "@effect-coffee-shop/http-routing/logging/HttpRequestEvent",
) {}

export const withResponseRequestId = (response: Response) =>
  Effect.gen(function* () {
    const { requestId } = yield* HttpRequestEvent;
    const headers = new Headers(response.headers);
    headers.set("x-request-id", requestId);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  });

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
  (request: { readonly method: string; readonly requestId?: string }) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    Effect.gen(function* () {
      const existing = yield* Effect.serviceOption(HttpRequestEvent);
      if (Option.isSome(existing))
        return yield* effect.pipe(Effect.provideService(HttpRequestEvent, existing.value));
      const requestId = request.requestId ?? SecureRandom.uuidV4Unsafe();
      return yield* withWideEvent(effect, {
        service: "http-routing",
        method: request.method,
        // Omit URLs: even path segments can carry password-reset tokens.
        // Generate locally rather than accepting arbitrary transport header values.
        requestId,
        envelope: { event: "http_routing.request", route_kind: "unmatched" },
        extractError: extractRequestError,
      }).pipe(Effect.provideService(HttpRequestEvent, { requestId }));
    });

export const annotateHttpStatus = (input: {
  readonly extraFields?: StructuredLogRecord;
  readonly status: number;
  readonly routeKind: string;
}) =>
  WideEvent.setOptional({
    ...input.extraFields,
    event: "http_routing.request",
    route_kind: input.routeKind,
    http_status: input.status,
    outcome: input.status >= 500 ? "domain_error" : input.status >= 400 ? "warning" : "ok",
  });

export const annotateHttpResponse = (input: {
  readonly extraFields?: StructuredLogRecord;
  readonly response: Response;
  readonly routeKind: string;
}) =>
  annotateHttpStatus({
    extraFields: input.extraFields ?? {},
    status: input.response.status,
    routeKind: input.routeKind,
  });
