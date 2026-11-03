# Coffee Server

The Coffee Worker: hosts the `coffee-domain` model on Durable Objects and serves every backend path.

| Path                                        | Served by                      |
| ------------------------------------------- | ------------------------------ |
| `/api/customer`, `/api/staff`               | Domain Apis behind the session |
| `/api/rest/customer`, `/api/rest/staff`     | The same Apis as REST, OpenAPI |
| `/api/auth/*`, `/oauth/*`, `/.well-known/*` | Yielded Auth                   |
| `/api/health`, `/api/menu`, `/api/me`       | REST                           |
| `/mcp`                                      | MCP tools, generated from Apis |
| `/sync/*`                                   | Order feeds (`OrderFeed*.ts`)  |

`src/CoffeeWorker.ts` is the entry point. Tests run the same layer on `Domain.InMemory`.
