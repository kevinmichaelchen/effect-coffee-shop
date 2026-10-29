import * as HashSet from "effect/HashSet";
import * as Effect from "effect/Effect";
import * as McpSchema from "effect/ai/McpSchema";
import * as McpServer from "effect/ai/McpServer";
import { isStaff } from "@effect-coffee-shop/coffee-domain/Actor";
import { McpActor } from "./actor.ts";

const staffTools = HashSet.make("start_brewing", "mark_ready", "pick_up_order", "cancel_order");

// Presentation only; CoffeeOrderApp still authorizes every invocation.
export const CoffeeMcpVisibility = McpServer.visibility(({ target }) =>
  HashSet.has(staffTools, target)
    ? Effect.gen(function* () {
        const resolver = yield* McpActor;
        const actor = yield* resolver.current;
        return actor.kind !== "anonymous" && isStaff(actor);
      }).pipe(
        Effect.mapError(
          () => new McpSchema.InternalError({ message: "Unable to resolve MCP actor" }),
        ),
      )
    : Effect.succeed(true),
);
