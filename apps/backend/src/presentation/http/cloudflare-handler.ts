import type { D1Database } from "@cloudflare/workers-types";
import * as Layer from "effect/Layer";
import * as Context from "effect/Context";
import { CoffeeHttpApiLive } from "#presentation/http/api";
import { createCoffeeWebHandler, emptyWebHandlerServices } from "#presentation/http/web-handler";
import { CoffeeMcpHttpLive } from "#presentation/mcp/server";
import { makeCloudflareCoffeeAppLive } from "@effect-coffee-shop/coffee-external-sqlite/cloudflare";
import { CurrentActor, type AppActor } from "@effect-coffee-shop/coffee-core/service/CurrentActor";

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

export const createCloudflareRequestServices = (actor: AppActor): Context.Context<unknown> =>
  emptyWebHandlerServices().pipe(Context.add(CurrentActor, actor));
