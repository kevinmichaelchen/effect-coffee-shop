import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as Context from "effect/Context";

const AnonymousActorSchema = Schema.Struct({
  kind: Schema.Literal("anonymous"),
}).annotate({ identifier: "AnonymousActor" });

const AuthenticatedActorSchema = Schema.Struct({
  displayName: Schema.String,
  kind: Schema.Literals(["customer", "staff", "system"] as const),
  userId: Schema.String,
}).annotate({ identifier: "AuthenticatedActor" });

export const AppActorSchema = Schema.Union([
  AnonymousActorSchema,
  AuthenticatedActorSchema,
]).annotate({ identifier: "AppActor" });

export type AppActor = typeof AppActorSchema.Type;
type AnonymousActor = typeof AnonymousActorSchema.Type;
type AuthenticatedActor = typeof AuthenticatedActorSchema.Type;

export const anonymousActor: AnonymousActor = {
  kind: "anonymous",
};

export const systemActor: AuthenticatedActor = {
  displayName: "System Operator",
  kind: "system",
  userId: "system",
};

export const CurrentActor = Context.Reference<AppActor>(
  "effect-coffee-shop/application/CurrentActor",
  {
    defaultValue: () => anonymousActor,
  },
);

export class AuthenticationRequiredError extends Schema.TaggedErrorClass<AuthenticationRequiredError>()(
  "AuthenticationRequiredError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 401 },
) {}

export class StaffRoleRequiredError extends Schema.TaggedErrorClass<StaffRoleRequiredError>()(
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
    message: "Sign in with a passkey to place and view orders.",
  });

const staffRoleRequiredError = () =>
  new StaffRoleRequiredError({
    message: "Only coffee-shop staff can manage the live queue.",
  });

export const requireSignedInActor = Effect.fnUntraced(function* (): Effect.fn.Return<
  AuthenticatedActor,
  AuthenticationRequiredError
> {
  const actor = yield* CurrentActor;

  if (!isAuthenticatedActor(actor)) {
    return yield* authenticationRequiredError();
  }

  return actor;
});

export const requireStaffActor = Effect.fnUntraced(function* (): Effect.fn.Return<
  AuthenticatedActor,
  AuthenticationRequiredError | StaffRoleRequiredError
> {
  const actor = yield* requireSignedInActor();

  if (!isStaffActor(actor)) {
    return yield* staffRoleRequiredError();
  }

  return actor;
});
