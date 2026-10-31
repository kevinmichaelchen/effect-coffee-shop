import * as Arr from "effect/Array";
import * as HashMap from "effect/HashMap";
import * as Schema from "effect/Schema";
import * as Option from "effect/Option";

export function makeAuthClient(
  auth: { readonly handler: (request: Request) => Promise<Response> },
  origin: string,
) {
  // The browser cookie jar: one `name=value` pair per cookie name.
  let cookies = HashMap.empty<string, string>();
  const cookieHeader = () => Arr.join(Arr.fromIterable(HashMap.values(cookies)), "; ");
  const send = async (path: string, body?: Schema.Json) => {
    const headers = {
      origin,
      "content-type": "application/json",
      "x-effect-auth-csrf": "1",
      cookie: cookieHeader(),
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
            cookies = HashMap.set(cookies, name, pair);
          },
          onSome: () => {
            cookies = HashMap.remove(cookies, name);
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
        headers: { cookie: cookieHeader() },
      }),
  };
}
