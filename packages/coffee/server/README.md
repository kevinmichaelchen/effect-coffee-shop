# Coffee Server

The Coffee Worker: provides the `coffee-domain` model through `src/CoffeeShopLive.ts`, the one
Layer that picks its host (Cloudflare Durable Objects today), and serves every backend path.

| Path                                        | Served by                                                    |
| ------------------------------------------- | ------------------------------------------------------------ |
| `/api/customer`, `/api/staff`               | Domain Apis behind the session; live watches over WebSockets |
| `/api/rest/customer`, `/api/rest/staff`     | The same Apis as REST, OpenAPI                               |
| `/api/auth/*`, `/oauth/*`, `/.well-known/*` | Yielded Auth                                                 |
| `/api/health`, `/api/menu`, `/api/me`       | REST                                                         |
| `/mcp`                                      | MCP tools, generated from Apis                               |

`src/CoffeeWorker.ts` is the entry point. Tests run the same layer on `Domain.InMemory`.
