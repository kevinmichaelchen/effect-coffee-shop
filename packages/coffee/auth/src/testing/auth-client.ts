/* oxlint-disable effect/avoid-native-object-helpers -- The test cookie jar implements browser cookie replacement using a native Map. */
import * as Schema from "effect/Schema";
import * as Option from "effect/Option";

export function makeAuthClient(
  auth: { readonly handler: (request: Request) => Promise<Response> },
  origin: string,
) {
  const cookies = new Map<string, string>();
  const send = async (path: string, body?: Schema.Json) => {
    const headers = {
      origin,
      "content-type": "application/json",
      "x-effect-auth-csrf": "1",
      cookie: [...cookies.values()].join("; "),
    };
    const options = Option.match(Option.fromUndefinedOr(body), {
      onNone: (): RequestInit => ({ headers }),
      onSome: (value): RequestInit => ({
        headers,
        method: "POST",
        body: Schema.encodeSync(Schema.fromJsonString(Schema.Json))({ payload: value }),
      }),
    });
    const response = await auth.handler(new Request(`${origin}/api/auth${path}`, options));
    response.headers.getSetCookie().forEach((cookie) => {
      const pair = cookie.slice(0, cookie.indexOf(";"));
      const name = pair.slice(0, pair.indexOf("="));
      Option.match(
        Option.liftPredicate(cookie, (value) => /max-age=0/i.test(value)),
        {
          onNone: () => {
            cookies.set(name, pair);
          },
          onSome: () => {
            cookies.delete(name);
          },
        },
      );
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
