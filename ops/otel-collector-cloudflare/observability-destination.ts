import * as Provider from "alchemy/Provider";
import { createPhysicalName, Resource } from "alchemy";
import { CloudflareEnvironment } from "alchemy/Cloudflare";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";

const cloudflareApiBaseUrl = "https://api.cloudflare.com/client/v4";

const WorkersObservabilityDatasetSchema = Schema.Literals([
  "opentelemetry-traces",
  "opentelemetry-logs",
] as const);

export type WorkersObservabilityDataset = typeof WorkersObservabilityDatasetSchema.Type;

type HeaderEntry = readonly [name: string, value: string];

export interface WorkersObservabilityDestinationProps {
  apiToken?: Redacted.Redacted<string>;
  dataset: WorkersObservabilityDataset;
  enabled?: boolean;
  headers?: ReadonlyArray<HeaderEntry>;
  name?: string;
  skipPreflightCheck?: boolean;
  url: string;
}

export interface WorkersObservabilityDestinationAttributes {
  dataset: WorkersObservabilityDataset;
  destinationConf: string;
  enabled: boolean;
  headers: ReadonlyArray<HeaderEntry>;
  logpushJob: number;
  name: string;
  skipPreflightCheck: boolean;
  slug: string;
  url: string;
}

export type WorkersObservabilityDestination = Resource<
  "Cloudflare.WorkersObservabilityDestination",
  WorkersObservabilityDestinationProps,
  WorkersObservabilityDestinationAttributes
>;

const CloudflareWorkersObservabilityDestinationSchema = Schema.Struct({
  configuration: Schema.Struct({
    destination_conf: Schema.String,
    logpushDataset: WorkersObservabilityDatasetSchema,
    logpushJob: Schema.Number,
    type: Schema.Literal("logpush"),
    url: Schema.String,
  }),
  enabled: Schema.Boolean,
  name: Schema.String,
  scripts: Schema.Array(Schema.String),
  slug: Schema.String,
});

const DestinationListResponseSchema = Schema.Struct({
  result: Schema.Array(CloudflareWorkersObservabilityDestinationSchema),
});

const DestinationResponseSchema = Schema.Struct({
  result: CloudflareWorkersObservabilityDestinationSchema,
});

export class WorkersObservabilityDestinationError extends Data.TaggedError(
  "WorkersObservabilityDestinationError",
)<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export const WorkersObservabilityDestination =
  Resource<WorkersObservabilityDestination>(
    "Cloudflare.WorkersObservabilityDestination",
  );

const toHeadersObject = (
  headers: ReadonlyArray<HeaderEntry>,
): Record<string, string> => Object.fromEntries(headers);

type CloudflareCredentials = Effect.Success<typeof CloudflareEnvironment>;

const authHeaders = (
  credentials: CloudflareCredentials,
  apiToken: Redacted.Redacted<string> | undefined,
): Record<string, string> => {
  if (apiToken !== undefined) {
    return { Authorization: `Bearer ${Redacted.value(apiToken)}` };
  }

  switch (credentials.type) {
    case "apiKey":
      return {
        "X-Auth-Email": Redacted.value(credentials.email),
        "X-Auth-Key": Redacted.value(credentials.apiKey),
      };
    case "apiToken":
      return {
        Authorization: `Bearer ${Redacted.value(credentials.apiToken)}`,
      };
    case "oauth":
      return {
        Authorization: `Bearer ${Redacted.value(credentials.accessToken)}`,
      };
  }
};

const responseErrorMessage = (response: Response) =>
  Effect.tryPromise({
    try: () => response.text(),
    catch: (cause) =>
      new WorkersObservabilityDestinationError({
        message: "Unable to read Cloudflare error response.",
        cause,
      }),
  }).pipe(
    Effect.map((body) => (body.length > 0 ? body : response.statusText)),
  );

const observabilityAuthHint = (
  props: WorkersObservabilityDestinationProps,
  message: string,
): string =>
  props.apiToken === undefined && message.includes('"code":10000')
    ? [
        message,
        "Hint: set CLOUDFLARE_OBSERVABILITY_API_TOKEN to an account-level Cloudflare API token with Workers Observability Write permission.",
      ].join("\n")
    : message;

const failResponse = (
  props: WorkersObservabilityDestinationProps,
  operation: string,
  response: Response,
) =>
  responseErrorMessage(response).pipe(
    Effect.flatMap((message) =>
      Effect.fail(
        new WorkersObservabilityDestinationError({
          message: `${operation}: ${observabilityAuthHint(props, message)}`,
        }),
      ),
    ),
  );

