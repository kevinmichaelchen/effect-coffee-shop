/**
 * The header that carries an authenticated actor to the domain Apis'
 * `Session` middleware. Only the Worker sets it, after resolving who is
 * calling (from a session cookie, or an MCP OAuth token); any copy a client
 * sends is removed first.
 *
 * @module
 */
import { Actor } from "@effect-coffee-shop/coffee-domain/Actor";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { type AppActor, isAuthenticatedActor } from "./CurrentActor.ts";

/** Set by the Worker after authenticating; never trusted from a client. */
export const actorHeader = "x-coffee-actor";

const encodeActor = Schema.encodeSync(Schema.fromJsonString(Actor));

/** The header value carrying a signed-in actor; none for an anonymous caller. */
export const actorHeaderValue = (actor: AppActor): Option.Option<string> =>
  Option.map(Option.liftPredicate(actor, isAuthenticatedActor), encodeActor);

/** Headers carrying this actor for an in-process Api call; empty for an anonymous caller. */
export const actorHeaders = (actor: AppActor): Record<string, string> =>
  Option.match(actorHeaderValue(actor), {
    onNone: () => ({}),
    onSome: (value) => ({ [actorHeader]: value }),
  });
