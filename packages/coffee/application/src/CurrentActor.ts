/**
 * Models who is calling a Coffee adapter: anonymous, or a signed-in actor
 * the domain can act for.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as Context from "effect/Context";
import { Actor, isStaff } from "@effect-coffee-shop/coffee-domain/Actor";

const AnonymousActor = Schema.Struct({
  kind: Schema.Literal("anonymous"),
}).annotate({ identifier: "AnonymousActor" });

export const AppActor = Schema.Union([AnonymousActor, Actor]).annotate({
  identifier: "AppActor",
});

export type AppActor = typeof AppActor.Type;
export type AnonymousActor = typeof AnonymousActor.Type;
export type AuthenticatedActor = Actor;

export const anonymousActor: AnonymousActor = {
  kind: "anonymous",
};

export { systemActor } from "@effect-coffee-shop/coffee-domain/Actor";

export class CurrentActor extends Context.Service<CurrentActor, AppActor>()(
  "effect-coffee-shop/application/CurrentActor",
) {}

export class AuthenticationRequiredError extends Schema.TaggedError<AuthenticationRequiredError>()(
  "AuthenticationRequiredError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 401 },
) {}

export class StaffRoleRequiredError extends Schema.TaggedError<StaffRoleRequiredError>()(
  "StaffRoleRequiredError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 403 },
) {}

export function isAuthenticatedActor(actor: AppActor): actor is AuthenticatedActor {
  return actor.kind !== "anonymous";
}

export const authenticationRequiredError = () =>
  new AuthenticationRequiredError({
    message: "Sign in to place and view orders.",
  });

export const staffRoleRequiredError = () =>
  new StaffRoleRequiredError({
    message: "Only coffee-shop staff can manage the live queue.",
  });

export const requireSignedInActor = Effect.fn("CurrentActor.requireSignedInActor")(
  function* (): Effect.fn.Return<AuthenticatedActor, AuthenticationRequiredError, CurrentActor> {
    const actor = yield* CurrentActor;

    if (!isAuthenticatedActor(actor)) {
      return yield* authenticationRequiredError();
    }

    return actor;
  },
);

export const requireStaffActor = Effect.fn("CurrentActor.requireStaffActor")(
  function* (): Effect.fn.Return<
    AuthenticatedActor,
    AuthenticationRequiredError | StaffRoleRequiredError,
    CurrentActor
  > {
    const actor = yield* requireSignedInActor();

    if (!isStaff(actor)) {
      return yield* staffRoleRequiredError();
    }

    return actor;
  },
);