const decodeJsonResponse = <A, I, R>(
  schema: Schema.Schema<A, I, R>,
  response: Response,
) =>
  Effect.tryPromise({
    try: () => response.json() as Promise<unknown>,
    catch: (cause) =>
      new WorkersObservabilityDestinationError({
        message: "Unable to parse Cloudflare response as JSON.",
        cause,
      }),
  }).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(schema)),
    Effect.mapError(
      (cause) =>
        new WorkersObservabilityDestinationError({
          message: "Cloudflare destination response did not match schema.",
          cause,
        }),
    ),
  );

const toAttributes = (
  destination: typeof CloudflareWorkersObservabilityDestinationSchema.Type,
  props: WorkersObservabilityDestinationProps,
): WorkersObservabilityDestinationAttributes => ({
  dataset: destination.configuration.logpushDataset,
  destinationConf: destination.configuration.destination_conf,
  enabled: destination.enabled,
  headers: props.headers ?? [],
  logpushJob: destination.configuration.logpushJob,
  name: destination.name,
  skipPreflightCheck: props.skipPreflightCheck ?? true,
  slug: destination.slug,
  url: destination.configuration.url,
});

export const WorkersObservabilityDestinationProvider = () =>
  Provider.effect(
    WorkersObservabilityDestination,
    Effect.gen(function* () {
      const credentials = yield* CloudflareEnvironment;
      const destinationsPath = `/accounts/${credentials.accountId}/workers/observability/destinations`;

      const request = (
        props: WorkersObservabilityDestinationProps,
        path: string,
        init: RequestInit = {},
      ) =>
        Effect.tryPromise({
          try: () =>
            fetch(`${cloudflareApiBaseUrl}${path}`, {
              ...init,
              headers: {
                ...authHeaders(credentials, props.apiToken),
                ...(init.body === undefined
                  ? {}
                  : { "Content-Type": "application/json" }),
              },
            }),
          catch: (cause) =>
            new WorkersObservabilityDestinationError({
              message: "Cloudflare Workers observability request failed.",
              cause,
            }),
        });

      const listDestinations = (
        props: WorkersObservabilityDestinationProps,
      ) =>
        Effect.gen(function* () {
          const response = yield* request(
            props,
            `${destinationsPath}?per_page=100`,
          );
          if (!response.ok) {
            return yield* failResponse(
              props,
              "Unable to list Workers observability destinations",
              response,
            );
          }
          return yield* decodeJsonResponse(
            DestinationListResponseSchema,
            response,
          ).pipe(Effect.map((payload) => payload.result));
        });

      const getDestinationByName = (
        props: WorkersObservabilityDestinationProps,
        name: string,
      ) =>
        listDestinations(props).pipe(
          Effect.map((destinations) =>
            destinations.find((destination) => destination.name === name),
          ),
        );

      const createPayload = (
        props: WorkersObservabilityDestinationProps,
      ) => ({
        configuration: {
          headers: toHeadersObject(props.headers ?? []),
          logpushDataset: props.dataset,
          type: "logpush",
          url: props.url,
        },
        enabled: props.enabled ?? true,
        name: props.name,
        skipPreflightCheck: props.skipPreflightCheck ?? true,
      });

      const updatePayload = (
        props: WorkersObservabilityDestinationProps,
      ) => ({
        configuration: {
          headers: toHeadersObject(props.headers ?? []),
          type: "logpush",
          url: props.url,
        },
        enabled: props.enabled ?? true,
      });

      return WorkersObservabilityDestination.Provider.of({
        stables: ["slug", "logpushJob"],
        reconcile: Effect.fnUntraced(function* ({ id, news, output }) {
          const name =
            news.name ??
            output?.name ??
            (yield* createPhysicalName({ id, maxLength: 128 }));
          const nextProps = {
            ...news,
            name,
          };
          const existing = yield* getDestinationByName(nextProps, name);
          const response =
            existing === undefined
              ? yield* request(nextProps, destinationsPath, {
                  body: JSON.stringify(createPayload(nextProps)),
                  method: "POST",
                })
              : yield* request(nextProps, `${destinationsPath}/${existing.slug}`, {
                  body: JSON.stringify(updatePayload(nextProps)),
                  method: "PATCH",
                });

          if (!response.ok) {
            return yield* failResponse(
              nextProps,
              `Unable to ${
                existing === undefined ? "create" : "update"
              } Workers observability destination '${name}'`,
              response,
            );
          }

          const payload = yield* decodeJsonResponse(
            DestinationResponseSchema,
            response,
          );
          return toAttributes(payload.result, nextProps);
        }),
        delete: Effect.fnUntraced(function* ({ olds, output }) {
          const response = yield* request(
            olds,
            `${destinationsPath}/${output.slug}`,
            { method: "DELETE" },
          );
          if (!response.ok && response.status !== 404) {
            return yield* failResponse(
              olds,
              `Unable to delete Workers observability destination '${output.name}'`,
              response,
            );
          }
        }),
      });
    }),
  );
