/* oxlint-disable effect/avoid-native-object-helpers -- The test cookie jar implements browser cookie replacement using a native Map. */
import * as Schema from "effect/Schema";
import * as Option from "effect/Option";
import type { createCoffeeAuth } from "../better-auth/shared.ts";

export const RegistrationOptions = Schema.Struct({
  challenge: Schema.String,
  user: Schema.Struct({ id: Schema.String }),
});
export type RegistrationOptions = typeof RegistrationOptions.Type;
export const AuthenticationOptions = Schema.Struct({ challenge: Schema.String });
export type AuthenticationOptions = typeof AuthenticationOptions.Type;
export const RegisteredPasskey = Schema.Struct({ id: Schema.String, userId: Schema.String });
export type RegisteredPasskey = typeof RegisteredPasskey.Type;

export function makeAuthClient(auth: ReturnType<typeof createCoffeeAuth>, origin: string) {
  const cookies = new Map<string, string>();
  const send = async (path: string, body?: Schema.Json) => {
    const headers = {
      origin,
      "content-type": "application/json",
      cookie: [...cookies.values()].join("; "),
    };
    const options = Option.match(Option.fromUndefinedOr(body), {
      onNone: (): RequestInit => ({ headers }),
      onSome: (value): RequestInit => ({
        headers,
        method: "POST",
        body: Schema.encodeSync(Schema.fromJsonString(Schema.Json))(value),
      }),
    });
    const response = await auth.handler(new Request(`${origin}/api/auth${path}`, options));
    response.headers.getSetCookie().forEach((cookie) => {
      const pair = cookie.slice(0, cookie.indexOf(";"));
      cookies.set(pair.slice(0, pair.indexOf("=")), pair);
    });
    return response;
  };
  return {
    send,
    request: () =>
      new Request(`${origin}/api/me`, {
        headers: { cookie: [...cookies.values()].join("; ") },
      }),
  };
}
