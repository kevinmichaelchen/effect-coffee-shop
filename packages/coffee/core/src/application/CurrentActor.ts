/**
 * Models the actor currently authorized to run Coffee application workflows.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as Context from "effect/Context";

const AnonymousActor = Schema.Struct({
  kind: Schema.Literal("anonymous"),
}).annotate({ identifier: "AnonymousActor" });

const AuthenticatedActor = Schema.Struct({
  displayName: Schema.String,
  kind: Schema.Literals(["customer", "staff", "system"] as const),
  userId: Schema.String,
}).annotate({ identifier: "AuthenticatedActor" });

export const AppActor = Schema.Union([AnonymousActor, AuthenticatedActor]).annotate({
  identifier: "AppActor",
});

export type AppActor = typeof AppActor.Type;
type AnonymousActor = typeof AnonymousActor.Type;
type AuthenticatedActor = typeof AuthenticatedActor.Type;

export const anonymousActor: AnonymousActor = {
  kind: "anonymous",
};

export const systemActor: AuthenticatedActor = {
  displayName: "System Operator",
  kind: "system",
  userId: "system",
};

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

function isStaffActor(actor: AppActor): actor is AuthenticatedActor {
  return actor.kind === "staff" || actor.kind === "system";
}

const authenticationRequiredError = () =>
  new AuthenticationRequiredError({
    message: "Sign in to place and view orders.",
  });

const staffRoleRequiredError = () =>
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

    if (!isStaffActor(actor)) {
      return yield* staffRoleRequiredError();
    }

    return actor;
  },
);
