import { AuthContract, PasskeyContract } from "@yielded/auth";
import * as Match from "effect/Match";
import * as Schema from "effect/Schema";

export const Registration = Schema.Struct({
  displayName: Schema.Trim.check(Schema.isNonEmpty(), Schema.isMaxLength(80)),
});
export type Registration = typeof Registration.Type;

export const Claims = Schema.Struct({ displayName: Schema.String });
export type Claims = typeof Claims.Type;

export const passkeyNamespace = "coffee/passkey";
const registration = PasskeyContract.makeRegistration(passkeyNamespace, Registration);

export const CoffeeAuthApi = AuthContract.make("coffee", {
  basePath: "/api/auth",
  claims: Claims,
  actions: (sessions) => {
    const signIn = PasskeyContract.make(passkeyNamespace, sessions);
    return {
      register: AuthContract.fromOperation(registration.operations.Begin, {
        strategy: "registration",
        method: "register",
      }),
      completeRegistration: AuthContract.fromOperation(registration.operations.Complete, {
        strategy: "registration",
        method: "completeRegistration",
        requestFields: { bindingCredential: "request-binding" },
      }),
      signIn: AuthContract.fromOperation(signIn.operations.Begin, { strategy: "passkey" }),
      completeSignIn: AuthContract.fromOperation(signIn.operations.Complete, {
        strategy: "passkey",
        requestFields: { bindingCredential: "request-binding" },
        subject: {
          fromSuccess: (result) =>
            Match.value(result).pipe(
              Match.tag("Authenticated", ({ session }) => session.subjectId),
              Match.orElse(() => undefined),
            ),
        },
      }),
    };
  },
});
