import { Effect, Layer, Option, Schema } from "effect";
import type { HttpClient } from "effect/http";
import { Http, ManagedResource, type Update } from "foldkit";
import type * as Domain from "@alchemy.run/domain";
import {
  acquireAssistantWorker,
  AssistantWorker,
} from "#features/assistant/api/assistant-worker.ts";
import { acquireMicrophone, Microphone } from "#features/assistant/api/microphone.ts";
import { wantsWorker } from "#features/assistant/lib/state.ts";
import { CustomerConnection, StaffConnection } from "#features/coffee-shop/api/domain-clients.ts";
import { Tracing } from "#app/tracing.ts";
import { Message } from "../message.ts";
import type { Model } from "#app/model.ts";

const when = (condition: boolean): Option.Option<null> =>
  condition ? Option.some(null) : Option.none();

const reason = (error: unknown): string =>
  Schema.decodeUnknownOption(Schema.Struct({ message: Schema.String }))(error).pipe(
    Option.match({ onNone: () => "Something went wrong.", onSome: ({ message }) => message }),
  );

/**
 * Services every Command and Subscription may use for the app's whole
 * lifetime: the app-wide HttpClient, both Domain Api clients, whose
 * connections outlive any page, and the tracer that exports their spans.
 * `Tracing` is last so its HTTP settings win when a trace URL is configured.
 */
export const resources = Layer.mergeAll(Http.layer, CustomerConnection, StaffConnection, Tracing);

/** The services Commands and Subscriptions may use: the resources above, plus each managed resource while it is held. */
export type AppServices =
  | HttpClient.HttpClient
  | Domain.Api.ClientKey<"CustomerApi">
  | Domain.Api.ClientKey<"StaffApi">
  | ManagedResource.ServicesOf<typeof managedResources>;

/** What every update function returns: the next Model and the Commands to run. */
export type UpdateReturn = Update.Return<Model, Message, AppServices>;

/** One step in a composed update: the next Model and the Commands to run. */
export type UpdateStep = Update.Step<Model, Message, AppServices>;

/** The model decides when the worker and the microphone exist. */
export const managedResources = ManagedResource.make<Model, Message>()((entry) => ({
  assistantWorker: entry(Schema.Option(Schema.Null), {
    resource: AssistantWorker,
    modelToMaybeRequirements: (model) => when(wantsWorker(model.assistant)),
    acquire: () => acquireAssistantWorker,
    release: () => Effect.void,
    onAcquired: () => Message.AcquiredAssistantWorker(),
    onReleased: () => Message.ReleasedAssistantWorker(),
    onAcquireError: (error) => Message.FailedAcquireAssistantWorker({ message: reason(error) }),
  }),
  microphone: entry(Schema.Option(Schema.Null), {
    resource: Microphone,
    modelToMaybeRequirements: (model) => when(model.assistant.recording !== "idle"),
    acquire: () => acquireMicrophone,
    release: () => Effect.void,
    onAcquired: () => Message.AcquiredMicrophone(),
    onReleased: () => Message.ReleasedMicrophone(),
    onAcquireError: (error) => Message.FailedAcquireMicrophone({ message: reason(error) }),
  }),
}));
