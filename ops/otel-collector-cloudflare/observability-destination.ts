import { Resource, type Context } from "alchemy";

import {
  createCloudflareApi,
  type CloudflareApi,
  type CloudflareApiOptions,
} from "../../node_modules/alchemy/src/cloudflare/api.ts";

type WorkersObservabilityDataset =
  | "opentelemetry-traces"
  | "opentelemetry-logs";

type HeaderEntry = readonly [name: string, value: string];

interface WorkersObservabilityDestinationProps extends CloudflareApiOptions {
  dataset: WorkersObservabilityDataset;
  enabled?: boolean;
  headers?: ReadonlyArray<HeaderEntry>;
  name?: string;
  skipPreflightCheck?: boolean;
  url: string;
}

interface CloudflareWorkersObservabilityDestination {
  configuration: {
    destination_conf: string;
    logpushDataset: WorkersObservabilityDataset;
    logpushJob: number;
    type: "logpush";
    url: string;
  };
  enabled: boolean;
  name: string;
  scripts: ReadonlyArray<string>;
  slug: string;
}

export interface WorkersObservabilityDestination
  extends WorkersObservabilityDestinationProps {
  destinationConf: string;
  logpushJob: number;
  name: string;
  slug: string;
}

const destinationsPath = (api: CloudflareApi): string =>
  `/accounts/${api.accountId}/workers/observability/destinations`;

const destinationPath = (api: CloudflareApi, slug: string): string =>
  `${destinationsPath(api)}/${slug}`;

const toHeadersObject = (
  headers: ReadonlyArray<HeaderEntry>,
): { [key: string]: string } => Object.fromEntries(headers);

const responseErrorMessage = async (response: Response): Promise<string> => {
  const body = await response.text();
  return body.length > 0 ? body : response.statusText;
};

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

const parseDestinationList = async (
  response: Response,
): Promise<ReadonlyArray<CloudflareWorkersObservabilityDestination>> => {
  const payload = (await response.json()) as {
    result?: ReadonlyArray<CloudflareWorkersObservabilityDestination>;
  };
  return payload.result ?? [];
};

const parseDestination = async (
  response: Response,
): Promise<CloudflareWorkersObservabilityDestination> => {
  const payload = (await response.json()) as {
    result?: CloudflareWorkersObservabilityDestination;
  };
  if (payload.result === undefined) {
    throw new Error("Cloudflare destination response did not include a result");
  }
  return payload.result;
};

const getDestinationByName = async (
  api: CloudflareApi,
  props: WorkersObservabilityDestinationProps,
  name: string,
): Promise<CloudflareWorkersObservabilityDestination | undefined> => {
  const response = await api.get(`${destinationsPath(api)}?per_page=100`);
  if (!response.ok) {
    const message = observabilityAuthHint(
      props,
      await responseErrorMessage(response),
    );
    throw new Error(
      `Unable to list Workers observability destinations: ${message}`,
    );
  }

  return (await parseDestinationList(response)).find(
    (destination) => destination.name === name,
  );
};

const createPayload = (props: WorkersObservabilityDestinationProps) => ({
  configuration: {
    headers: toHeadersObject(props.headers ?? []),
    logpushDataset: props.dataset,
    type: "logpush" as const,
    url: props.url,
  },
  enabled: props.enabled ?? true,
  name: props.name,
  skipPreflightCheck: props.skipPreflightCheck ?? true,
});

const updatePayload = (props: WorkersObservabilityDestinationProps) => ({
  configuration: {
    headers: toHeadersObject(props.headers ?? []),
    type: "logpush" as const,
    url: props.url,
  },
  enabled: props.enabled ?? true,
});

export const WorkersObservabilityDestination = Resource(
  "cloudflare::WorkersObservabilityDestination",
  async function (
    this: Context<WorkersObservabilityDestination>,
    id: string,
    props: WorkersObservabilityDestinationProps,
  ): Promise<WorkersObservabilityDestination> {
    const api = await createCloudflareApi(props);
    const name =
      props.name ?? this.output?.name ?? this.scope.createPhysicalName(id);
    const nextProps = {
      ...props,
      name,
    } satisfies WorkersObservabilityDestinationProps;
    const existing = await getDestinationByName(api, nextProps, name);

    if (this.phase === "delete") {
      if (existing !== undefined) {
        const response = await api.delete(destinationPath(api, existing.slug));
        if (!response.ok && response.status !== 404) {
          const message = observabilityAuthHint(
            nextProps,
            await responseErrorMessage(response),
          );
          throw new Error(
            `Unable to delete Workers observability destination '${name}': ${message}`,
          );
        }
      }
      return this.destroy();
    }

    const response =
      existing === undefined
        ? await api.post(destinationsPath(api), createPayload(nextProps))
        : await api.patch(
            destinationPath(api, existing.slug),
            updatePayload(nextProps),
          );

    if (!response.ok) {
      const message = observabilityAuthHint(
        nextProps,
        await responseErrorMessage(response),
      );
      throw new Error(
        `Unable to ${existing === undefined ? "create" : "update"} Workers observability destination '${name}': ${message}`,
      );
    }

    const destination = await parseDestination(response);

    return this.create({
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
  },
);
