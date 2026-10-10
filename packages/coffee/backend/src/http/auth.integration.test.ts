import { PGlite } from "@electric-sql/pglite";
import { PgliteClient } from "@effect/sql-pglite";
import * as Layer from "effect/Layer";
import {
  DrizzleCoffeeAppLayer,
  DrizzlePgliteSchemaLive,
  DrizzlePostgresSchemaReady,
  makePgliteCoffeeDbLayer,
} from "@effect-coffee-shop/coffee-external-drizzle-postgres";
/* oxlint-disable effect/effect-run-in-body, effect/avoid-native-object-helpers -- Vitest owns HTTP execution; the configured actor port accepts a ReadonlySet. */
import { assert, expect, it, describe } from "vitest";
import { Miniflare } from "miniflare";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import { Base64Url } from "effect/encoding";
import { Passkey } from "@yielded/auth";
import {
  d1AuthDatabase,
  transactionalAuthDatabase,
} from "@effect-coffee-shop/coffee-auth/database";
import { makeAuthClient } from "@effect-coffee-shop/coffee-auth/testing/auth-client";
import { makeTestPasskey } from "@effect-coffee-shop/coffee-auth/testing/passkey";
import {
  migrateCloudflareD1,
  makeCloudflareCoffeeAppLive,
} from "@effect-coffee-shop/coffee-external-sqlite/cloudflare";
import { CoffeeHttpApiLive } from "@effect-coffee-shop/coffee-http/api";
import { CoffeeMcpHttpLive } from "@effect-coffee-shop/coffee-mcp/server";
import { handleCoffeeRequest } from "./backend.ts";

const origin = "http://localhost";
const flow = () => ({
  flowId: crypto.randomUUID(),
  commandId: crypto.randomUUID(),
  profileId: "default",
});
const Registration = Schema.TaggedStruct("Success", { value: Passkey.PasskeyRegistrationStarted });
const Authentication = Schema.TaggedStruct("Success", {
  value: Passkey.PasskeyAuthenticationStarted,
});
const Token = Schema.Struct({ access_token: Schema.String });
const Viewer = Schema.Struct({ kind: Schema.String, userId: Schema.String });

