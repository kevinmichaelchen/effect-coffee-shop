/**
 * The Coffee REST contract that sits beside the domain Apis: health, the
 * static menu, and who is signed in. It holds only types and endpoints, so the
 * UI can build its client from the same definition the Worker serves; the
 * handlers live in `api.ts`.
 *
 * @module
 */
import * as Schema from "effect/Schema";
import * as HttpApi from "effect/http-api/HttpApi";
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";
import * as HttpApiSchema from "effect/http-api/HttpApiSchema";
import { MenuView } from "@effect-coffee-shop/coffee-application/contracts";

/** The menu's element and list shapes, re-exported so clients decode the served type. */
export { MenuItemView, MenuView } from "@effect-coffee-shop/coffee-application/contracts";

export const HealthStatus = Schema.Struct({
  status: Schema.Literal("ok"),
}).annotate({ identifier: "HealthStatus" });
export type HealthStatus = typeof HealthStatus.Type;

/** Who the request acts for: nothing for a visitor, an account for the rest. */
export const ActorSummary = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("anonymous"),
  }),
  Schema.Struct({
    displayName: Schema.String,
    kind: Schema.Literals(["customer", "staff"] as const),
    userId: Schema.String,
  }),
]).annotate({ identifier: "ActorSummary" });
export type ActorSummary = typeof ActorSummary.Type;
export type SignedInActorSummary = Exclude<ActorSummary, { kind: "anonymous" }>;

class HealthApi extends HttpApiGroup.make("health", { topLevel: true }).add(
  HttpApiEndpoint.get("check", "/health", {
    success: HttpApiSchema.WithHeaders(HealthStatus, {
      "cache-control": Schema.Literal("no-store"),
    }),
  }),
) {}

class MenuApi extends HttpApiGroup.make("menu")
  .add(
    HttpApiEndpoint.get("list", "/", {
      success: MenuView,
    }),
  )
  .prefix("/menu") {}

class SessionApi extends HttpApiGroup.make("session")
  .add(
    HttpApiEndpoint.get("me", "/me", {
      success: ActorSummary,
    }),
  )
  .prefix("/") {}

export class CoffeeHttpApi extends HttpApi.make("coffee-order-api")
  .add(HealthApi)
  .add(MenuApi)
  .add(SessionApi) {}
