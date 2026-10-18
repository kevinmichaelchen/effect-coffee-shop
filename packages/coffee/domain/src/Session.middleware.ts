import * as RpcMiddleware from "effect/rpc/RpcMiddleware";
import * as Schema from "effect/Schema";
import { CurrentActor } from "./CurrentActor.context.ts";

/** The request has no signed-in session. */
export class Unauthorized extends Schema.TaggedError<Unauthorized>()("Unauthorized", {}) {}

/**
 * Authenticates a request and provides who is making it as the
 * {@link CurrentActor}. Authorization is up to each command's `decide` and
 * each read's `validate`. The server implements it from the auth session.
 */
export class Session extends RpcMiddleware.Service<Session, { provides: CurrentActor }>()(
  "Coffee/Session",
  { error: Unauthorized },
) {}
