/**
 * Serves the Coffee REST contract defined in `contract.ts`: health, the static
 * menu, and who is signed in. Orders, carts and checkout are served by
 * `CustomerApi` and `StaffApi` from the domain package.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import * as HttpApiSchema from "effect/http-api/HttpApiSchema";
import { menuItems } from "@effect-coffee-shop/coffee-domain/Menu/Menu";
import {
  type AppActor,
  CurrentActor,
  isAuthenticatedActor,
} from "@effect-coffee-shop/coffee-application/CurrentActor";
import { toMenuView } from "@effect-coffee-shop/coffee-application/contracts";
import { type ActorSummary, CoffeeHttpApi, type HealthStatus } from "./contract.ts";

const HEALTH_STATUS: HealthStatus = { status: "ok" };

const toActorSummary = (actor: AppActor): ActorSummary =>
  isAuthenticatedActor(actor)
    ? {
        displayName: actor.displayName,
        kind: actor.kind === "system" ? "staff" : actor.kind,
        userId: actor.userId,
      }
    : { kind: "anonymous" };

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
