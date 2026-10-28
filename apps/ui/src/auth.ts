import { Client } from "@yielded/auth";
import { PasskeyBrowser, layer as passkeyBrowserLayer } from "@yielded/auth-simplewebauthn/Browser";
import { CoffeeAuthApi, Registration } from "@effect-coffee-shop/coffee-auth/contract";
import { Effect, Layer, Redacted, Schema } from "effect";

const AuthClient = Client.make(CoffeeAuthApi, {
  get baseUrl() {
    return location.origin;
  },
});
export const authLayer = Layer.merge(AuthClient.layerFetch, passkeyBrowserLayer);
class AuthenticationIncomplete extends Schema.TaggedError<AuthenticationIncomplete>()(
  "AuthenticationIncomplete",
  {},
) {}
const flow = Effect.sync(() => ({
  flowId: crypto.randomUUID(),
  commandId: crypto.randomUUID(),
  profileId: "default",
}));
export const signIn = Effect.gen(function* () {
  const { auth } = yield* AuthClient;
  const browser = yield* PasskeyBrowser;
  const started = yield* auth.signIn(yield* flow);
  const response = yield* browser.authenticate({ started, mediation: "required" });
  const result = yield* auth.completeSignIn({
    flowId: response.flowId,
    response: Redacted.value(response.response),
  });
  if (result._tag !== "Authenticated") return yield* new AuthenticationIncomplete({});
});
export const register = (displayName: string) =>
  Effect.gen(function* () {
    const registration = yield* Schema.decodeEffect(Registration)({ displayName });
    const { auth } = yield* AuthClient;
    const browser = yield* PasskeyBrowser;
    const started = yield* auth.register({ ...(yield* flow), registration });
    const response = yield* browser.register(started);
    yield* auth.completeRegistration({
      flowId: response.flowId,
      response: Redacted.value(response.response),
    });
    yield* signIn;
  });
export const signOut = Effect.flatMap(AuthClient, ({ auth }) => auth.signOut());
