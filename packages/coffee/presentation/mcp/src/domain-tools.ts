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

/**
 * The headers each tool call carries to the Api's `Session` middleware: the
 * OAuth-resolved actor, not the MCP client's own bearer token, which the
 * middleware cannot read. An actor that cannot be resolved sends no actor,
 * and the middleware answers `Unauthorized`.
 */
const headersFor = (resolver: McpActor["Service"]) =>
  resolver.current.pipe(
    Effect.map(actorHeaders),
    Effect.orElseSucceed(() => ({})),
  );

export const CoffeeDomainToolsLive = Layer.unwrap(
  Effect.map(McpActor, (resolver) => {
    const options = { headers: headersFor(resolver) };
    return Layer.mergeAll(DomainAi.toMcp(CustomerApi, options), DomainAi.toMcp(StaffApi, options));
  }),
);
