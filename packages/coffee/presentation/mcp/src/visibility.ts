import * as Effect from "effect/Effect";
import * as McpSchema from "effect/ai/McpSchema";
import * as McpServer from "effect/ai/McpServer";
import * as Option from "effect/Option";
import { isStaff } from "@effect-coffee-shop/coffee-domain/Actor";
import { McpActor } from "./actor.ts";
import { staffToolPrefix } from "./domain-tools.ts";

/** The generated `StaffApi_*` tools: the queue, any ticket, and the order lifecycle. */
const isStaffTool = (name: string) => name.startsWith(staffToolPrefix);

/** Whether the caller is staff, which only staff tools need to know. */
const callerIsStaff = Effect.gen(function* () {
  const resolver = yield* McpActor;
  const actor = yield* resolver.current;
  return actor.kind !== "anonymous" && isStaff(actor);
}).pipe(
  Effect.mapError(() => new McpSchema.InternalError({ message: "Unable to resolve MCP actor" })),
);

// Presentation only; the Api's middleware and each command's decide still authorize every call.
// The actor is resolved only for staff tools, so listing customer tools costs no lookup.
export const CoffeeMcpVisibility = McpServer.visibility(({ target }) =>
  Option.match(Option.liftPredicate(target, isStaffTool), {
    onNone: () => Effect.succeed(true),
    onSome: () => callerIsStaff,
  }),
);
