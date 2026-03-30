import * as BunHttpServer from "@effect/platform-bun/BunHttpServer";
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as Layer from "effect/Layer";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import { InMemoryCoffeeAppLive } from "../../external/live.ts";
import { CoffeeHttpApiLive } from "./api.ts";

const port = Number(process.env.PORT ?? "3000");

const HttpLive = HttpRouter.serve(CoffeeHttpApiLive).pipe(
  Layer.provide(InMemoryCoffeeAppLive),
  Layer.provideMerge(BunHttpServer.layer({ port })),
);

Layer.launch(HttpLive).pipe(BunRuntime.runMain);
