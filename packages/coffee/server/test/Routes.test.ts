import { describe, expect, it } from "@effect/vitest";
import { needsAuth, rejectsBearer, routeKindOf, routeOf } from "../src/Routes.ts";

describe("the Worker's route table", () => {
  it.each([
    ["/sync/orders/order_1", "sync"],
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
      ["/api/rest/customer/ClearCart", "/api/customer", "/sync/orders/x"].map(rejectsBearer),
    ).toEqual([true, true, true]);
    expect(["/mcp", "/oauth/token", "/.well-known/x"].map(rejectsBearer)).toEqual([
      false,
      false,
      false,
    ]);
  });

  it("needs auth configured for auth, sync and MCP, not for REST reads of the menu", () => {
    expect(["/api/auth/x", "/sync/orders/x", "/mcp", "/oauth/token"].map(needsAuth)).toEqual([
      true,
      true,
      true,
      true,
    ]);
    expect(["/api/menu", "/api/rest/customer/Cart/x"].map(needsAuth)).toEqual([false, false]);
  });
});
