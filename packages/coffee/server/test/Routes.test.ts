import { describe, expect, it } from "@effect/vitest";
import { isBackendPath } from "@effect-coffee-shop/coffee-routes";
import { routeFor, routeKindOf, routeOf, routeTable } from "../src/Routes.ts";

const rejectsBearer = (path: string) => routeFor(path).rejectsBearer;
const needsAuth = (path: string) => routeFor(path).needsAuth;

describe("the Worker's route table", () => {
  it.each([
    ["/api/rest/customer/PlaceOrder", "rest"],
    ["/api/rest/openapi.json", "rest"],
    ["/api/customer", "customer"],
    ["/api/customer/", "customer"],
    ["/api/staff", "staff"],
    ["/api/auth/signIn", "auth"],
    ["/oauth/token", "auth"],
    ["/.well-known/oauth-authorization-server", "auth"],
    ["/mcp", "mcp"],
    ["/api/menu", "api"],
    ["/api/me", "api"],
    ["/api/restaurant", "api"],
    ["/api/customers", "api"],
    ["/apiary", "unmatched"],
    ["/", "unmatched"],
  ] as const)("routes %s to %s", (path, route) => {
    expect(routeOf(path)).toBe(route);
  });

  it("records both domain Apis as one route kind", () => {
    expect(routeKindOf("customer")).toBe("domain");
    expect(routeKindOf("staff")).toBe("domain");
    expect(routeKindOf("rest")).toBe("rest");
  });

  it("rejects bearer tokens on app routes, not on MCP or OAuth", () => {
    expect(
      ["/api/rest/customer/ClearCart", "/api/customer", "/api/staff"].map(rejectsBearer),
    ).toEqual([true, true, true]);
    expect(["/mcp", "/oauth/token", "/.well-known/x"].map(rejectsBearer)).toEqual([
      false,
      false,
      false,
    ]);
  });

  it("needs auth configured for auth and MCP, not for REST reads of the menu", () => {
    expect(["/api/auth/x", "/mcp", "/oauth", "/oauth/token"].map(needsAuth)).toEqual([
      true,
      true,
      true,
      true,
    ]);
    expect(["/api/menu", "/api/rest/customer/CustomerCart/x"].map(needsAuth)).toEqual([
      false,
      false,
    ]);
  });

  it("serves only paths the app forwards to it", () => {
    expect(
      routeTable.flatMap(({ prefixes }) => prefixes).filter((prefix) => !isBackendPath(prefix)),
    ).toEqual([]);
  });
});
