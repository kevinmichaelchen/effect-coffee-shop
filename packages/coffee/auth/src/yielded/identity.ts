import { Identity, Schema as AuthSchema } from "@yielded/auth";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import type { AuthenticatedActor } from "@effect-coffee-shop/coffee-application/CurrentActor";
import { CustomerId } from "@effect-coffee-shop/coffee-domain/Customer/Customer.id";

/** Identity decoded from a verified Yielded session. */
export const CoffeeAuthIdentity = Schema.Struct({
  subjectId: AuthSchema.SubjectId,
  displayName: Schema.String,
});

export type CoffeeAuthIdentity = typeof CoffeeAuthIdentity.Type;

/** Staff authority comes from deployment configuration, never session claims. */
export const actorFromIdentity = Effect.fn("CoffeeAuth.actorFromIdentity")(function* (
  identity: CoffeeAuthIdentity,
  staffUserIds: HashSet.HashSet<string>,
): Effect.fn.Return<AuthenticatedActor, Identity.IdentityCodecError> {
  const userId = yield* Identity.stringSubjectId.toNative(identity.subjectId);
  const actor = {
    displayName: identity.displayName,
    userId: CustomerId.make(userId),
  };

  return Option.match(
    Option.some(userId).pipe(Option.filter((id) => HashSet.has(staffUserIds, id))),
    {
      onNone: (): AuthenticatedActor => ({ ...actor, kind: "customer" }),
      onSome: (): AuthenticatedActor => ({ ...actor, kind: "staff" }),
    },
  );
});
