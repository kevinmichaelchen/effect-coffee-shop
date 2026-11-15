# Coffee Server

The Coffee Worker: serves every backend path over the `coffee-domain` model, wherever it is hosted.
`src/CoffeeServer.ts` is the program and names no provider; a Worker provides its model host and
its auth storage and secret. The model host is one Layer: `src/CoffeeShopLive.ts` (Cloudflare
Durable Objects) or `src/CoffeeShopRivet.ts` (Rivet), used by `src/CoffeeWorker.ts` and
`src/CoffeeWorkerRivet.ts`. Both Workers keep auth on Cloudflare (`src/adapters/cloudflare.ts`).

| Path                                        | Served by                                                    |
| ------------------------------------------- | ------------------------------------------------------------ |
| `/api/customer`, `/api/staff`               | Domain Apis behind the session; live watches over WebSockets |
| `/api/rest/customer`, `/api/rest/staff`     | The same Apis as REST, OpenAPI                               |
| `/api/auth/*`, `/oauth/*`, `/.well-known/*` | Yielded Auth                                                 |
| `/api/health`, `/api/menu`, `/api/me`       | REST                                                         |
| `/mcp`                                      | MCP tools, generated from Apis                               |

Tests run the same model on `Domain.InMemory`.