const d1Fixture = async () => {
  const proxy = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response(); } }",
    d1Databases: ["DB"],
  });
  const db = await proxy.getD1Database("DB");
  await Effect.runPromise(migrateCloudflareD1(db).pipe(Effect.provide(NodeServices.layer)));
  return {
    database: d1AuthDatabase(db),
    appLayer: makeCloudflareCoffeeAppLive(db),
    deactivate: (id: string) =>
      db.prepare("update coffee_auth_subjects set active = 0 where id = ?").bind(id).run(),
    dispose: () => proxy.dispose(),
  };
};
const pgFixture = async () => {
  const db = new PGlite();
  const database = makePgliteCoffeeDbLayer(db);
  const schema = DrizzlePgliteSchemaLive.pipe(Layer.provide(database));
  await Effect.runPromise(DrizzlePostgresSchemaReady.pipe(Effect.provide(schema)));
  return {
    database: transactionalAuthDatabase(PgliteClient.layer({ liveClient: db })),
    appLayer: DrizzleCoffeeAppLayer.pipe(Layer.provide(schema), Layer.provide(database)),
    deactivate: (id: string) =>
      db.query("update coffee_auth_subjects set active = false where id = $1", [id]),
    dispose: () => db.close(),
  };
};
describe.each([
  { name: "D1", fixture: d1Fixture },
  { name: "PostgreSQL", fixture: pgFixture },
])("$name route composition", ({ fixture }) => {
  it("authenticates browser and stateless MCP requests with durable OAuth grants and current staff policy", async () => {
    const data = await fixture();
    const staffUserIds = new Set<string>();
    const config = {
      origin,
      staffUserIds,
      secret: Redacted.make("request-binding-secret-at-least-32-characters"),
      oauthSecret: Redacted.make("A".repeat(43)),
      mcpClients: [
        {
          clientId: "test",
          name: "Test MCP",
          redirectUris: ["http://localhost:6274/callback"] satisfies [string, ...string[]],
        },
      ],
    };
    const handler = (request: Request) =>
      Effect.runPromise(
        handleCoffeeRequest<unknown>({
          request,
          auth: Option.some(config),
          database: data.database,
          appLayer: data.appLayer,
          httpRoutes: CoffeeHttpApiLive,
          mcpRoutes: CoffeeMcpHttpLive,
        }).pipe(Effect.provide(NodeServices.layer)),
      );
    const run = async () => {
      const denied = await handler(new Request(`${origin}/mcp`, { method: "POST" }));
      expect(denied.status).toBe(401);
      expect(denied.headers.get("www-authenticate")).toContain("oauth-protected-resource");
      const client = makeAuthClient({ handler }, origin);
      const register = await client.send("/register", {
        ...flow(),
        registration: { displayName: "Alice" },
      });
      assert.equal(register.status, 200, await register.clone().text());
      const registration = Schema.decodeUnknownSync(Registration)(await register.json()).value;
      const passkey = makeTestPasskey(origin, registration.options.user.id);
      expect(
        (
          await client.send("/completeRegistration", {
            flowId: registration.flowId,
            response: Schema.encodeSync(Schema.fromJsonString(Schema.Json))(
              passkey.register(registration.options.challenge),
            ),
          })
        ).status,
      ).toBe(200);
      const start = Schema.decodeUnknownSync(Authentication)(
        await (await client.send("/signIn", flow())).json(),
      ).value;
      expect(
        (
          await client.send("/completeSignIn", {
            flowId: start.flowId,
            response: Schema.encodeSync(Schema.fromJsonString(Schema.Json))(
              passkey.authenticate(start.options.challenge, 1),
            ),
          })
        ).status,
      ).toBe(200);
      const viewerResponse = await handler(client.request());
      assert.equal(viewerResponse.status, 200, await viewerResponse.clone().text());
      const viewer = Schema.decodeUnknownSync(Viewer)(await viewerResponse.json());
      expect(viewer.kind).toBe("customer");
      const crossSite = await handler(
        new Request(`${origin}/api/orders`, {
          method: "POST",
          headers: {
            cookie: client.request().headers.get("cookie") ?? "",
            origin: "https://attacker.example",
            "content-type": "application/json",
          },
          body: "{}",
        }),
      );
      expect(crossSite.status).toBe(403);

      const verifier = "a".repeat(43);
      const challenge = Base64Url.encode(
        new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))),
      );
      const authorize = new URL(`${origin}/oauth/coffee/authorize`);
      authorize.search = new URLSearchParams({
        response_type: "code",
        client_id: "test",
        redirect_uri: "http://localhost:6274/callback",
        resource: `${origin}/mcp`,
        scope: "coffee:access",
        code_challenge: challenge,
        code_challenge_method: "S256",
        state: "test-state",
      }).toString();
      const pending = await handler(new Request(authorize));
      assert.equal(pending.status, 303, await pending.clone().text());
      const consentCookie = pending.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
      const cookie = `${client.request().headers.get("cookie")}; ${consentCookie}`;
      const consent = await handler(
        new Request(`${origin}/oauth/coffee/authorize`, { headers: { cookie } }),
      );
      const html = await consent.text();
      assert.equal(consent.status, 200, html);
      const csrf = /name="csrf" value="([^"]+)"/.exec(html)?.[1];
      assert.isDefined(csrf);
      const approved = await handler(
        new Request(`${origin}/oauth/coffee/authorize`, {
          method: "POST",
          headers: { cookie, origin, "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ csrf, decision: "approve" }),
        }),
      );
      const location = approved.headers.get("location");
      assert.isNotNull(location);
      const code = new URL(location).searchParams.get("code");
      assert.isNotNull(code);
      const tokenResponse = await handler(
        new Request(`${origin}/oauth/coffee/token`, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code,
            code_verifier: verifier,
            client_id: "test",
            redirect_uri: "http://localhost:6274/callback",
            resource: `${origin}/mcp`,
          }),
        }),
      );
      assert.equal(tokenResponse.status, 200, await tokenResponse.clone().text());
      const token = Schema.decodeUnknownSync(Token)(await tokenResponse.json());
      const call = (name: string, args: Schema.Json = {}) =>
        handler(
          new Request(`${origin}/mcp`, {
            method: "POST",
            headers: {
              authorization: `Bearer ${token.access_token}`,
              "content-type": "application/json",
              accept: "application/json, text/event-stream",
              "mcp-protocol-version": "2026-07-28",
              "mcp-method": "tools/call",
              "mcp-name": name,
            },
            body: Schema.encodeSync(Schema.fromJsonString(Schema.Json))({
              jsonrpc: "2.0",
              id: crypto.randomUUID(),
              method: "tools/call",
              params: {
                name,
                arguments: args,
                _meta: {
                  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
                  "io.modelcontextprotocol/clientCapabilities": {},
                },
              },
            }),
          }),
        );
      const cart = await call("get_cart");
      const cartBody = await cart.text();
      assert.equal(cart.status, 200, cartBody);
      expect(cartBody).toContain(viewer.userId);
      expect(cartBody).not.toContain('"isError":true');
      const placed = await call("place_order", { items: [{ drinkId: "latte", size: "medium" }] });
      const order = Schema.decodeUnknownSync(
        Schema.Struct({
          result: Schema.Struct({ structuredContent: Schema.Struct({ id: Schema.String }) }),
        }),
      )(await placed.json()).result.structuredContent;
      const customerOrders = await call("start_brewing", { orderId: order.id });
      expect(await customerOrders.text()).toContain("Only coffee-shop staff");
      staffUserIds.add(viewer.userId);
      const staffOrders = await call("start_brewing", { orderId: order.id });
      const staffBody = await staffOrders.text();
      expect(staffBody).not.toContain('"isError":true');
      expect(staffBody).toContain("brewing");
      await data.deactivate(viewer.userId);
      expect(await (await call("get_cart")).text()).toContain("MCP account is unavailable");
    };
    await run().finally(() => data.dispose());
  }, 60_000);
});
