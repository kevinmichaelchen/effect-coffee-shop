import { Schema, pipe } from "effect";
import { Route } from "foldkit";
import { defineRouteUnion, literal, slash } from "foldkit/route";

export const AppRoute = defineRouteUnion({
  Shop: {},
  Staff: {},
  McpLogin: {},
  NotFound: { path: Schema.String },
});
export type AppRoute = typeof AppRoute.Type;

export const shopRouter = pipe(literal("shop"), Route.mapTo(AppRoute.Shop));
const homeRouter = pipe(Route.root, Route.mapTo(AppRoute.Shop));
const controlRoomRouter = pipe(literal("control-room"), Route.mapTo(AppRoute.Shop));
const coffeeShopRouter = pipe(literal("coffee-shop"), Route.mapTo(AppRoute.Shop));
export const staffRouter = pipe(literal("staff"), Route.mapTo(AppRoute.Staff));
const mcpLoginRouter = pipe(
  literal("login"),
  slash(literal("mcp")),
  Route.mapTo(AppRoute.McpLogin),
);

export const urlToAppRoute = Route.parseUrlWithFallback(
  Route.oneOf(
    shopRouter,
    staffRouter,
    mcpLoginRouter,
    controlRoomRouter,
    coffeeShopRouter,
    homeRouter,
  ),
  AppRoute.NotFound,
);

/** Where an MCP client sign-in continues once the viewer is authenticated. */
export const mcpAuthorizePath = "/oauth/coffee/authorize";
