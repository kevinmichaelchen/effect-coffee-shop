import { Client } from "@yielded/auth";
import { PasskeyBrowser, layer as passkeyBrowserLayer } from "@yielded/auth-simplewebauthn/Browser";
import { CoffeeAuthApi, Registration } from "@effect-coffee-shop/coffee-auth/contract";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";

const AuthClient = Client.make(CoffeeAuthApi, { baseUrl: window.location.origin });
const runtime = ManagedRuntime.make(Layer.merge(AuthClient.layerFetch, passkeyBrowserLayer));

class AuthenticationIncomplete extends Schema.TaggedError<AuthenticationIncomplete>()(
  "AuthenticationIncomplete",
  {},
) {}

const flow = () => ({
  flowId: crypto.randomUUID(),
  commandId: crypto.randomUUID(),
  profileId: "default",
});
const signIn = Effect.fn("CoffeeAuth.signIn")(function* () {
  const { auth } = yield* AuthClient;
  const browser = yield* PasskeyBrowser;
  const started = yield* auth.signIn(flow());
  const response = yield* browser.authenticate({ started, mediation: "required" });
  const result = yield* auth.completeSignIn({
    flowId: response.flowId,
    response: Redacted.value(response.response),
  });
  if (result._tag !== "Authenticated") return yield* new AuthenticationIncomplete();
});

const register = Effect.fn("CoffeeAuth.register")(function* (displayName: string) {
  const registration = yield* Schema.decodeEffect(Registration)({ displayName });
  const { auth } = yield* AuthClient;
  const browser = yield* PasskeyBrowser;
  const started = yield* auth.register({ ...flow(), registration });
  const response = yield* browser.register(started);
  yield* auth.completeRegistration({
    flowId: response.flowId,
    response: Redacted.value(response.response),
  });
  // Registration proves enrollment; a fresh assertion establishes the session.
  yield* signIn();
});

const signOut = Effect.fn("CoffeeAuth.signOut")(function* () {
  const { auth } = yield* AuthClient;
  yield* auth.signOut();
});

const run = async <E extends { readonly _tag: string }>(
  operation: Effect.Effect<void, E, Effect.Services<ReturnType<typeof register>>>,
) =>
  runtime.runPromise(
    operation.pipe(
      Effect.match({
        onSuccess: () => ({ ok: true, message: "" }),
        onFailure: (error) => ({
          ok: false,
          message:
            error._tag === "SchemaError"
              ? "Enter a name between 1 and 80 characters."
              : "Sign-in could not be completed. If you just created a passkey, choose Sign in to finish.",
        }),
      }),
    ),
  );

export const authClient = {
  register: async (displayName: string) => run(register(displayName)),
  signIn: async () => run(signIn()),
  signOut: async () => run(signOut()),
};

if (import.meta.hot)
  import.meta.hot.dispose(() => {
    void runtime.dispose();
  });
