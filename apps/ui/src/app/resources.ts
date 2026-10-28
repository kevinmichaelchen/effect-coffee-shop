import { Effect, Option, Schema } from "effect";
import { ManagedResource } from "foldkit";
import {
  acquireAssistantWorker,
  AssistantWorker,
} from "#features/assistant/api/assistant-worker.ts";
import { acquireMicrophone, Microphone } from "#features/assistant/api/microphone.ts";
import { wantsWorker } from "#features/assistant/lib/state.ts";
import { Message } from "#app/message.ts";
import type { Model } from "#app/model.ts";

const when = (condition: boolean): Option.Option<null> =>
  condition ? Option.some(null) : Option.none();

const reason = (error: unknown): string =>
  Schema.decodeUnknownOption(Schema.Struct({ message: Schema.String }))(error).pipe(
    Option.match({ onNone: () => "Something went wrong.", onSome: ({ message }) => message }),
  );

/** The services Commands and Subscriptions may use while their resource is held. */
export type AppServices = ManagedResource.ServicesOf<typeof managedResources>;

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
