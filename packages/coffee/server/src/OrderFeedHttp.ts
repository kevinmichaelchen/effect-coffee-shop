import { Actor } from "@effect-coffee-shop/coffee-domain/Actor";
import { OrderFeed } from "@effect-coffee-shop/coffee-domain/Order/OrderFeed";
import { prepareRequest } from "@yielded/sync-platform-alchemy-cf";
import { Source } from "@yielded/sync";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { HttpServerRequest, HttpServerResponse } from "effect/http";
import { OrderFeedObject } from "./OrderFeed.ts";
import { actorHeader } from "./Session.ts";

/** Called only inside domainApi, after it replaces the untrusted actor header. */
export const orderFeedHttp = Effect.fn("OrderFeed.http")(function* () {
  const feeds = yield* OrderFeedObject;
  return Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const actor = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(Actor))(
      request.headers[actorHeader],
    );
    const address = yield* Source.matchPath(
      OrderFeed,
      new URL(request.url, "http://localhost").pathname,
    );
    if (Option.isNone(address)) return HttpServerResponse.empty({ status: 404 });
    const prepared = yield* prepareRequest(OrderFeed, {
      request,
      address: address.value,
      identity: {
        actorId: actor.userId,
        principal: { role: actor.kind, userId: actor.userId },
        // A live subscription outlives the request that opened it; the cookie is re-checked on reconnect.
        expiresAtMillis: (yield* Clock.currentTimeMillis) + 12 * 60 * 60 * 1000,
      },
    });
    return yield* feeds.getByName(`orders:${address.value.id}`).fetch(prepared);
  }).pipe(
    Effect.catchTags({
      SchemaError: () => Effect.succeed(HttpServerResponse.empty({ status: 401 })),
      ProtocolError: () => Effect.succeed(HttpServerResponse.empty({ status: 403 })),
      RequestParseError: () => Effect.succeed(HttpServerResponse.empty({ status: 400 })),
      InternalError: () => Effect.succeed(HttpServerResponse.empty({ status: 502 })),
      RouteNotFound: () => Effect.succeed(HttpServerResponse.empty({ status: 404 })),
    }),
  );
});
