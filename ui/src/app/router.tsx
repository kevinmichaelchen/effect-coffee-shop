import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  type SearchSchemaInput,
} from "@tanstack/react-router";
import { NotFoundPage } from "#app/NotFoundPage.tsx";
import { appRoutes } from "#app/routes.ts";
import { AssistantLandingPage } from "#features/assistant/components/AssistantLandingPage.tsx";
import { AgentApprovalPage } from "#features/auth/components/AgentApprovalPage.tsx";
import { CoffeeCustomerPage } from "#features/coffee-shop/components/CoffeeCustomerPage.tsx";
import { CoffeeStaffPage } from "#features/coffee-shop/components/CoffeeStaffPage.tsx";

const StaffRouteSearchSchema = Schema.Struct({
  order: Schema.optionalKey(Schema.String),
});

type StaffRouteSearch = Schema.Schema.Type<typeof StaffRouteSearchSchema>;
type StaffRouteSearchInput = SearchSchemaInput &
  Schema.Codec.Encoded<typeof StaffRouteSearchSchema>;

const emptyStaffRouteSearch = {} as const satisfies StaffRouteSearch;

function validateStaffRouteSearch(input: StaffRouteSearchInput): StaffRouteSearch {
  return Option.match(Schema.decodeUnknownOption(StaffRouteSearchSchema)(input), {
    onNone: () => emptyStaffRouteSearch,
    onSome: (search) => search,
  });
}

const rootRoute = createRootRoute({
  component: () => <Outlet />,
  notFoundComponent: NotFoundPage,
});

const homeRoute = createRoute({
  component: AssistantLandingPage,
  getParentRoute: () => rootRoute,
  path: appRoutes.home,
});

const agentCapabilitiesRoute = createRoute({
  component: AgentApprovalPage,
  getParentRoute: () => rootRoute,
  path: appRoutes.agentCapabilities,
});

const shopRoute = createRoute({
  component: CoffeeCustomerPage,
  getParentRoute: () => rootRoute,
  path: appRoutes.shop,
});

const coffeeShopAliasRoute = createRoute({
  component: CoffeeCustomerPage,
  getParentRoute: () => rootRoute,
  path: appRoutes.coffeeShopAlias,
});

const controlRoomAliasRoute = createRoute({
  component: CoffeeCustomerPage,
  getParentRoute: () => rootRoute,
  path: appRoutes.controlRoomAlias,
});

const staffRoute = createRoute({
  component: CoffeeStaffPage,
  getParentRoute: () => rootRoute,
  path: appRoutes.staff,
  validateSearch: validateStaffRouteSearch,
});

const routeTree = rootRoute.addChildren([
  homeRoute,
  agentCapabilitiesRoute,
  shopRoute,
  coffeeShopAliasRoute,
  controlRoomAliasRoute,
  staffRoute,
]);

export const router = createRouter({
  routeTree,
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
