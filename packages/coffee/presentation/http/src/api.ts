/**
 * Defines the Coffee REST endpoints that sit beside the domain Apis: health,
 * the static menu, and who is signed in. Orders, carts and checkout are
 * served by `CustomerApi` and `StaffApi` from the domain package.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as HttpApi from "effect/http-api/HttpApi";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";
import * as HttpApiSchema from "effect/http-api/HttpApiSchema";
import { menuItems } from "@effect-coffee-shop/coffee-domain/Menu/Menu";
import {
  type AppActor,
  CurrentActor,
  anonymousActor,
  isAuthenticatedActor,
} from "@effect-coffee-shop/coffee-application/CurrentActor";
import { MenuView, toMenuView } from "@effect-coffee-shop/coffee-application/contracts";

const HealthStatus = Schema.Struct({
  status: Schema.Literal("ok"),
}).annotate({ identifier: "HealthStatus" });
const HEALTH_STATUS: typeof HealthStatus.Type = { status: "ok" };

const ActorSummary = Schema.Struct({
  displayName: Schema.optionalKey(Schema.String),
  kind: Schema.Literals(["anonymous", "customer", "staff"] as const),
  userId: Schema.optionalKey(Schema.String),
}).annotate({ identifier: "ActorSummary" });

type ActorSummary = typeof ActorSummary.Type;

const toActorSummary = (actor: AppActor): ActorSummary =>
  isAuthenticatedActor(actor)
    ? {
        displayName: actor.displayName,
        kind: actor.kind === "system" ? "staff" : actor.kind,
        userId: actor.userId,
      }
    : anonymousActor;

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

const HealthApiLive = HttpApiBuilder.group(CoffeeHttpApi, "health", (handlers) =>
  handlers.handle("check", () =>
    Effect.succeed(
      HttpApiSchema.withHeaders({
        body: HEALTH_STATUS,
        headers: { "cache-control": "no-store" },
      }),
    ),
  ),
);

const MenuApiLive = HttpApiBuilder.group(CoffeeHttpApi, "menu", (handlers) =>
  handlers.handle("list", () => Effect.succeed(toMenuView(menuItems))),
);

const SessionApiLive = HttpApiBuilder.group(CoffeeHttpApi, "session", (handlers) =>
  handlers.handle("me", () =>
    Effect.gen(function* () {
      return toActorSummary(yield* CurrentActor);
    }),
  ),
);

export const CoffeeHttpApiLive = Layer.provide(
  HttpApiBuilder.layer(CoffeeHttpApi, { openapiPath: "/openapi.json" }),
  [HealthApiLive, MenuApiLive, SessionApiLive],
);
