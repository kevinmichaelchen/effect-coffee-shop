import alchemy from "alchemy";
import { Ai, D1Database, Website } from "alchemy/cloudflare";
import { CloudflareStateStore } from "alchemy/state";

const app = await alchemy("effect-v4-onion", {
  password: process.env.ALCHEMY_PASSWORD,
  stateStore: process.env.ALCHEMY_STATE_TOKEN
    ? (scope) => new CloudflareStateStore(scope)
    : undefined,
});

export const coffeeDb = await D1Database("coffee-db", {
  dev: {
    remote: false,
  },
});

export const ai = Ai();

export const website = await Website("onion", {
  url: true,
  compatibility: "node",
  entrypoint: "./backend/src/presentation/cloudflare/worker.ts",
  build: {
    command: "bun run --cwd ui build",
  },
  dev: {
    command: "bun run --cwd ui dev -- --host 127.0.0.1 --port 5173",
  },
  assets: {
    directory: "./ui/dist",
    run_worker_first: [
      "/.well-known/agent-configuration",
      "/api",
      "/api/*",
      "/mcp",
      "/mcp/*",
    ],
  },
  bindings: {
    AI: ai,
    BETTER_AUTH_SECRET: alchemy.secret.env.BETTER_AUTH_SECRET,
    COFFEE_STAFF_USER_IDS: process.env.COFFEE_STAFF_USER_IDS ?? "",
    DB: coffeeDb,
  },
});

console.log({
  database: coffeeDb.name,
  url: website.url,
});

await app.finalize();
