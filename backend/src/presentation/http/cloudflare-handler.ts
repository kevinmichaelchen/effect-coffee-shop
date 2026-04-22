import type { D1Database } from "@cloudflare/workers-types";
import * as Layer from "effect/Layer";
import * as Context from "effect/Context";
import { CoffeeHttpApiLive } from "#presentation/http/api";
import { createCoffeeWebHandler, emptyWebHandlerServices } from "#presentation/http/web-handler";
import { CoffeeMcpHttpLive } from "#presentation/mcp/server";
import { makeCloudflareCoffeeAppLive } from "#runtime/cloudflare/live";
import { CurrentActor, type AppActor } from "#service/CurrentActor";
import type { SendEmailBinding } from "#external/cloudflare/CloudflareEmailService";

const makeBackendHandler = (db: D1Database, email?: SendEmailBinding) =>
  createCoffeeWebHandler(
    Layer.mergeAll(CoffeeHttpApiLive, CoffeeMcpHttpLive),
    makeCloudflareCoffeeAppLive(db, email),
  );

type WorkerHandler = ReturnType<typeof makeBackendHandler>["handler"];

let cachedHandler:
  | {
      db: D1Database;
      email: SendEmailBinding | undefined;
      dispose: () => Promise<void>;
      handler: WorkerHandler;
    }
  | undefined;

export const getCloudflareBackendHandler = (
  db: D1Database,
  email?: SendEmailBinding,
): WorkerHandler => {
  if (cachedHandler?.db === db && cachedHandler?.email === email) {
    return cachedHandler.handler;
  }

  void cachedHandler?.dispose();

  const next = makeBackendHandler(db, email);

  cachedHandler = {
    db,
    email,
    dispose: next.dispose,
    handler: next.handler,
  };

  return next.handler;
};

export const createCloudflareRequestServices = (actor: AppActor): Context.Context<unknown> =>
  emptyWebHandlerServices().pipe(Context.add(CurrentActor, actor));
