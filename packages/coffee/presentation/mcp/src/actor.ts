import type { InternalAppError } from "@effect-coffee-shop/coffee-application/errors";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import {
  CurrentActor,
  type AppActor,
  type AuthenticationRequiredError,
} from "@effect-coffee-shop/coffee-application/CurrentActor";

/** Resolve authority for each invocation; MCP client/session IDs are not identities. */
export class McpActor extends Context.Service<
  McpActor,
  {
    readonly current: Effect.Effect<AppActor, AuthenticationRequiredError | InternalAppError>;
  }
>()("@effect-coffee-shop/coffee-mcp/actor/McpActor") {}

export const withMcpActor = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.flatMap(McpActor, ({ current }) =>
    Effect.flatMap(current, (actor) => Effect.provideService(effect, CurrentActor, actor)),
  );
