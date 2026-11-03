/**
 * Serves the domain's `CustomerApi` and `StaffApi` as MCP tools generated
 * from the Apis themselves (`DomainAi.toMcp`): one tool per command
 * (`CustomerApi_PlaceOrder_send`) and per read (`CustomerApi_Cart_get`).
 * Each call runs through the Api's own handlers and `Session` middleware in
 * process, so a tool authorizes exactly as the app's Domain RPC does, and a
 * rejection comes back to the model as the tool's typed failure.
 *
 * @module
 */
import * as DomainAi from "@alchemy.run/domain/Ai";
import { actorHeaders } from "@effect-coffee-shop/coffee-application/ActorHeader";
import { CustomerApi } from "@effect-coffee-shop/coffee-domain/CustomerApi.api";
import { StaffApi } from "@effect-coffee-shop/coffee-domain/StaffApi.api";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { McpActor } from "./actor.ts";

/** The prefix of every staff tool; visibility hides them from everyone else. */
export const staffToolPrefix = `${StaffApi.apiName}_`;

export const CoffeeDomainToolsLive = Layer.unwrap(
  Effect.map(McpActor, (resolver) => {
    const options = {
      // Each call carries the OAuth-resolved actor to the Api's `Session` middleware, not the
      // MCP client's own bearer token, which it cannot read. An actor that cannot be resolved
      // sends no actor header, and the middleware answers `Unauthorized`.
      headers: resolver.current.pipe(
        Effect.map(actorHeaders),
        Effect.orElseSucceed(() => ({})),
      ),
    };
    return Layer.mergeAll(DomainAi.toMcp(CustomerApi, options), DomainAi.toMcp(StaffApi, options));
  }),
);
