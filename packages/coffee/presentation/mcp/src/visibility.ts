import * as Effect from "effect/Effect";
import * as McpSchema from "effect/ai/McpSchema";
import * as McpServer from "effect/ai/McpServer";
import { isStaff } from "@effect-coffee-shop/coffee-domain/Actor";
import { McpActor } from "./actor.ts";
import { staffToolPrefix } from "./domain-tools.ts";

/** The generated `StaffApi_*` tools: the queue, any ticket, and the order lifecycle. */
const isStaffTool = (name: string) => name.startsWith(staffToolPrefix);

// Presentation only; the Api's middleware and each command's decide still authorize every call.
export const CoffeeMcpVisibility = McpServer.visibility(({ target }) =>
  isStaffTool(target)
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
