# Coffee Server

The Coffee Worker: serves every backend path over the `coffee-domain` model, wherever it is hosted.
The host is one Layer: `src/CoffeeShopLive.ts` (Cloudflare Durable Objects) or
`src/CoffeeShopRivet.ts` (Rivet), and `src/CoffeeWorker.ts` and `src/CoffeeWorkerRivet.ts` are the
same Worker (`src/CoffeeServer.ts`) over each.

| Path                                        | Served by                                                    |
| ------------------------------------------- | ------------------------------------------------------------ |
| `/api/customer`, `/api/staff`               | Domain Apis behind the session; live watches over WebSockets |
| `/api/rest/customer`, `/api/rest/staff`     | The same Apis as REST, OpenAPI                               |
| `/api/auth/*`, `/oauth/*`, `/.well-known/*` | Yielded Auth                                                 |
| `/api/health`, `/api/menu`, `/api/me`       | REST                                                         |
| `/mcp`                                      | MCP tools, generated from Apis                               |

Tests run the same model on `Domain.InMemory`.
