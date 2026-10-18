/**
 * Implements the domain's `Session` middleware. The Worker resolves who is
 * calling from their auth session, then hands the Api a request carrying
 * that actor in a header only the Worker sets: it removes any copy a client
 * sent first.
 *
 * @module
 */
import { Actor } from "@effect-coffee-shop/coffee-domain/Actor";
import { CurrentActor } from "@effect-coffee-shop/coffee-domain/CurrentActor.context";
import { Session, Unauthorized } from "@effect-coffee-shop/coffee-domain/Session.middleware";
import {
  type AppActor,
  isAuthenticatedActor,
} from "@effect-coffee-shop/coffee-application/CurrentActor";
import * as Effect from "effect/Effect";
import * as Headers from "effect/http/Headers";
import { HttpServerRequest } from "effect/http/HttpServerRequest";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

/** Set by the Worker after authenticating; never trusted from a client. */
export const actorHeader = "x-coffee-actor";

const ActorJson = Schema.fromJsonString(Actor);
const encodeActor = Schema.encodeSync(ActorJson);
const decodeActor = Schema.decodeUnknownOption(ActorJson);

/** The header value carrying a signed-in actor; none for an anonymous caller. */
export const actorHeaderValue = (actor: AppActor): Option.Option<string> =>
  Option.map(Option.liftPredicate(actor, isAuthenticatedActor), encodeActor);

/** Headers carrying exactly this actor value: any copy a client sent is removed first. */
export const withActorValue = (headers: Headers.Headers, value: Option.Option<string>) =>
  Option.match(value, {
    onNone: () => Headers.remove(headers, actorHeader),
    onSome: (actor) => Headers.set(headers, actorHeader, actor),
  });

/** The request with the caller's actor attached, or with none if they are signed out. */
export const withActorHeader = (request: HttpServerRequest, actor: AppActor) =>
  request.modify({ headers: withActorValue(request.headers, actorHeaderValue(actor)) });

/** Run `effect` against the request as this actor makes it. */
export const asActor =
  (actor: AppActor) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    Effect.flatMap(HttpServerRequest, (request) =>
      Effect.provideService(effect, HttpServerRequest, withActorHeader(request, actor)),
    );

/** The `Session` middleware: provides the actor the Worker attached, or fails with Unauthorized. */
export const SessionLive = Layer.succeed(Session, (effect, { headers }) =>
  Option.match(Option.flatMap(Headers.get(headers, actorHeader), decodeActor), {
    onNone: () => Effect.fail(new Unauthorized()),
    onSome: (actor) => Effect.provideService(effect, CurrentActor, actor),
  }),
);
