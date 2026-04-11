import type { D1Database } from "@cloudflare/workers-types";
import * as Layer from "effect/Layer";
import * as ServiceMap from "effect/ServiceMap";
import * as HttpServer from "effect/unstable/http/HttpServer";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import { CoffeeHttpApiLive } from "#presentation/http/api";
import { CoffeeMcpHttpLive } from "#presentation/mcp/server";
import { makeCloudflareCoffeeAppLive } from "#runtime/cloudflare/live";
import { CoffeeOrderApp } from "#service/CoffeeOrderApp";

type AssetFetcher = {
  fetch(request: Request): Promise<Response>;
};

export interface OnionCloudflareWorkerEnv {
  DB: D1Database;
  ASSETS?: AssetFetcher;
}

const isApiRequest = (pathname: string) => pathname === "/api" || pathname.startsWith("/api/");

const isMcpRequest = (pathname: string) => pathname === "/mcp" || pathname.startsWith("/mcp/");

const rewriteApiRequest = (request: Request) => {
  const url = new URL(request.url);
  url.pathname = url.pathname.replace(/^\/api(?=\/|$)/, "") || "/";
  return new Request(url, request);
};

const makeBackendHandler = (db: D1Database) => {
  const { dispose, handler } = HttpRouter.toWebHandler(
    Layer.mergeAll(CoffeeHttpApiLive, CoffeeMcpHttpLive).pipe(
      Layer.provide(CoffeeOrderApp.layer),
      Layer.provide(makeCloudflareCoffeeAppLive(db)),
      Layer.provide(HttpServer.layerServices),
    ),
    {
      disableLogger: true,
    },
  );
  return {
    dispose,
    handler: async (request: Request) =>
      handler(request, ServiceMap.empty() as ServiceMap.ServiceMap<CoffeeOrderApp>),
  };
};

type WorkerHandler = ReturnType<typeof makeBackendHandler>["handler"];

let cachedHandler:
  | {
      db: D1Database;
      dispose: () => Promise<void>;
      handler: WorkerHandler;
    }
  | undefined;

const getBackendHandler = (db: D1Database): WorkerHandler => {
  if (cachedHandler?.db === db) {
    return cachedHandler.handler;
  }

  void cachedHandler?.dispose();

  const next = makeBackendHandler(db);
  cachedHandler = {
    db,
    dispose: next.dispose,
    handler: next.handler,
  };

  return next.handler;
};

const notFoundResponse = () => new Response("Not Found", { status: 404 });

export default {
  async fetch(request: Request, env: OnionCloudflareWorkerEnv) {
    const pathname = new URL(request.url).pathname;

    if (isApiRequest(pathname)) {
      return getBackendHandler(env.DB)(rewriteApiRequest(request));
    }

    if (isMcpRequest(pathname)) {
      return getBackendHandler(env.DB)(request);
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return notFoundResponse();
  },
};
