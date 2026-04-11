import type { D1Database } from "@cloudflare/workers-types";
import * as Layer from "effect/Layer";
import * as ServiceMap from "effect/ServiceMap";
import { CoffeeHttpApiLive } from "#presentation/http/api";
import { createCoffeeWebHandler, emptyWebHandlerServices } from "#presentation/http/web-handler";
import { CoffeeMcpHttpLive } from "#presentation/mcp/server";
import { makeCloudflareCoffeeAppLive } from "#runtime/cloudflare/live";
import { CurrentActor, type AppActor } from "#service/CurrentActor";

const makeBackendHandler = (db: D1Database) =>
  createCoffeeWebHandler(
    Layer.mergeAll(CoffeeHttpApiLive, CoffeeMcpHttpLive),
    makeCloudflareCoffeeAppLive(db),
  );

type WorkerHandler = ReturnType<typeof makeBackendHandler>["handler"];

let cachedHandler:
  | {
      db: D1Database;
      dispose: () => Promise<void>;
      handler: WorkerHandler;
    }
  | undefined;

export const getCloudflareBackendHandler = (db: D1Database): WorkerHandler => {
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

export const createCloudflareRequestServices = (actor: AppActor): ServiceMap.ServiceMap<unknown> =>
  emptyWebHandlerServices().pipe(ServiceMap.add(CurrentActor, actor));
