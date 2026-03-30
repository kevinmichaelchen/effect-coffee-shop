import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as Layer from "effect/Layer";
import { makeCoffeeMcpHttpServer } from "./server.ts";

const port = Number(process.env.PORT ?? "3001");

Layer.launch(makeCoffeeMcpHttpServer(port)).pipe(BunRuntime.runMain);
